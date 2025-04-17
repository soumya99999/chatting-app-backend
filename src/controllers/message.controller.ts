// backend/src/controllers/message.controller.ts
import { AuthRequest } from '../middlewares/authMiddleware';
import asyncHandler from 'express-async-handler';
import { Response } from 'express';
import Message, { IMessage } from '../models/Message';
import Chat from '../models/Chat';
import { Types, ObjectId } from 'mongoose';
import { Message as FrontendMessage, RawUser } from '../types/message';

export const fetchMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId } = req.params;
    
    try {
        const messages = await Message.find({ chat: chatId })
            .populate('sender', '_id name email profilePicture')
            .populate('chat')
            .populate('replyTo', 'content sender')
            .sort({ createdAt: 1 });

        if (!messages.length) {
            res.status(200).json({ messages: [], message: "No messages found for this chat." });
            return;
        }

        res.status(200).json(messages);
    } catch (error: any) {
        console.error('Error fetching chat history:', error.message);
        res.status(500).json({ message: "Error retrieving chat history" });
    }
};

export const sendMessage = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId, content, contentType, mentions, replyTo } = req.body;
    const sender = req.user;

    if (!chatId || !content) {
        console.log("Invalid data passed into request");
        res.status(400).json({ message: "Chat ID and content are required." });
        return;
    }

    try {
        const chat = await Chat.findById(chatId).populate('users', '_id');
        if (!chat) {
            res.status(404).json({ message: "Chat not found." });
            return;
        }

        // Check if the user is muted (for group chats)
        if (chat.isGroupChat && chat.mutedUsers.some(user => user.toString() === sender._id.toString())) {
            res.status(403).json({ message: "You are muted and cannot send messages in this group." });
            return;
        }

        // Validate mentions
        let validatedMentions: Types.ObjectId[] = [];
        if (mentions && Array.isArray(mentions)) {
            validatedMentions = mentions.filter((userId: string) => 
                chat.users.some(user => user._id.toString() === userId)
            ).map((userId: string) => new Types.ObjectId(userId));
        }

        // Validate replyTo
        let validatedReplyTo: Types.ObjectId | undefined;
        if (replyTo && Types.ObjectId.isValid(replyTo)) {
            const replyMessage = await Message.findById(replyTo);
            if (replyMessage && replyMessage.chat.toString() === chatId) {
                validatedReplyTo = new Types.ObjectId(replyTo);
            }
        }

        console.log("Creating new message with content:", content, "type:", contentType);
        const newMessage = await Message.create({
            chat: chatId,
            sender: sender._id,
            content,
            contentType: contentType || 'text',
            deliveredBy: [sender._id],
            readBy: [sender._id],
            isRead: false,
            mentions: validatedMentions,
            replyTo: validatedReplyTo,
            reactions: []
        });

        const populatedMessage = await Message.findById(newMessage._id)
            .populate('sender', '_id name email profilePicture')
            .populate({
                path: 'chat',
                select: 'users',
                populate: {
                    path: 'users',
                    select: '_id name email profilePicture'
                }
            })
            .populate('replyTo', 'content sender')
            .lean();

        await Chat.findByIdAndUpdate(chatId, { latestMessage: newMessage._id });

        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('new message', {
                _id: newMessage._id?.toString(),
                chatId,
                senderId: sender._id.toString(),
                sender: populatedMessage?.sender,
                content,
                contentType: contentType || 'text',
                timestamp: newMessage.createdAt,
                deliveredBy: [sender._id.toString()],
                readBy: [sender._id.toString()],
                isRead: false,
                mentions: validatedMentions.map(id => id.toString()),
                replyTo: validatedReplyTo?.toString(),
                reactions: []
            });

            // Notify mentioned users
            validatedMentions.forEach(userId => {
                io.to(userId.toString()).emit('mentioned in message', {
                    messageId: newMessage._id?.toString(),
                    chatId,
                    senderId: sender._id.toString(),
                    content
                });
            });

            console.log("New message emitted for broadcasting to chat room:", JSON.stringify(populatedMessage, null, 2));
        }

        res.status(201).json(populatedMessage);
    } catch (error: any) {
        console.error('Send message error:', error.message);
        res.status(500).json({ message: "Error sending message." });
    }
});

export const markMessageDelivered = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { messageId } = req.params;
    const { userId } = req.body;

    console.log("Marking message as delivered:", { messageId, userId });

    if (!messageId || !Types.ObjectId.isValid(messageId)) {
        console.error("Invalid message ID:", messageId);
        res.status(400).json({ message: "Invalid message ID." });
        return;
    }

    try {
        const message = await Message.findById(messageId);
        if (!message) {
            console.error("Message not found:", messageId);
            res.status(404).json({ message: "Message not found." });
            return;
        }

        if (!message.deliveredBy.some(id => id.toString() === userId)) {
            message.deliveredBy.push(userId);
            
            const chat = await Chat.findById(message.chat).populate('users', '_id');
            if (chat && !chat.isGroupChat) {
                const otherUser = chat.users.find(user => user._id.toString() !== userId);
                if (otherUser) {
                    message.isRead = message.deliveredBy.some(id => id.toString() === otherUser._id.toString());
                }
            }
        }

        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(message.chat.toString()).emit('message delivered', {
                messageId,
                chatId: message.chat.toString(),
                userId,
                deliveredBy: message.deliveredBy,
                readBy: message.readBy,
                isRead: message.isRead
            });
            console.log("Message delivered status emitted:", { messageId, chatId: message.chat.toString(), userId });
        }

        res.status(200).json({ message: "Message marked as delivered", updatedMessage: message });
    } catch (error: any) {
        console.error('Error marking message as delivered:', error.message);
        res.status(500).json({ message: "Error updating message status." });
    }
});

export const searchMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    const { query } = req.query;
    const { chatId } = req.params;

    console.log('Searching messages with query:', query);

    try {
        const messages = await Message.find({
            chat: chatId,
            content: { $regex: query, $options: 'i' },
        }).populate('sender', 'name email');

        console.log('Found messages:', messages);

        res.status(200).json(messages);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const markMessageAsRead = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    console.log("Received request to mark message as read:", req.params.messageId);

    const { messageId } = req.params;
    const userId = req.user._id.toString();

    if (!messageId || !Types.ObjectId.isValid(messageId)) {
        res.status(400).json({ message: "Invalid message ID." });
        return;
    }

    try {
        const message = await Message.findById(messageId as string);
        console.log("Found message:", message);

        if (!message) {
            res.status(404).json({ message: "Message not found." });
            return;
        }

        if (!message.readBy.some(id => id.toString() === userId)) {
            message.readBy.push(userId);
        }

        const chat = await Chat.findById(message.chat).populate('users');
        if (chat && !chat.isGroupChat) {
            const otherUser = chat.users.find(user => user._id.toString() !== userId);
            if (otherUser) {
                message.isRead = message.readBy.some(id => id.toString() === otherUser._id.toString());
            }
        } else {
            message.isRead = chat?.users.every(user => 
                message.readBy.some(id => id.toString() === user._id.toString())
            ) || false;
        }

        await message.save();

        const chatId = message.chat.toString();
        console.log("Chat ID associated with the message:", chatId);

        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('message status update', {
                messageId,
                chatId,
                userId,
                deliveredBy: message.deliveredBy,
                readBy: message.readBy,
                isRead: message.isRead
            });
            console.log("Message status updated and emitted:", { messageId, chatId, userId });
        }

        res.status(200).json({ message: "Message marked as read", updatedMessage: message });
    } catch (error: any) {
        console.error('Error marking message as read:', error.message);
        res.status(500).json({ message: "Error updating read status." });
    }
});

// Pin a message
export const pinMessage = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { messageId } = req.params;

    if (!messageId || !Types.ObjectId.isValid(messageId)) {
        res.status(400).json({ message: "Invalid message ID." });
        return;
    }

    try {
        const message = await Message.findById(messageId);
        if (!message) {
            res.status(404).json({ message: "Message not found." });
            return;
        }

        const chat = await Chat.findById(message.chat);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found." });
            return;
        }

        // Check if the requester is an admin
        if (!chat.groupAdmins.some(admin => admin.toString() === req.user._id.toString())) {
            res.status(403).json({ message: "Only admins can pin messages." });
            return;
        }

        // Pin the message
        if (!chat.pinnedMessages.some(id => id.toString() === messageId)) {
            chat.pinnedMessages.push(new Types.ObjectId(messageId));
            await chat.save();
        }

        const io = req.app.get('io');
        if (io) {
            io.to(chat._id).emit('message pinned', { chatId: chat._id, messageId });
        }

        res.status(200).json({ message: "Message pinned successfully" });
    } catch (error: any) {
        console.error('Error pinning message:', error.message);
        res.status(500).json({ message: "Error pinning message." });
    }
});

// Unpin a message
export const unpinMessage = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { messageId } = req.params;

    if (!messageId || !Types.ObjectId.isValid(messageId)) {
        res.status(400).json({ message: "Invalid message ID." });
        return;
    }

    try {
        const message = await Message.findById(messageId);
        if (!message) {
            res.status(404).json({ message: "Message not found." });
            return;
        }

        const chat = await Chat.findById(message.chat);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found." });
            return;
        }

        // Check if the requester is an admin
        if (!chat.groupAdmins.some(admin => admin.toString() === req.user._id.toString())) {
            res.status(403).json({ message: "Only admins can unpin messages." });
            return;
        }

        // Unpin the message
        chat.pinnedMessages = chat.pinnedMessages.filter(id => id.toString() !== messageId);
        await chat.save();

        const io = req.app.get('io');
        if (io) {
            io.to(chat._id).emit('message unpinned', { chatId: chat._id, messageId });
        }

        res.status(200).json({ message: "Message unpinned successfully" });
    } catch (error: any) {
        console.error('Error unpinning message:', error.message);
        res.status(500).json({ message: "Error unpinning message." });
    }
});

// Add a reaction to a message
export const addReaction = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!messageId || !Types.ObjectId.isValid(messageId)) {
        res.status(400).json({ message: "Invalid message ID." });
        return;
    }

    if (!emoji || typeof emoji !== 'string') {
        res.status(400).json({ message: "Emoji is required." });
        return;
    }

    try {
        const message = await Message.findById(messageId);
        if (!message) {
            res.status(404).json({ message: "Message not found." });
            return;
        }

        // Add or update the reaction
        const existingReaction = message.reactions.find(reaction => 
            reaction.user.toString() === req.user._id.toString()
        );

        if (existingReaction) {
            existingReaction.emoji = emoji;
        } else {
            message.reactions.push({ user: req.user._id, emoji });
        }

        await message.save();

        const populatedMessage = await Message.findById(messageId)
            .populate('sender', '_id name email profilePicture')
            .populate('replyTo', 'content sender');

        const io = req.app.get('io');
        if (io) {
            io.to(message.chat.toString()).emit('message reaction updated', {
                messageId,
                chatId: message.chat.toString(),
                userId: req.user._id.toString(),
                emoji,
                reactions: populatedMessage?.reactions
            });
        }

        res.status(200).json({ message: "Reaction added successfully", updatedMessage: populatedMessage });
    } catch (error: any) {
        console.error('Error adding reaction:', error.message);
        res.status(500).json({ message: "Error adding reaction." });
    }
});

// Remove a reaction from a message
export const removeReaction = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { messageId } = req.params;

    if (!messageId || !Types.ObjectId.isValid(messageId)) {
        res.status(400).json({ message: "Invalid message ID." });
        return;
    }

    try {
        const message = await Message.findById(messageId);
        if (!message) {
            res.status(404).json({ message: "Message not found." });
            return;
        }

        // Remove the reaction
        message.reactions = message.reactions.filter(reaction => 
            reaction.user.toString() !== req.user._id.toString()
        );

        await message.save();

        const populatedMessage = await Message.findById(messageId)
            .populate('sender', '_id name email profilePicture')
            .populate('replyTo', 'content sender');

        const io = req.app.get('io');
        if (io) {
            io.to(message.chat.toString()).emit('message reaction updated', {
                messageId,
                chatId: message.chat.toString(),
                userId: req.user._id.toString(),
                emoji: null,
                reactions: populatedMessage?.reactions
            });
        }

        res.status(200).json({ message: "Reaction removed successfully", updatedMessage: populatedMessage });
    } catch (error: any) {
        console.error('Error removing reaction:', error.message);
        res.status(500).json({ message: "Error removing reaction." });
    }
});