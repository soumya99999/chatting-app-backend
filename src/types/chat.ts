// backend/src/types/chat.ts
import { RawUser, RawMessage } from './message';

export interface Chat {
    id: string;
    chatName?: string;
    isGroupChat: boolean;
    users: RawUser[];
    latestMessage?: RawMessage | string;
    groupAdmins: RawUser[]; // Changed to array
    groupIcon?: string;
    description?: string;
    mutedUsers: RawUser[];
    pinnedMessages: RawMessage[];
    createdAt: string;
    updatedAt: string;
}