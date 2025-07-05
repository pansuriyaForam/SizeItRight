"use client";

import { useState } from 'react';
import { ImageResizer } from "@/components/image-resizer";
import { ResizeHistory } from '@/components/resize-history';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleResizeComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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
      <ImageResizer onResizeComplete={handleResizeComplete} />
      <div className="w-full flex justify-center mt-8">
        <ResizeHistory refreshTrigger={refreshTrigger} />
      </div>
    </main>
  );
}
