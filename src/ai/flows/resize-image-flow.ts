'use server';
/**
 * @fileOverview A flow for resizing an image, storing it, and tracking history.
 * - resizeImage - A function that handles the image resizing process.
 * - ResizeImageInput - The input type for the resizeImage function.
 * - ResizeImageOutput - The return type for the resizeImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { app } from '@/lib/firebase';
import { addHistoryEntry, HistoryEntryCreate } from '@/services/historyService';

const storage = getStorage(app);

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
  resizedImageDataUri: z.string().describe('The resized image as a data URI for preview.'),
  downloadUrl: z.string().describe('The public download URL of the resized image from Firebase Storage.'),
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

        const originalSizeKB = imageBuffer.length / 1024;
        
        if (!originalMetadata.width || !originalMetadata.height) {
            throw new Error("Could not read original image dimensions.");
        }

        const format = originalMetadata.format as 'jpeg' | 'png' | 'webp' | undefined;
        if (!format || !['jpeg', 'png', 'webp'].includes(format)) {
            throw new Error(`Resize failed: unsupported image format '${format}'. Please use JPG, PNG, or WebP.`);
        }

        let resizedBuffer: Buffer;
        const isCloseEnough = Math.abs(originalSizeKB - targetSizeKB) <= 5;

        if (isCloseEnough) {
            resizedBuffer = imageBuffer;
        } else {
            const sharpInstance = sharp(imageBuffer);

            if (originalSizeKB > targetSizeKB) {
                let quality = 80;
                resizedBuffer = await sharpInstance[format]({ quality }).toBuffer();
                
                while (resizedBuffer.length > targetSizeBytes && quality > 10) {
                    quality -= 5;
                    resizedBuffer = await sharpInstance[format]({ quality }).toBuffer();
                }
            } else {
                const { width, height } = originalMetadata;
                resizedBuffer = await sharpInstance
                    .resize(Math.round(width * 1.15), Math.round(height * 1.15))
                    .toBuffer();

                if (resizedBuffer.length < targetSizeBytes) {
                    const paddingSize = targetSizeBytes - resizedBuffer.length;
                    if (paddingSize > 0) {
                        const padding = Buffer.alloc(paddingSize, 0);
                        resizedBuffer = await sharp(resizedBuffer)
                            .withMetadata({ icc: padding })
                            .toBuffer();
                    }
                }
            }
        }
        
        const resizedMetadata = await sharp(resizedBuffer).metadata();
        const finalSizeKB = resizedBuffer.length / 1024;
        
        if (!resizedMetadata.width || !resizedMetadata.height) {
            throw new Error("Could not read resized image dimensions.");
        }

        const uniqueId = uuidv4();
        const fileExtension = fileName.split('.').pop() || format;
        const newFileName = `resized-${uniqueId}.${fileExtension}`;

        const thumbnailPath = `thumbnails/${newFileName}`;
        const resizedImagePath = `resized/${newFileName}`;
        
        const thumbnailBuffer = await sharp(imageBuffer).resize(100, 100, { fit: 'inside' }).jpeg({ quality: 50 }).toBuffer();
        const thumbnailUrl = await uploadImageAndGetUrl(thumbnailBuffer, thumbnailPath, 'image/jpeg');
        const resizedImageUrl = await uploadImageAndGetUrl(resizedBuffer, resizedImagePath, mimeType);

        const historyEntry: HistoryEntryCreate = {
            fileName: newFileName,
            originalSizeKB: parseFloat(originalSizeKB.toFixed(2)),
            originalWidth: originalMetadata.width,
            originalHeight: originalMetadata.height,
            thumbnailUrl: thumbnailUrl,
            resizedSizeKB: parseFloat(finalSizeKB.toFixed(2)),
            resizedWidth: resizedMetadata.width,
            resizedHeight: resizedMetadata.height,
            resizedImageUrl: resizedImageUrl,
        };
        await addHistoryEntry(historyEntry);

        return {
          resizedImageDataUri: `data:${mimeType};base64,${resizedBuffer.toString('base64')}`,
          downloadUrl: resizedImageUrl,
          resizedSizeKB: parseFloat(finalSizeKB.toFixed(2)),
          resizedWidth: resizedMetadata.width,
          resizedHeight: resizedMetadata.height,
        };

    } catch (error: any) {
        console.error(`[resizeImageFlow] Execution failed. Input: { fileName: "${fileName}", targetSizeKB: ${targetSizeKB} }. Error:`, error.message);
        
        const knownErrors = ['Could not read', 'Resize failed', 'Unable to save image'];
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

async function uploadImageAndGetUrl(buffer: Buffer, path: string, mimeType: string): Promise<string> {
    try {
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, buffer, { contentType: mimeType });
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error(`Failed to save image to Firebase Storage at path: ${path}`, error);
        throw new Error("Unable to save image.");
    }
}
