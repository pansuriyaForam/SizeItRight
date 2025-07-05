"use client";

import { Coffee, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function Footer() {
  const { toast } = useToast();
  const upiId = 'pansuriya@ptyes';

  const handleCopy = () => {
    navigator.clipboard.writeText(upiId).then(() => {
      toast({
        title: "Copied to clipboard!",
        description: `UPI ID: ${upiId}`,
      });
    }).catch(err => {
      console.error('Failed to copy UPI ID: ', err);
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Could not copy UPI ID.",
      });
    });
  };

  return (
    <footer className="w-full max-w-2xl mt-16 text-center text-muted-foreground pb-8">
      <div className="border-t pt-8 space-y-6">
        <h3 className="text-lg font-semibold text-foreground">Support the Creator</h3>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild className="w-full sm:w-auto">
            <a href="https://www.buymeacoffee.com/foramben" target="_blank" rel="noopener noreferrer">
              <Coffee className="mr-2" />
              Enjoyed the tool? Support me ☕
            </a>
          </Button>
        </div>

        <div className="text-sm">
          <p>Prefer UPI? Use:</p>
          <div className="mt-2 inline-flex items-center gap-2 p-2 px-3 border rounded-lg bg-muted/50">
            <code className="font-mono text-base text-foreground">{upiId}</code>
            <Button variant="ghost" size="icon" onClick={handleCopy} aria-label="Copy UPI ID" className="h-8 w-8">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs mt-1">on any UPI app</p>
        </div>
        
        <p className="text-xs italic max-w-md mx-auto !mt-8">
          This is a personal side project by Pansuriya Foramben, made with ❤️ to help students and form-filler warriors. Your support means a lot.
        </p>
      </div>
    </footer>
  );
}
