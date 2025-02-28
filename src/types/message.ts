export interface RawUser {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
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
    deliveredBy: string[]; // New field to track delivery (double gray ticks)
    readBy: string[]; // Tracks who has read the message (blue double ticks)
    isRead: boolean; // Indicates if the recipient has read the message
    createdAt: string;
    updatedAt: string;
}

export interface Message {
    _id: string;
    chatId: string; // Use chatId for consistency with frontend
    senderId: string;
    sender: RawUser;
    content: string;
    contentType: 'text' | 'sticker' | 'gif';
    deliveredBy: string[]; // Use string for frontend
    readBy: string[]; // Use string for frontend
    isRead: boolean;
    timestamp: Date; // Convert to Date on the frontend
}