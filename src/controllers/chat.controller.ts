// backend/src/controllers/chat.controller.ts
import { AuthRequest } from '../middlewares/authMiddleware';
import { Response } from 'express';
import Chat from '../models/Chat';
import User from '../models/User';

// Access or create one-to-one chat
export const accessChat = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId, chatId } = req.body;

    // Validate input
    if (!userId && !chatId) {
        res.status(400).json({ message: "User ID or Chat ID is required" });
        return;
    }

    try {
        let chat;

        if (chatId) {
            // Access an existing chat (one-to-one or group) by chatId
            chat = await Chat.findOne({ _id: chatId, users: req.user._id })
                .populate('users', '-password')
                .populate('groupAdmins', '-password')
                .populate('latestMessage');
            if (!chat) {
                res.status(404).json({ message: "Chat not found or you are not a member" });
                return;
            }
            if (!chat.users.some(user => user._id.toString() === req.user._id.toString())) {
                res.status(403).json({ message: "You are not a member of this chat" });
                return;
            }
        } else if (userId) {
            // Validate userId
            const targetUser = await User.findById(userId);
            if (!targetUser) {
                res.status(400).json({ message: "Invalid user ID" });
                return;
            }

            // Access or create a one-to-one chat
            chat = await Chat.findOne({
                isGroupChat: false,
                $or: [
                    { users: { $all: [req.user._id, userId] } },
                    { users: { $all: [userId, req.user._id] } }
                ],
            })
                .populate('users', '-password')
                .populate('latestMessage');

            if (chat) {
                res.status(200).json(chat);
                return;
            }

            const chatData = {
                chatName: "One-to-One Chat",
                isGroupChat: false,
                users: [req.user._id, userId],
            };

            chat = await Chat.create(chatData);
            chat = await chat.populate('users', '-password');
        }

        res.status(chat ? 200 : 201).json(chat);
    } catch (error) {
        console.error('Error accessing chat:', error);
        res.status(500).json({ message: "Error accessing chat" });
    }
};

// Get all chats for a user
export const fetchChats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const chats = await Chat.find({ users: req.user })
            .populate('users', '-password')
            .populate('groupAdmins', '-password')
            .populate('latestMessage')
            .sort({ updatedAt: -1 });

        res.status(200).json(chats);
    } catch (error) {
        res.status(500).json({ message: "Error fetching chats" });
    }
};

