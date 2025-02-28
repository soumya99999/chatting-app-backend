import { RawUser, RawMessage } from './message'; // Assuming message.ts exports these

export interface Chat {
    id: string; // Use _id to match Mongoose
    chatName?: string;
    isGroupChat: boolean;
    users: RawUser[]; // Array of populated user objects, not strings
    latestMessage?: RawMessage | string; // Can be a full message object or just the ID
    createdAt: string; // ISO string from Mongoose
    updatedAt: string; // ISO string from Mongoose
}