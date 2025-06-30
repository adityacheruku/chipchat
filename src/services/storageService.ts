
"use client";

import Dexie, { type Table } from 'dexie';
import type { UploadItem, MessageSubtype, UploadError } from '@/types';

// Helper to convert ArrayBuffer back to File
const bufferToFile = (buffer: ArrayBuffer, filename: string, filetype: string): File => {
    return new File([buffer], filename, { type: filetype });
};

// Interface for the object stored in IndexedDB. We store the file as an ArrayBuffer.
export interface StoredUploadItem {
    id: string;
    file_data: ArrayBuffer;
    filename: string;
    filetype: string;
    messageId: string;
    chatId: string;
    priority: number;
    status: 'pending' | 'processing' | 'compressing' | 'uploading' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    retryCount: number;
    createdAt: Date;
    subtype: MessageSubtype;
    error?: string; // Storing error as a stringified JSON
}


export class ChirpChatDB extends Dexie {
    uploadQueue!: Table<StoredUploadItem, string>;

    constructor() {
        super('ChirpChatDB');
        this.version(1).stores({
            uploadQueue: 'id, messageId, status, priority, createdAt', // Dexie schema definition
        });
    }

    // Convert UploadItem with File to StoredUploadItem with ArrayBuffer
    private async prepareForStorage(item: UploadItem): Promise<StoredUploadItem> {
        const fileBuffer = await item.file.arrayBuffer();
        return {
            id: item.id,
            file_data: fileBuffer,
            filename: item.file.name,
            filetype: item.file.type,
            messageId: item.messageId,
            chatId: item.chatId,
            priority: item.priority,
            status: item.status,
            progress: item.progress,
            retryCount: item.retryCount,
            createdAt: item.createdAt,
            subtype: item.subtype,
            error: item.error ? JSON.stringify(item.error) : undefined,
        };
    }

    // Convert StoredUploadItem back to UploadItem
    private prepareFromStorage(item: StoredUploadItem): UploadItem {
        return {
            ...item,
            file: bufferToFile(item.file_data, item.filename, item.filetype),
            error: item.error ? JSON.parse(item.error) : undefined,
        };
    }

    async addUploadItem(item: UploadItem): Promise<void> {
        const storableItem = await this.prepareForStorage(item);
        await this.uploadQueue.add(storableItem);
    }

    async updateUploadItem(item: UploadItem): Promise<void> {
        const storableItem = await this.prepareForStorage(item);
        await this.uploadQueue.update(item.id, storableItem);
    }

    async removeUploadItem(id: string): Promise<void> {
        await this.uploadQueue.delete(id);
    }

    async getAllPendingUploads(): Promise<UploadItem[]> {
        const storedItems = await this.uploadQueue
            .where('status')
            .notEqual('completed')
            .and(item => item.status !== 'cancelled')
            .toArray();
        return storedItems.map(this.prepareFromStorage);
    }
}

// Ensure only one instance is created.
let dbInstance: ChirpChatDB | null = null;
const getDbInstance = () => {
    if (typeof window !== 'undefined') {
        if (!dbInstance) {
            dbInstance = new ChirpChatDB();
        }
        return dbInstance;
    }
    // Return a dummy object for SSR to avoid errors
    return {
        version: () => ({ stores: () => {} }),
        uploadQueue: {
            add: async () => {},
            update: async () => {},
            delete: async () => {},
            where: () => ({ notEqual: () => ({ and: () => ({ toArray: async () => [] }) }) }),
        },
        addUploadItem: async () => {},
        updateUploadItem: async () => {},
        removeUploadItem: async () => {},
        getAllPendingUploads: async () => [],
    } as unknown as ChirpChatDB;
};


export const storageService = getDbInstance();
