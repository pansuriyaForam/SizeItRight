"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import NextImage from "next/image";
import { UploadCloud, Loader2, Download, X, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { resizeImage } from "@/ai/flows/resize-image-flow";

interface ImageFile extends File {
  preview: string;
  width?: number;
  height?: number;
}

interface ResizerProps {
  onResizeComplete: () => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 KB";
  return `${(bytes / 1024).toFixed(2)} KB`;
};

export function ImageResizer({ onResizeComplete }: ResizerProps) {
  const [imageFile, setImageFile] = useState<ImageFile | null>(null);
  const [targetSize, setTargetSize] = useState<string>("100");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resizedImageUrl, setResizedImageUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resizedSize, setResizedSize] = useState<number | null>(null);
  const [resizedDimensions, setResizedDimensions] = useState<{width: number; height: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback((file: File) => {
    if (file && file.type.startsWith("image/")) {
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.onload = () => {
          setImageFile(
            Object.assign(file, {
              preview: objectUrl,
              width: img.width,
              height: img.height,
            })
          );
        };
        img.onerror = () => {
          setError("Could not read image dimensions.");
          URL.revokeObjectURL(objectUrl);
        };
      };
      reader.onerror = () => {
        setError("Failed to read file.");
      };
      reader.readAsDataURL(file);
    } else {
      setError("Please upload a valid image file (e.g., PNG, JPG, WebP).");
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleResize = async () => {
    if (!imageFile || !targetSize) return;

    setIsProcessing(true);
    setError(null);

    try {
      const imageDataUri = await fileToDataUri(imageFile);
      const targetSizeKB = parseInt(targetSize, 10);

      if (isNaN(targetSizeKB) || targetSizeKB <= 0) {
        throw new Error("Please enter a valid positive number for target size.");
      }

      const result = await resizeImage({
        imageDataUri,
        targetSizeKB,
        fileName: imageFile.name,
      });

      setResizedImageUrl(result.resizedImageDataUri);
      setDownloadUrl(result.downloadUrl);
      setResizedSize(result.resizedSizeKB);
      setResizedDimensions({width: result.resizedWidth, height: result.resizedHeight});
      onResizeComplete();
    } catch (err: any) {
      const errorMessage =
        err.message || "An unexpected error occurred during resizing.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Resize Failed",
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (imageFile) {
      URL.revokeObjectURL(imageFile.preview);
    }
    setImageFile(null);
    setTargetSize("100");
    setIsProcessing(false);
    setResizedImageUrl(null);
    setDownloadUrl(null);
    setResizedSize(null);
    setResizedDimensions(null);
    setError(null);
  };

  const renderUploadState = () => (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200",
        isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary"
      )}
      data-ai-hint="cloud upload"
    >
      <UploadCloud className="w-12 h-12 text-muted-foreground" />
      <p className="mt-4 text-center text-muted-foreground">
        <span className="font-semibold text-primary">Click to upload</span> or drag and drop
      </p>
      <p className="text-xs text-muted-foreground">PNG, JPG, WebP up to 10MB</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
  
  const renderPreviewState = () => imageFile && (
    <div className="space-y-4">
      <div className="relative group rounded-lg overflow-hidden border">
        <NextImage
          src={imageFile.preview}
          alt="Image preview"
          width={400}
          height={300}
          className="w-full h-auto object-contain max-h-[300px]"
        />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button variant="destructive" size="icon" onClick={() => handleReset()}>
                <X className="h-5 w-5"/>
                <span className="sr-only">Remove image</span>
            </Button>
        </div>
      </div>
      <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
        <div>
          <p className="font-semibold">Original Size:</p>
          <p>{formatBytes(imageFile.size)}</p>
        </div>
        <div>
          <p className="font-semibold">Dimensions:</p>
          <p>{imageFile.width} x {imageFile.height}</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="target-size">Desired File Size (KB)</Label>
        <Input
          id="target-size"
          type="number"
          value={targetSize}
          onChange={(e) => setTargetSize(e.target.value)}
          placeholder="e.g., 100"
          disabled={isProcessing}
        />
      </div>
    </div>
  );

  const renderResultState = () => resizedImageUrl && (
    <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center">
            <Download className="w-10 h-10 text-green-600" />
        </div>
      <h2 className="text-2xl font-semibold">Image Resized!</h2>
      <p className="text-muted-foreground">
        Your image is now {resizedSize} KB ({resizedDimensions?.width}x{resizedDimensions?.height}).
      </p>
      <div className="relative rounded-lg overflow-hidden border">
        <NextImage
          src={resizedImageUrl}
          alt="Resized image preview"
          width={400}
          height={300}
          className="w-full h-auto object-contain max-h-[300px]"
        />
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <ImageIcon className="text-primary"/> 
            <span>Image Resizer</span>
        </CardTitle>
        <CardDescription>
            Upload an image and set a target size to compress it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!imageFile && !resizedImageUrl && renderUploadState()}
        {imageFile && !resizedImageUrl && renderPreviewState()}
        {resizedImageUrl && renderResultState()}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {imageFile && !resizedImageUrl && (
          <Button onClick={handleResize} disabled={isProcessing || !targetSize}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing ? "Resizing..." : "Resize Now"}
          </Button>
        )}
        {resizedImageUrl && downloadUrl && (
            <>
                <Button variant="outline" onClick={handleReset}>Resize Another</Button>
                <Button asChild>
                    <a href={downloadUrl} download>
                        <Download className="mr-2 h-4 w-4"/>
                        Download
                    </a>
                </Button>
            </>
        )}
      </CardFooter>
    </Card>
  );
}
