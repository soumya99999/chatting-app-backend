// backend/src/models/Chat.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
    chatName: string;
    isGroupChat: boolean;
    users: mongoose.Types.ObjectId[];
    latestMessage?: mongoose.Types.ObjectId;
    groupAdmins: mongoose.Types.ObjectId[]; // Changed to array for multiple admins
    groupIcon?: string; // URL to group icon
    description?: string; // Group description
    mutedUsers: mongoose.Types.ObjectId[]; // Users who are muted
    pinnedMessages: mongoose.Types.ObjectId[]; // Pinned messages
    createdAt: Date;
    updatedAt: Date;
}

const chatSchema = new Schema({
    chatName: { type: String, trim: true },
    isGroupChat: { type: Boolean, default: false },
    users: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user' 
    }],
    latestMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    groupAdmins: [{ // Changed to array
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }],
    groupIcon: { type: String, default: '' }, // Default to empty string
    description: { type: String, default: '' }, // Default to empty string
    mutedUsers: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user',
        default: []
    }],
    pinnedMessages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: []
    }]
}, { timestamps: true });

export default mongoose.model<IChat>('Chat', chatSchema);