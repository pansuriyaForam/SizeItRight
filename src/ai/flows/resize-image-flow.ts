'use server';
/**
 * @fileOverview A flow for resizing an image to a target file size.
 * - resizeImage - A function that handles the image resizing process.
 * - ResizeImageInput - The input type for the resizeImage function.
 * - ResizeImageOutput - The return type for the resizeImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import sharp from 'sharp';

export const ResizeImageInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "The image to resize, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  targetSizeKB: z.number().describe('The target file size in kilobytes.'),
});
export type ResizeImageInput = z.infer<typeof ResizeImageInputSchema>;

export const ResizeImageOutputSchema = z.object({
  resizedImageDataUri: z.string().describe('The resized image as a data URI.'),
  resizedSizeKB: z.number().describe('The final size of the resized image in kilobytes.'),
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
  async ({ imageDataUri, targetSizeKB }) => {
    const targetSizeBytes = targetSizeKB * 1024;
    const [header, base64Data] = imageDataUri.split(',');
    if (!header || !base64Data) {
        throw new Error("Invalid image data URI format.");
    }
    const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const originalSizeKB = imageBuffer.length / 1024;

    if (Math.abs(originalSizeKB - targetSizeKB) <= 5) {
      return {
        resizedImageDataUri: imageDataUri,
        resizedSizeKB: parseFloat(originalSizeKB.toFixed(2)),
      };
    }

    const sharpInstance = sharp(imageBuffer);
    const metadata = await sharpInstance.metadata();
    const format = metadata.format as 'jpeg' | 'png' | 'webp' | undefined;

    if (!format || !['jpeg', 'png', 'webp'].includes(format)) {
      throw new Error('Unsupported image format. Please use JPG, PNG, or WebP.');
    }

    let resizedBuffer: Buffer;

    if (originalSizeKB > targetSizeKB) {
      let quality = 80;
      resizedBuffer = await sharpInstance[format]({ quality }).toBuffer();
      
      // Iteratively reduce quality to get close to the target size
      while (resizedBuffer.length > targetSizeBytes && quality > 10) {
        quality -= 5;
        resizedBuffer = await sharpInstance[format]({ quality }).toBuffer();
      }
    } else {
      const { width, height } = metadata;
      if (!width || !height) {
          throw new Error("Could not read image dimensions.");
      }
      
      // Upscale by 15% to increase resolution
      resizedBuffer = await sharpInstance
        .resize(Math.round(width * 1.15), Math.round(height * 1.15))
        .toBuffer();

      // If still smaller, pad with invisible metadata to reach the target size
      if (resizedBuffer.length < targetSizeBytes) {
        const paddingSize = targetSizeBytes - resizedBuffer.length;
        if (paddingSize > 0) {
            // Embed a fake ICC profile with null bytes to reach target size
            const padding = Buffer.alloc(paddingSize, 0);
            resizedBuffer = await sharp(resizedBuffer)
                .withMetadata({ icc: padding })
                .toBuffer();
        }
      }
    }

    const resizedBase64 = resizedBuffer.toString('base64');
    const finalImageDataUri = `data:${mimeType};base64,${resizedBase64}`;
    const finalSizeKB = resizedBuffer.length / 1024;

    return {
      resizedImageDataUri: finalImageDataUri,
      resizedSizeKB: parseFloat(finalSizeKB.toFixed(2)),
    };
  }
);
