import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import Script from "next/script";
import './globals.css';

export const metadata: Metadata = {
  title: 'SizeItRight — Resize Images to Fit KB Limits (No Signup)',
  description: 'Resize images to a perfect KB limit for government and college forms. No login. No tracking. Just resizing.',
  keywords: 'resize image KB, increase image size, compress image online, image to 50 KB, passport photo KB limit',
  openGraph: {
    title: 'SizeItRight — Resize Images to Fit KB Limits (No Signup)',
    description: 'Resize images to a perfect KB limit for government and college forms. No login. No tracking. Just resizing.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
        <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" async defer></Script>
        <Script src="https://apis.google.com/js/api.js" strategy="lazyOnload" async defer></Script>
      </body>
    </html>
  );
}
