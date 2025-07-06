"use client";

import { ImageResizer } from "@/components/image-resizer";
import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Footer } from "@/components/footer";

export default function Home() {

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-4 sm:p-6 md:p-8 font-body relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-lg text-center mb-8 mt-12 sm:mt-0">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-foreground tracking-tight">
          SizeItRight
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Perfect Image Size. Every Time.
        </p>
      </div>
      <ImageResizer />
      <Alert className="w-full max-w-lg mt-8 bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/30 dark:border-yellow-400/20 dark:text-yellow-200 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-300">
        <Info className="h-4 w-4" />
        <AlertTitle>Privacy & Security</AlertTitle>
        <AlertDescription>
          ⚠️ We do not store your images. They’re processed in-memory and directly downloaded. No sign-ups. No spam. Just resizing, done right.
        </AlertDescription>
      </Alert>
      <Footer />
    </main>
  );
}
