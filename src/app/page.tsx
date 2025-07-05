import { ImageResizer } from "@/components/image-resizer";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8 font-body">
      <div className="w-full max-w-lg text-center mb-8">
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
