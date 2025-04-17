// backend/src/models/Message.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReaction {
    user: Types.ObjectId;
    emoji: string;
}

export interface IMessage extends Document {
    sender: Types.ObjectId;
    content: string;
    chat: Types.ObjectId;
    deliveredBy: Types.ObjectId[];
    readBy: Types.ObjectId[];
    isRead: boolean;
    contentType: 'text' | 'sticker' | 'gif';
    mentions: Types.ObjectId[]; // Users mentioned in the message
    replyTo?: Types.ObjectId; // Message being replied to
    reactions: IReaction[]; // Reactions on the message
    createdAt: Date;
    updatedAt: Date;
}

const messageSchema = new Schema({
    sender: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    content: { type: String, trim: true, required: true },
    chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    deliveredBy: [{ type: Schema.Types.ObjectId, ref: 'user', default: [] }],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'user', default: [] }],
    isRead: { type: Boolean, default: false },
    contentType: { type: String, enum: ['text', 'sticker', 'gif'], default: 'text' },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'user', default: [] }],
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    reactions: [{
        user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
        emoji: { type: String, required: true }
    }]
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', messageSchema);