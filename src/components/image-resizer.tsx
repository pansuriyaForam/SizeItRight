"use client";

import { useState, useCallback, useRef, DragEvent, useEffect } from "react";
import NextImage from "next/image";
import { UploadCloud, Loader2, Download, X, Image as ImageIcon, ChevronsLeftRight, Info, FolderUp } from "lucide-react";

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
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ImageFile extends File {
  preview: string;
  width?: number;
  height?: number;
}

interface ResizerProps {}

// Add global types for Google Picker and GSI
declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => any;
          hasGrantedAllScopes: (token: any, scope: string) => boolean;
        };
      };
      picker: any;
    };
    gapi: {
      load: (api: string, callback: () => void) => void;
      client: any;
      auth: any;
    };
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 KB";
  return `${(bytes / 1024).toFixed(2)} KB`;
};

export function ImageResizer({}: ResizerProps) {
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
  const [comparisonValue, setComparisonValue] = useState(50);
  const [showAd, setShowAd] = useState<boolean>(false);

  // Google Picker State
  const [isPickerApiReady, setIsPickerApiReady] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [oauthToken, setOauthToken] = useState<any>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const scope = "https://www.googleapis.com/auth/drive.readonly";

  // Effect to initialize Google APIs
  useEffect(() => {
    const initGis = () => {
      if (window.google && window.google.accounts && clientId && !clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: scope,
          callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              setOauthToken(tokenResponse);
              createPicker(tokenResponse.access_token);
            } else {
              setError("Failed to get authentication token from Google.");
            }
          },
        });
        setTokenClient(client);
      }
    };

    const gapiLoad = () => {
      if (window.gapi) {
        window.gapi.load("picker", () => {
          setIsPickerApiReady(true);
        });
      }
    };
    
    const checkScripts = setInterval(() => {
      if (window.google && window.gapi) {
        clearInterval(checkScripts);
        initGis();
        gapiLoad();
      }
    }, 100);

    return () => clearInterval(checkScripts);
  }, [clientId]);

  const createPicker = (accessToken: string) => {
    if (!isPickerApiReady || !accessToken || !apiKey) {
      setError("Google Picker is not ready. Please ensure API key and Client ID are configured.");
      return;
    }
    const view = new window.google.picker.View(window.google.picker.ViewId.PHOTOS);
    view.setMimeTypes("image/png,image/jpeg,image/webp");
    
    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback(pickerCallback)
      .build();
    picker.setVisible(true);
  };

  const pickerCallback = async (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      setIsProcessing(true);
      setError(null);
      try {
        const doc = data.docs[0];
        const fileId = doc.id;
        const accessToken = oauthToken.access_token;
  
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
  
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(`Failed to download file: ${errorData.error.message || res.statusText}`);
        }
  
        const blob = await res.blob();
        const file = new File([blob], doc.name, { type: doc.mimeType });
        handleFile(file);
      } catch (err: any) {
        setError(`Could not retrieve file from Drive: ${err.message}`);
        toast({ variant: "destructive", title: "Drive Error", description: `Could not retrieve file: ${err.message}` });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDriveClick = () => {
    if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
        const errorMessage = "Google Client ID is not configured. Please add a valid NEXT_PUBLIC_GOOGLE_CLIENT_ID to your .env file.";
        setError(errorMessage);
        toast({
            variant: "destructive",
            title: "Configuration Error",
            description: errorMessage
        });
        return;
    }

    if (!tokenClient) {
        setError("Google authentication is not ready. Please try again in a moment.");
        return;
    };

    if (oauthToken && window.google.accounts.oauth2.hasGrantedAllScopes(oauthToken, scope)) {
        createPicker(oauthToken.access_token);
    } else {
        tokenClient.requestAccessToken({ prompt: "consent" });
    }
  };


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
    setShowAd(false);

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
      setDownloadUrl(result.resizedImageDataUri);
      setResizedSize(result.resizedSizeKB);
      setResizedDimensions({width: result.resizedWidth, height: result.resizedHeight});
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
    setComparisonValue(50);
    setShowAd(false);
  };

  const renderUploadState = () => (
    <>
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
        <div className="relative flex items-center py-4">
            <div className="flex-grow border-t" />
            <span className="flex-shrink mx-4 text-xs uppercase text-muted-foreground">Or</span>
            <div className="flex-grow border-t" />
        </div>
        <Button
            variant="outline"
            className="w-full"
            onClick={handleDriveClick}
            disabled={!isPickerApiReady || !tokenClient || (isProcessing && !imageFile)}
        >
            {(isProcessing && !imageFile) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <FolderUp className="mr-2 h-4 w-4" />
            )}
            Upload from Google Drive
        </Button>
    </>
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
        <div className="flex items-center gap-2">
          <Label htmlFor="target-size">Desired File Size (KB)</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  We try to match your desired file size, but the final size may vary slightly depending on image format and quality limits.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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

  const renderResultState = () => resizedImageUrl && imageFile && (
    <div className="space-y-4">
        <div className="text-center">
            <h2 className="text-2xl font-semibold">Comparison</h2>
            <p className="text-muted-foreground">Your image has been resized successfully.</p>
        </div>

        {/* Desktop: Slider comparison */}
        <div className="hidden md:block">
            <div className="relative w-full mx-auto aspect-video overflow-hidden rounded-lg border group shadow-inner">
                {/* Original Image (Bottom Layer) */}
                <NextImage
                    src={imageFile.preview}
                    alt="Original image"
                    fill
                    className="object-contain"
                />
                
                {/* Resized Image (Top Layer, clipped) */}
                <div 
                    className="absolute inset-0" 
                    style={{ clipPath: `polygon(0 0, ${comparisonValue}% 0, ${comparisonValue}% 100%, 0 100%)` }}
                >
                    <NextImage
                        src={resizedImageUrl}
                        alt="Resized image"
                        fill
                        className="object-contain"
                    />
                </div>
                <Slider
                    value={[comparisonValue]}
                    onValueChange={(v) => setComparisonValue(v[0])}
                    max={100}
                    step={0.1}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize group-hover:opacity-100 transition-opacity [&>span]:bg-transparent"
                />
                <div 
                    className="absolute top-0 bottom-0 w-1 bg-white/50 backdrop-blur-sm pointer-events-none transition-opacity opacity-0 group-hover:opacity-100"
                    style={{ left: `${comparisonValue}%`, transform: 'translateX(-50%)' }}
                >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-white/80 border-2 border-white flex items-center justify-center shadow-lg">
                        <ChevronsLeftRight className="h-5 w-5 text-foreground" />
                    </div>
                </div>
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md font-semibold">BEFORE</div>
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md font-semibold">AFTER</div>
            </div>
        </div>

        {/* Mobile: Stacked comparison */}
        <div className="md:hidden space-y-6">
            <div>
                <h3 className="font-semibold mb-2 text-muted-foreground text-center">Before</h3>
                <div className="relative aspect-video rounded-lg overflow-hidden border">
                    <NextImage
                        src={imageFile.preview}
                        alt="Original image"
                        fill
                        className="object-contain"
                    />
                </div>
            </div>
            <div>
                <h3 className="font-semibold mb-2 text-muted-foreground text-center">After</h3>
                <div className="relative aspect-video rounded-lg overflow-hidden border">
                    <NextImage
                        src={resizedImageUrl}
                        alt="Resized image"
                        fill
                        className="object-contain"
                    />
                </div>
            </div>
        </div>
        
        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center pt-2">
            <div className="border p-3 rounded-lg space-y-1">
                <h4 className="font-semibold">Original</h4>
                <p className="text-sm text-muted-foreground">{formatBytes(imageFile.size)}</p>
                <p className="text-sm text-muted-foreground">{imageFile.width} x {imageFile.height}</p>
            </div>
            <div className="border border-primary bg-primary/10 p-3 rounded-lg space-y-1">
                <h4 className="font-semibold">Resized</h4>
                <p className="text-sm text-muted-foreground">{resizedSize} KB</p>
                <p className="text-sm text-muted-foreground">{resizedDimensions?.width} x {resizedDimensions?.height}</p>
            </div>
        </div>

        {/* Ad Placeholder Section */}
        {showAd && (
            <div className="mt-6 p-4 border border-dashed rounded-lg text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                    Thanks for using SizeItRight! You can support us by viewing this sponsor ❤️
                </p>
                <div className="bg-muted/50 w-full h-24 flex items-center justify-center rounded-md">
                    <p className="text-muted-foreground text-xs">Google Ad Placeholder</p>
                </div>
            </div>
        )}
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
        {resizedImageUrl && downloadUrl && imageFile && (
            <>
                <Button variant="outline" onClick={handleReset}>Resize Another</Button>
                <Button asChild onClick={() => setShowAd(true)}>
                    <a href={downloadUrl} download={`resized-${imageFile.name}`}>
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
