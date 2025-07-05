"use client";

import { ImageResizer } from "@/components/image-resizer";
import { ThemeToggle } from '@/components/theme-toggle';

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
    </main>
  );
}
