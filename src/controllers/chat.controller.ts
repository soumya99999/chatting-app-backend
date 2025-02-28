import { AuthRequest } from '../middlewares/authMiddleware'; // Adjust the path as necessary
import { Response } from 'express';
import Chat from '../models/Chat';
import User from '../models/User';


// Access or create one-to-one chat
export const accessChat = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.body;

    if (!userId) {
        res.status(400).json({ message: "User Id param not sent with request" });
        return;
    }

    // console.log('Current User ID:', req.user._id);
    // console.log('User  ID from Request:', userId);

    try {
        // Find a chat where both users are present
        let chat = await Chat.findOne({
            isGroupChat: false,
            $or: [
                { users: { $all: [req.user._id, userId] } },
                { users: { $all: [userId, req.user._id] } }
            ], // Check if both users are in the chat

        })
        .populate('users', '-password')
        .populate('latestMessage');

        if (chat) {
            res.status(200).json(chat);
            return;
        }

        // Create new chat if it doesn't exist
        const chatData = {
            chatName: "one to one Chat", // You might want to set this to a meaningful name
            isGroupChat: false,
            users: [req.user._id, userId], // Ensure both user IDs are set correctly
        };

        chat = await Chat.create(chatData);
        chat = await chat.populate('users', '-password');

        res.status(201).json(chat);
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
            .populate('groupAdmin', '-password')
            .populate('latestMessage')
            .sort({ updatedAt: -1 });

        res.status(200).json(chats);
    } catch (error) {
        res.status(500).json({ message: "Error fetching chats" });
    }
};

// Create group chat
export const createGroupChat = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { users, name } = req.body;

        if (!users || !name) {
            res.status(400).json({ message: "Please fill all the fields" });
            return;
        }

        let parsedUsers = JSON.parse(users);
        if (parsedUsers.length < 2) {
            res.status(400).json({ message: "More than 2 users required for group chat" });
            return;
        }

        // Add current user to group
        parsedUsers.push(req.user);

        const groupChat = await Chat.create({
            chatName: name,
            users: parsedUsers,
            isGroupChat: true,
            groupAdmin: req.user,
        });

        const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
            .populate('users', '-password')
            .populate('groupAdmin', '-password');

        res.status(201).json(fullGroupChat);
    } catch (error) {
        res.status(500).json({ message: "Error creating group chat" });
    }
};
