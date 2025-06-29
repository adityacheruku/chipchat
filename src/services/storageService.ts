"use client";

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { JeepSqlite } from 'jeep-sqlite/dist/components/jeep-sqlite';
import type { UploadItem } from '@/types';

// Define the web component for the web platform
if (typeof window !== 'undefined' && !customElements.get('jeep-sqlite')) {
    customElements.define('jeep-sqlite', JeepSqlite);
}

const DB_NAME = 'chirpchat_uploads';
const UPLOAD_QUEUE_TABLE = 'upload_queue';

class StorageService {
    private db: SQLiteDBConnection | null = null;
    private isInitialized = false;
    private platform: string;
    private sqlite = new SQLiteConnection(CapacitorSQLite);

    constructor() {
        this.platform = Capacitor.getPlatform();
    }

    private async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            if (this.platform === 'web') {
                const jeepSqliteEl = document.createElement('jeep-sqlite');
                document.body.appendChild(jeepSqliteEl);
                await customElements.whenDefined('jeep-sqlite');
                await this.sqlite.initWebStore();
            }

            const ret = await this.sqlite.checkConnectionsConsistency();
            const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;

            if (ret.result && isConn) {
                this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
            } else {
                this.db = await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
            }
            await this.open();
            this.isInitialized = true;
            console.log("StorageService: Initialized successfully on platform:", this.platform);
        } catch (err) {
            console.error("StorageService: Initialization failed", err);
            // As a fallback for web environments where SQLite might fail, we could use IndexedDB here.
            // For now, we throw to indicate a critical failure.
            throw err;
        }
    }

    private async open(): Promise<void> {
        if (!this.db) throw new Error("Database not initialized");
        await this.db.open();
        const query = `
            CREATE TABLE IF NOT EXISTS ${UPLOAD_QUEUE_TABLE} (
                id TEXT PRIMARY KEY NOT NULL,
                file_data BLOB NOT NULL,
                filename TEXT NOT NULL,
                filetype TEXT NOT NULL,
                messageId TEXT NOT NULL,
                chatId TEXT NOT NULL,
                priority INTEGER NOT NULL,
                status TEXT NOT NULL,
                progress INTEGER NOT NULL,
                retryCount INTEGER NOT NULL,
                createdAt TEXT NOT NULL,
                subtype TEXT NOT NULL,
                error TEXT
            );
        `;
        await this.db.execute(query);
    }
    
    private getDB = async (): Promise<SQLiteDBConnection> => {
        if (!this.isInitialized) await this.initialize();
        if (!this.db) throw new Error("Database connection failed.");
        return this.db;
    }
    
    private fileToBuffer = (file: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }

    public addUploadItem = async (item: UploadItem): Promise<void> => {
        const db = await this.getDB();
        const fileBuffer = await this.fileToBuffer(item.file);
        const query = `INSERT INTO ${UPLOAD_QUEUE_TABLE} (id, file_data, filename, filetype, messageId, chatId, priority, status, progress, retryCount, createdAt, subtype, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        await db.run(query, [item.id, fileBuffer, item.file.name, item.file.type, item.messageId, item.chatId, item.priority, item.status, item.progress, item.retryCount, item.createdAt.toISOString(), item.subtype, item.error ? JSON.stringify(item.error) : null]);
    }

    public updateUploadItem = async (item: UploadItem): Promise<void> => {
        const db = await this.getDB();
        const fileBuffer = await this.fileToBuffer(item.file);
        const query = `UPDATE ${UPLOAD_QUEUE_TABLE} SET file_data = ?, status = ?, progress = ?, retryCount = ?, error = ? WHERE id = ?;`;
        await db.run(query, [fileBuffer, item.status, item.progress, item.retryCount, item.error ? JSON.stringify(item.error) : null, item.id]);
    }

    public removeUploadItem = async (id: string): Promise<void> => {
        const db = await this.getDB();
        const query = `DELETE FROM ${UPLOAD_QUEUE_TABLE} WHERE id = ?;`;
        await db.run(query, [id]);
    }

    public getAllPendingUploads = async (): Promise<UploadItem[]> => {
        const db = await this.getDB();
        const query = `SELECT * FROM ${UPLOAD_QUEUE_TABLE} WHERE status != 'completed' AND status != 'cancelled';`;
        const res = await db.query(query);

        return (res.values || []).map(row => {
            const file = new File([new Blob([row.file_data])], row.filename, { type: row.filetype });
            return {
                id: row.id,
                file: file,
                messageId: row.messageId,
                chatId: row.chatId,
                priority: row.priority,
                status: row.status,
                progress: row.progress,
                retryCount: row.retryCount,
                createdAt: new Date(row.createdAt),
                subtype: row.subtype,
                error: row.error ? JSON.parse(row.error) : undefined,
            };
        });
    }
}
export const storageService = new StorageService();
