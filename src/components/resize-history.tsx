"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { Download, History, Loader2 } from "lucide-react";
import { format } from "date-fns";

import { getHistoryEntries, HistoryEntry } from "@/services/historyService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export function ResizeHistory({ refreshTrigger }: { refreshTrigger: number }) {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Don't set loading to true on refresh, only on initial load
                if (history.length === 0) {
                    setIsLoading(true);
                }
                const entries = await getHistoryEntries();
                setHistory(entries);
            } catch (error: any) {
                console.error("Failed to fetch resize history:", error);
                // Only show toast if firebase is likely not configured.
                if (error.code && error.code.includes('auth')) {
                    toast({
                        variant: "destructive",
                        title: "History Unavailable",
                        description: "Could not load resize history. Please ensure your Firebase configuration is correct in the .env file.",
                    });
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [refreshTrigger, toast, history.length]);

    if (isLoading) {
        return (
            <div className="flex w-full max-w-4xl flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading History...</p>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="flex w-full max-w-4xl flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <History className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No resize history yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Resize an image to see its history here.</p>
            </div>
        );
    }

    return (
        <Card className="w-full max-w-4xl shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="text-primary"/>
                    <span>Resize History</span>
                </CardTitle>
                <CardDescription>
                    Here are your most recent resized images.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px] w-full">
                    {/* Mobile view */}
                    <div className="md:hidden space-y-4 pr-4">
                        {history.map((entry) => (
                            <Card key={entry.id} className="p-4">
                                <div className="flex gap-4">
                                    <NextImage src={entry.thumbnailUrl} alt="Thumbnail" width={64} height={64} className="rounded-md object-cover h-16 w-16 border"/>
                                    <div className="flex-grow space-y-1 text-sm">
                                        <p><strong>Original:</strong> {entry.originalSizeKB} KB ({entry.originalWidth}x{entry.originalHeight})</p>
                                        <p><strong>Resized:</strong> {entry.resizedSizeKB} KB ({entry.resizedWidth}x{entry.resizedHeight})</p>
                                        <p className="text-xs text-muted-foreground">{format(entry.timestamp.toDate(), "PPpp")}</p>
                                    </div>
                                </div>
                                <Button asChild size="sm" className="w-full mt-4">
                                    <a href={entry.resizedImageUrl} download={entry.fileName}>
                                        <Download className="mr-2" /> Download Again
                                    </a>
                                </Button>
                            </Card>
                        ))}
                    </div>
                    {/* Desktop view */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Preview</TableHead>
                                    <TableHead>Original</TableHead>
                                    <TableHead>Resized</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell>
                                            <NextImage src={entry.thumbnailUrl} alt="Thumbnail" width={48} height={48} className="rounded-md object-cover border"/>
                                        </TableCell>
                                        <TableCell>{entry.originalSizeKB} KB <br/> <span className="text-sm text-muted-foreground">{entry.originalWidth}x{entry.originalHeight}</span></TableCell>
                                        <TableCell>{entry.resizedSizeKB} KB <br/> <span className="text-sm text-muted-foreground">{entry.resizedWidth}x{entry.resizedHeight}</span></TableCell>
                                        <TableCell>{format(entry.timestamp.toDate(), "PP")}</TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild size="sm">
                                                <a href={entry.resizedImageUrl} download={entry.fileName}>
                                                    <Download className="mr-2" /> Download
                                                </a>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
