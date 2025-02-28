import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
    chatName: string;
    isGroupChat: boolean;
    users: mongoose.Types.ObjectId[];
    latestMessage?: mongoose.Types.ObjectId;
    groupAdmin?: mongoose.Types.ObjectId;
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
    groupAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }
}, { timestamps: true });

export default mongoose.model<IChat>('Chat', chatSchema);
