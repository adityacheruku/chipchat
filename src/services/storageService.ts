
"use client";

import Dexie, { type Table } from 'dexie';
import type { UploadItem, MessageSubtype, Message, Chat, User } from '@/types';

// Interface for the object stored in IndexedDB for uploads. We store the file as an ArrayBuffer.
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
    error?: string;
}

export class ChirpChatDB extends Dexie {
    // Define tables
    chats!: Table<Chat, string>;
    messages!: Table<Message, string>;
    users!: Table<User, string>;
    uploadQueue!: Table<StoredUploadItem, string>;

    constructor() {
        super('ChirpChatDB');
        
        // This schema was faulty (used 'chatId', '++' on string). Keeping it here allows Dexie to handle upgrades
        // from users who might have this version of the database.
        this.version(2).stores({
            chats: 'id, updated_at',
            messages: '++client_temp_id, id, chatId, created_at, [chatId+created_at]',
            users: 'id',
            uploadQueue: 'id, messageId, status, priority, createdAt',
        });

        // Version 3 fixes the schema for the 'messages' table.
        this.version(3).stores({
            // We only need to define the changed table. Others are inherited.
            messages: 'client_temp_id, id, chat_id, created_at, [chat_id+created_at]',
        }).upgrade(async tx => {
            // This upgrade function is transactional and will only run once for each user
            // when their browser sees version 3 for the first time.
            // Its purpose is to migrate the data from the old schema to the new one.
            return tx.table('messages').toCollection().modify(msg => {
                // Rename the 'chatId' property to 'chat_id' to match the new index.
                if (typeof msg.chatId !== 'undefined') {
                    msg.chat_id = msg.chatId;
                    delete msg.chatId;
                }
                // The primary key change from '++client_temp_id' to 'client_temp_id'
                // is handled automatically by the new schema definition.
            });
        });
    }

    // CHAT METHODS
    async getChat(chatId: string): Promise<Chat | undefined> {
        return this.chats.get(chatId);
    }
    async addChat(chat: Chat): Promise<void> {
        await this.chats.put(chat);
    }
    async getChats(): Promise<Chat[]> {
        return this.chats.orderBy('updated_at').reverse().toArray();
    }
     async getChatWithParticipants(chatId: string): Promise<Chat | undefined> {
        const chat = await this.chats.get(chatId);
        if (chat) {
            const participantIds = chat.participants.map(p => p.id);
            const participants = await this.users.where('id').anyOf(participantIds).toArray();
            chat.participants = participants;
        }
        return chat;
    }


    // MESSAGE METHODS
    async getMessagesForChat(chatId: string, limit: number, before?: Date): Promise<Message[]> {
        let query = this.messages.where('chat_id').equals(chatId);
        if (before) {
            query = query.and(msg => new Date(msg.created_at) < before);
        }
        return query.reverse().limit(limit).toArray();
    }
    async addMessage(message: Message): Promise<void> {
        await this.messages.put(message);
        // Also update the chat's last_message and updated_at
        const chat = await this.getChat(message.chat_id);
        if(chat) {
          chat.last_message = message;
          chat.updated_at = message.updated_at;
          await this.addChat(chat);
        }
    }
    async bulkAddMessages(messages: Message[]): Promise<void> {
        await this.messages.bulkPut(messages);
    }
    async updateMessage(clientTempId: string, changes: Partial<Message>): Promise<void> {
        await this.messages.update(clientTempId, changes);
    }
     async deleteMessage(clientTempId: string): Promise<void> {
        await this.messages.delete(clientTempId);
    }


    // USER METHODS
    async upsertUser(user: User): Promise<void> {
        await this.users.put(user);
    }
     async getUser(userId: string): Promise<User | undefined> {
        return this.users.get(userId);
    }
    async bulkUpsertUsers(users: User[]): Promise<void> {
        await this.users.bulkPut(users);
    }


    // UPLOAD QUEUE METHODS
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

    private prepareFromStorage(item: StoredUploadItem): UploadItem {
        return {
            ...item,
            file: new File([item.file_data], item.filename, { type: item.filetype }),
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

let dbInstance: ChirpChatDB | null = null;
const getDbInstance = (): ChirpChatDB => {
    if (typeof window !== 'undefined') {
        if (!dbInstance) {
            dbInstance = new ChirpChatDB();
        }
        return dbInstance;
    }
    // Return a dummy object for SSR
    return new Proxy({}, { get: () => () => Promise.resolve() }) as unknown as ChirpChatDB;
};

export const storageService = getDbInstance();
