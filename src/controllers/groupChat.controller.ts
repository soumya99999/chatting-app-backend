// backend/src/controllers/groupChat.controller.ts
import { AuthRequest } from '../middlewares/authMiddleware';
import { Response } from 'express';
import Chat from '../models/Chat';
import User from '../models/User';
import { Types } from 'mongoose';

// Creating group chat
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
            groupAdmins: [req.user], // Initialize with creator as the first admin
        });

        const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
            .populate('users', '-password')
            .populate('groupAdmins', '-password');

        res.status(201).json(fullGroupChat);
    } catch (error) {
        res.status(500).json({ message: "Error creating group chat" });
    }
};

// Update group information (name, icon, description)
export const updateGroupInfo = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId, chatName, groupIcon, description } = req.body;

    if (!chatId) {
        res.status(400).json({ message: "Chat ID is required" });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found" });
            return;
        }

        // Check if the user is an admin
        if (!chat.groupAdmins.some(admin => admin.toString() === req.user._id.toString())) {
            res.status(403).json({ message: "Only admins can update group info" });
            return;
        }

        // Update fields if provided
        if (chatName) chat.chatName = chatName;
        if (groupIcon) chat.groupIcon = groupIcon;
        if (description) chat.description = description;

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('users', '-password')
            .populate('groupAdmins', '-password');

        // Emit update to group members
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('group info updated', updatedChat);
        }

        res.status(200).json(updatedChat);
    } catch (error: any) {
        console.error('Error updating group info:', error.message);
        res.status(500).json({ message: "Error updating group info" });
    }
};

// Add members to the group
export const addMembers = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId, userIds } = req.body;

    if (!chatId || !userIds || !Array.isArray(userIds)) {
        res.status(400).json({ message: "Chat ID and user IDs are required" });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found" });
            return;
        }

        // Check if the user is an admin
        if (!chat.groupAdmins.some(admin => admin.toString() === req.user._id.toString())) {
            res.status(403).json({ message: "Only admins can add members" });
            return;
        }

        // Validate user IDs
        const users = await User.find({ _id: { $in: userIds } });
        if (users.length !== userIds.length) {
            res.status(400).json({ message: "Some user IDs are invalid" });
            return;
        }

        // Add new members
        const newMembers = userIds.filter(userId => !chat.users.some(user => user.toString() === userId));
        chat.users.push(...newMembers);

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('users', '-password')
            .populate('groupAdmins', '-password');

        // Emit update to group members
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('group members updated', updatedChat);
            newMembers.forEach(userId => io.to(userId).emit('added to group', updatedChat));
        }

        res.status(200).json(updatedChat);
    } catch (error: any) {
        console.error('Error adding members:', error.message);
        res.status(500).json({ message: "Error adding members" });
    }
};

// Remove members from the group
export const removeMembers = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId, userIds } = req.body;

    if (!chatId || !userIds || !Array.isArray(userIds)) {
        res.status(400).json({ message: "Chat ID and user IDs are required" });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found" });
            return;
        }

        // Check if the user is an admin
        if (!chat.groupAdmins.some(admin => admin.toString() === req.user._id.toString())) {
            res.status(403).json({ message: "Only admins can remove members" });
            return;
        }

        // Prevent removing admins unless the requester is the creator
        const creatorId = chat.groupAdmins[0].toString();
        if (req.user._id.toString() !== creatorId) {
            const adminsToRemove = userIds.filter(userId => 
                chat.groupAdmins.some(admin => admin.toString() === userId)
            );
            if (adminsToRemove.length > 0) {
                res.status(403).json({ message: "Only the creator can remove other admins" });
                return;
            }
        }

        // Remove members
        chat.users = chat.users.filter(user => !userIds.includes(user.toString()));
        chat.mutedUsers = chat.mutedUsers.filter(user => !userIds.includes(user.toString()));
        chat.groupAdmins = chat.groupAdmins.filter(admin => !userIds.includes(admin.toString()));

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('users', '-password')
            .populate('groupAdmins', '-password');

        // Emit update to group members
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('group members updated', updatedChat);
            userIds.forEach(userId => io.to(userId).emit('removed from group', chatId));
        }

        res.status(200).json(updatedChat);
    } catch (error: any) {
        console.error('Error removing members:', error.message);
        res.status(500).json({ message: "Error removing members" });
    }
};

// Leave the group
export const leaveGroup = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId } = req.body;

    if (!chatId) {
        res.status(400).json({ message: "Chat ID is required" });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found" });
            return;
        }

        const userId = req.user._id.toString();
        const isAdmin = chat.groupAdmins.some(admin => admin.toString() === userId);

        // If the user is the last admin, they must transfer ownership or delete the group
        if (isAdmin && chat.groupAdmins.length === 1) {
            res.status(400).json({ message: "As the last admin, you must transfer ownership or delete the group before leaving" });
            return;
        }

        // Remove the user from the group
        chat.users = chat.users.filter(user => user.toString() !== userId);
        chat.mutedUsers = chat.mutedUsers.filter(user => user.toString() !== userId);
        chat.groupAdmins = chat.groupAdmins.filter(admin => admin.toString() !== userId);

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('users', '-password')
            .populate('groupAdmins', '-password');

        // Emit update to group members
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('group members updated', updatedChat);
            io.to(userId).emit('left group', chatId);
        }

        res.status(200).json({ message: "Successfully left the group", chat: updatedChat });
    } catch (error: any) {
        console.error('Error leaving group:', error.message);
        res.status(500).json({ message: "Error leaving group" });
    }
};

// Transfer ownership
export const transferOwnership = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId, newAdminId } = req.body;

    if (!chatId || !newAdminId) {
        res.status(400).json({ message: "Chat ID and new admin ID are required" });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found" });
            return;
        }

        const userId = req.user._id.toString();
        const creatorId = chat.groupAdmins[0].toString();

        // Only the creator can transfer ownership
        if (userId !== creatorId) {
            res.status(403).json({ message: "Only the creator can transfer ownership" });
            return;
        }

        // Check if the new admin is a member
        if (!chat.users.some(user => user.toString() === newAdminId)) {
            res.status(400).json({ message: "New admin must be a member of the group" });
            return;
        }

        // Transfer ownership: make the new admin the first in the groupAdmins array
        chat.groupAdmins = chat.groupAdmins.filter(admin => admin.toString() !== newAdminId);
        chat.groupAdmins.unshift(new Types.ObjectId(newAdminId));

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('users', '-password')
            .populate('groupAdmins', '-password');

        // Emit update to group members
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('group ownership transferred', updatedChat);
        }

        res.status(200).json(updatedChat);
    } catch (error: any) {
        console.error('Error transferring ownership:', error.message);
        res.status(500).json({ message: "Error transferring ownership" });
    }
};

// Promote a member to admin
export const promoteToAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
        res.status(400).json({ message: "Chat ID and user ID are required" });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found" });
            return;
        }

        // Check if the requester is an admin
        if (!chat.groupAdmins.some(admin => admin.toString() === req.user._id.toString())) {
            res.status(403).json({ message: "Only admins can promote members" });
            return;
        }

        // Check if the user is a member
        if (!chat.users.some(user => user.toString() === userId)) {
            res.status(400).json({ message: "User must be a member of the group" });
            return;
        }

        // Promote to admin
        if (!chat.groupAdmins.some(admin => admin.toString() === userId)) {
            chat.groupAdmins.push(new Types.ObjectId(userId));
        }

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('users', '-password')
            .populate('groupAdmins', '-password');

        // Emit update to group members
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('group admins updated', updatedChat);
        }

        res.status(200).json(updatedChat);
    } catch (error: any) {
        console.error('Error promoting to admin:', error.message);
        res.status(500).json({ message: "Error promoting to admin" });
    }
};

// Mute a user
export const muteUser = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
        res.status(400).json({ message: "Chat ID and user ID are required" });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found" });
            return;
        }

        // Check if the requester is an admin
        if (!chat.groupAdmins.some(admin => admin.toString() === req.user._id.toString())) {
            res.status(403).json({ message: "Only admins can mute users" });
            return;
        }

        // Check if the user is a member
        if (!chat.users.some(user => user.toString() === userId)) {
            res.status(400).json({ message: "User must be a member of the group" });
            return;
        }

        // Prevent muting admins
        if (chat.groupAdmins.some(admin => admin.toString() === userId)) {
            res.status(403).json({ message: "Cannot mute an admin" });
            return;
        }

        // Mute the user
        if (!chat.mutedUsers.some(user => user.toString() === userId)) {
            chat.mutedUsers.push(new Types.ObjectId(userId));
        }

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('users', '-password')
            .populate('groupAdmins', '-password');

        // Emit update to group members
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('group muted users updated', updatedChat);
        }

        res.status(200).json(updatedChat);
    } catch (error: any) {
        console.error('Error muting user:', error.message);
        res.status(500).json({ message: "Error muting user" });
    }
};

// Unmute a user
export const unmuteUser = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
        res.status(400).json({ message: "Chat ID and user ID are required" });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found" });
            return;
        }

        // Check if the requester is an admin
        if (!chat.groupAdmins.some(admin => admin.toString() === req.user._id.toString())) {
            res.status(403).json({ message: "Only admins can unmute users" });
            return;
        }

        // Unmute the user
        chat.mutedUsers = chat.mutedUsers.filter(user => user.toString() !== userId);

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('users', '-password')
            .populate('groupAdmins', '-password');

        // Emit update to group members
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('group muted users updated', updatedChat);
        }

        res.status(200).json(updatedChat);
    } catch (error: any) {
        console.error('Error unmuting user:', error.message);
        res.status(500).json({ message: "Error unmuting user" });
    }
};

// Delete the group
export const deleteGroup = async (req: AuthRequest, res: Response): Promise<void> => {
    const { chatId } = req.body;

    if (!chatId) {
        res.status(400).json({ message: "Chat ID is required" });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            res.status(404).json({ message: "Group chat not found" });
            return;
        }

        // Check if the requester is the creator
        const creatorId = chat.groupAdmins[0].toString();
        if (req.user._id.toString() !== creatorId) {
            res.status(403).json({ message: "Only the creator can delete the group" });
            return;
        }

        // Delete the group
        await Chat.deleteOne({ _id: chatId });

        // Emit update to group members
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('group deleted', chatId);
        }

        res.status(200).json({ message: "Group deleted successfully" });
    } catch (error: any) {
        console.error('Error deleting group:', error.message);
        res.status(500).json({ message: "Error deleting group" });
    }
};

// Fetch all groups where the user is a member
export const fetchGroups = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const groups = await Chat.find({
            users: req.user._id,
            isGroupChat: true
        })
            .populate('users', '-password')
            .populate('groupAdmins', '-password')
            .populate('latestMessage')
            .sort({ updatedAt: -1 });

        res.status(200).json(groups);
    } catch (error: any) {
        console.error('Error fetching groups:', error.message);
        res.status(500).json({ message: "Error fetching groups" });
    }
};