import { Request, Response, RequestHandler } from "express";
import User, { DEFAULT_PROFILE_PICTURE } from "../models/User";
import {AuthRequest} from '../middlewares/authMiddleware'

export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const searchQuery = req.query.q as string;
        const currentUserId = req.user;

        if (!searchQuery) {
            res.status(400).json({
                success: false,
                message: "Search query is required"
            });
            return;
        }

        // Search users by name or email, excluding the current user
        const users = await User.find({
            $and: [
                { _id: { $ne: currentUserId } }, // Exclude current user
                {
                    $or: [
                        { name: { $regex: searchQuery, $options: 'i' } }, // Case-insensitive name search
                        { email: { $regex: searchQuery, $options: 'i' } } // Case-insensitive email search
                    ]
                }
            ]
        })
        .select('name email profilePicture') // Only select necessary fields
        .limit(10); // Limit results to 10 users

        res.status(200).json({
            success: true,
            message: users.length ? "Users found" : "No users found",
            users: users.map(user => ({
                id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture
            }))
        });

    } catch (error) {
        console.error("Search users error:", error);
        res.status(500).json({
            success: false,
            message: "Error searching users"
        });
    }
};

// Add this new controller function
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user;
        
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
            return;
        }

        const user = await User.findById(userId)
            .select('-password -otp -otpExpiration -googleId'); // Exclude sensitive fields

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture || DEFAULT_PROFILE_PICTURE
            }
        });
    } catch (error) {
        console.error("Get current user error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching user profile"
        });
    }
};

export const fetchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ 
                success: false,
                message: "Unauthorized: No user ID found" 
            });
            return;
        }

        const suggestedUsers = await User.find({ 
            _id: { $ne: req.user },
        })
        .select('name email profilePicture')
        .limit(20) // Limit to 20 users for better performance
        .lean();

        res.status(200).json({ 
            success: true, 
            message: suggestedUsers.length ? "Users fetched successfully" : "No other users found",
            users: suggestedUsers.map(user => ({
                id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture || DEFAULT_PROFILE_PICTURE
            }))
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error" 
        });
    }
};