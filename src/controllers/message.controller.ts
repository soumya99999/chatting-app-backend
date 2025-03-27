import { AuthRequest } from '../middlewares/authMiddleware';
import asyncHandler from 'express-async-handler';
import { Response } from 'express';
import Message, { IMessage } from '../models/Message';
import Chat from '../models/Chat';
import { Types, ObjectId } from 'mongoose';
import { Message as FrontendMessage, RawUser } from '../types/message'

export const fetchMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId } = req.params;
    
    try {
        const messages = await Message.find({ chat: chatId })
            .populate('sender', '_id name email profilePicture')
            .populate('chat')
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
    const { chatId, content, contentType } = req.body;
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
            return; // Return explicitly
        }

        console.log("Creating new message with content:", content, "type:", contentType);
        const newMessage = await Message.create({
            chat: chatId,
            sender: sender._id,
            content,
            contentType: contentType || 'text', // Default to 'text' if not provided
            deliveredBy: [sender._id], // Initially delivered to sender
            readBy: [sender._id], // Initially read by sender
            isRead: false // Will be updated when recipient reads
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
            }).lean();

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
                deliveredBy: [sender._id.toString()], // Initially delivered to sender
                readBy: [sender._id.toString()], // Initially read by sender
                isRead: false
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

    // Check if messageId is defined and valid
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

        // Update the message status to delivered
        if (!message.deliveredBy.some(id => id.toString() === userId)) {
            message.deliveredBy.push(userId);
            
            // Get the chat to check if this is a one-to-one chat
            const chat = await Chat.findById(message.chat).populate('users', '_id');
            if (chat && !chat.isGroupChat) {
                // For one-to-one chats, only mark as read if the recipient has delivered it
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

    console.log('Searching messages with query:', query); // Log the query

    try {
        const messages = await Message.find({
            chat: chatId,
            content: { $regex: query, $options: 'i' },
        }).populate('sender', 'name email');

        console.log('Found messages:', messages); // Log the found messages

        res.status(200).json(messages);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const markMessageAsRead = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    console.log("Received request to mark message as read:", req.params.messageId);

    const { messageId } = req.params;
    const userId = req.user._id.toString(); 

    // Check if messageId is defined and valid
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

        // Update readBy to include the current user
        if (!message.readBy.some(id => id.toString() === userId)) {
            message.readBy.push(userId);
        }

        // For one-to-one chats, set isRead if the recipient has read it
        const chat = await Chat.findById(message.chat).populate('users');
        if (chat && !chat.isGroupChat) {
            const otherUser = chat.users.find(user => user._id.toString() !== userId);
            if (otherUser) {
                message.isRead = message.readBy.some(id => id.toString() === otherUser._id.toString());
            }
        } else {
            // For group chats, mark as read if all users have read it
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
