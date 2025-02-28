// backend/src/models/message.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMessage extends Document {
    sender: Types.ObjectId; // Use Types.ObjectId for runtime operations
    content: string;
    chat: Types.ObjectId;
    deliveredBy: Types.ObjectId[]; // Track delivery (double gray ticks)
    readBy: Types.ObjectId[]; // Track read (blue double ticks)
    isRead: boolean;
    contentType: 'text' | 'sticker' | 'gif';
    createdAt: Date; // Add createdAt for timestamps
    updatedAt: Date; // Add updatedAt for timestamps
}

const messageSchema = new Schema({
    sender: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    content: { type: String, trim: true, required: true },
    chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    deliveredBy: [{ type: Schema.Types.ObjectId, ref: 'user', default: [] }], // New field
    readBy: [{ type: Schema.Types.ObjectId, ref: 'user', default: [] }],
    isRead: { type: Boolean, default: false },
    contentType: { type: String, enum: ['text', 'sticker', 'gif'], default: 'text' }
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', messageSchema);