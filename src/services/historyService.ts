'use server';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, Timestamp, limit } from 'firebase/firestore';

export interface HistoryEntry {
    id: string;
    fileName: string;
    originalSizeKB: number;
    originalWidth: number;
    originalHeight: number;
    thumbnailUrl: string;
    resizedSizeKB: number;
    resizedWidth: number;
    resizedHeight: number;
    resizedImageUrl: string;
    timestamp: Timestamp;
}

export type HistoryEntryCreate = Omit<HistoryEntry, 'id' | 'timestamp'>

export async function addHistoryEntry(entry: HistoryEntryCreate): Promise<string> {
    const docRef = await addDoc(collection(db, "resizeHistory"), {
        ...entry,
        timestamp: serverTimestamp(),
    });
    return docRef.id;
}

export async function getHistoryEntries(): Promise<HistoryEntry[]> {
    const q = query(collection(db, "resizeHistory"), orderBy("timestamp", "desc"), limit(20));
    const querySnapshot = await getDocs(q);
    const history: HistoryEntry[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp instanceof Timestamp ? data.timestamp : new Timestamp(0,0);
        history.push({
            id: doc.id,
            fileName: data.fileName,
            originalSizeKB: data.originalSizeKB,
            originalWidth: data.originalWidth,
            originalHeight: data.originalHeight,
            thumbnailUrl: data.thumbnailUrl,
            resizedSizeKB: data.resizedSizeKB,
            resizedWidth: data.resizedWidth,
            resizedHeight: data.resizedHeight,
            resizedImageUrl: data.resizedImageUrl,
            timestamp: timestamp
        });
    });
    return history;
}
