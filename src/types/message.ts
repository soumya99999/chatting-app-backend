// backend/src/types/message.ts
export interface RawUser {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
    isGroupChat:boolean;
}

export interface RawReaction {
    user: RawUser;
    emoji: string;
}

export interface RawMessage {
    _id: string;
    chat: {
        _id: string;
        users: RawUser[];
    };
    sender: RawUser;
    content: string;
    contentType: 'text' | 'sticker' | 'gif';
    deliveredBy: string[];
    readBy: string[];
    isRead: boolean;
    mentions: string[];
    replyTo?: RawMessage;
    reactions: RawReaction[];
    createdAt: string;
    updatedAt: string;
}

export interface Message {
    _id: string;
    chatId: string;
    senderId: string;
    sender: RawUser;
    content: string;
    contentType: 'text' | 'sticker' | 'gif';
    deliveredBy: string[];
    readBy: string[];
    isRead: boolean;
    mentions: string[];
    replyTo?: string;
    reactions: RawReaction[];
    timestamp: Date;
    chat?: {
        _id: string;
        users: RawUser[];
    };
}