'use server';
/**
 * @fileOverview A flow for resizing an image.
 * - resizeImage - A function that handles the image resizing process.
 * - ResizeImageInput - The input type for the resizeImage function.
 * - ResizeImageOutput - The return type for the resizeImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import sharp from 'sharp';

const ResizeImageInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "The image to resize, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  targetSizeKB: z.number().positive({ message: "Target size must be a positive number."}).describe('The target file size in kilobytes.'),
  fileName: z.string().describe('The original name of the file.'),
});
export type ResizeImageInput = z.infer<typeof ResizeImageInputSchema>;

const ResizeImageOutputSchema = z.object({
  resizedImageDataUri: z.string().describe('The resized image as a data URI for preview and download.'),
  resizedSizeKB: z.number().describe('The final size of the resized image in kilobytes.'),
  resizedWidth: z.number().describe('The width of the resized image.'),
  resizedHeight: z.number().describe('The height of the resized image.'),
});
export type ResizeImageOutput = z.infer<typeof ResizeImageOutputSchema>;

export async function resizeImage(input: ResizeImageInput): Promise<ResizeImageOutput> {
  return resizeImageFlow(input);
}

const resizeImageFlow = ai.defineFlow(
  {
    name: 'resizeImageFlow',
    inputSchema: ResizeImageInputSchema,
    outputSchema: ResizeImageOutputSchema,
  },
  async ({ imageDataUri, targetSizeKB, fileName }) => {
    try {
        const targetSizeBytes = targetSizeKB * 1024;
        const toleranceBytes = 2 * 1024; // +/- 2 KB
        const MAX_ATTEMPTS = 10;
        
        const [header, base64Data] = imageDataUri.split(',');
        if (!header || !base64Data) {
            throw new Error("Could not read uploaded file: Invalid data URI format.");
        }
        
        const mimeType = header.match(/:(.*?);/)?.[1];
        if (!mimeType) {
            throw new Error("Could not read uploaded file: MIME type missing.");
        }
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        let originalMetadata;
        try {
            originalMetadata = await sharp(imageBuffer).metadata();
        } catch (e) {
            console.error("Sharp metadata processing error:", e);
            throw new Error("Resize failed: invalid or corrupt image format.");
        }

        if (!originalMetadata.width || !originalMetadata.height) {
            throw new Error("Could not read original image dimensions.");
        }

        const format = originalMetadata.format as 'jpeg' | 'png' | 'webp' | undefined;
        if (!format || !['jpeg', 'png', 'webp'].includes(format)) {
            throw new Error(`Resize failed: unsupported image format '${format}'. Please use JPG, PNG, or WebP.`);
        }
        
        let resizedBuffer = imageBuffer;
        const originalSize = imageBuffer.length;

        // Step 1: If image is too large, compress it down.
        if (originalSize > targetSizeBytes + toleranceBytes) {
            if (format === 'png') {
                // PNG is lossless; perform a single, strong compression attempt.
                resizedBuffer = await sharp(imageBuffer).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
            } else {
                // For JPG/WebP, iterate to reduce quality.
                let quality = 90;
                let lastBuffer = resizedBuffer;
                for (let i = 0; i < MAX_ATTEMPTS; i++) {
                    lastBuffer = await sharp(imageBuffer)[format]({ quality }).toBuffer();
                    // Stop if we are now under the target size, as padding can handle it from here.
                    if (lastBuffer.length < targetSizeBytes) {
                        break;
                    }
                    // Or stop if we are within the tolerance range from above.
                    if (lastBuffer.length <= targetSizeBytes + toleranceBytes) {
                        break;
                    }
                    quality -= 5;
                    if (quality < 10) break;
                }
                resizedBuffer = lastBuffer;
            }
        }
        
        // Step 2: If the image is (or has become) too small, pad it up.
        if (resizedBuffer.length < targetSizeBytes - toleranceBytes) {
            const paddingSize = targetSizeBytes - resizedBuffer.length;
            if (paddingSize > 0) {
                // Add invisible metadata to increase size without affecting quality.
                const padding = Buffer.alloc(paddingSize);
                resizedBuffer = await sharp(resizedBuffer).withMetadata({ icc: padding }).toBuffer();
            }

            // If padding overshot the target, do one final, mild re-compression.
            if (resizedBuffer.length > targetSizeBytes + toleranceBytes && format !== 'png') {
                resizedBuffer = await sharp(resizedBuffer)[format]({ quality: 85 }).toBuffer();
            }
        }
        
        console.log(`Closest match: ${(resizedBuffer.length / 1024).toFixed(2)} KB for target ${targetSizeKB} KB`);
        
        const resizedMetadata = await sharp(resizedBuffer).metadata();
        const finalSizeKB = resizedBuffer.length / 1024;
        
        if (!resizedMetadata.width || !resizedMetadata.height) {
            throw new Error("Could not read resized image dimensions.");
        }

        return {
          resizedImageDataUri: `data:${mimeType};base64,${resizedBuffer.toString('base64')}`,
          resizedSizeKB: parseFloat(finalSizeKB.toFixed(2)),
          resizedWidth: resizedMetadata.width,
          resizedHeight: resizedMetadata.height,
        };

    } catch (error: any) {
        console.error(`[resizeImageFlow] Execution failed. Input: { fileName: "${fileName}", targetSizeKB: ${targetSizeKB} }. Error:`, error.message);
        
        const knownErrors = ['Could not read', 'Resize failed'];
        if (error instanceof z.ZodError) {
          throw new Error(error.errors[0].message);
        }
        if (error.message && knownErrors.some(e => error.message.startsWith(e))) {
            throw error;
        }
        throw new Error('Internal server error. Please try again.');
    }
  }
);
