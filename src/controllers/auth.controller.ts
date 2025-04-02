import { Request, Response, RequestHandler } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import nodemailer from 'nodemailer';
import cloudinary from "../Config/cloudinary";
import getDataUri from "../utils/datauri"; // Import the function

// Register a new user
export const registerUser = async (req: Request, res: Response): Promise<void> => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
        res.status(400).json({ message: "All fields are required" });
        return;
    }

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: "User already exists" });
            return;
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        let profilePictureUrl: string | null = null;

        // Check if a file was uploaded
        if (req.file) {
            // Convert uploaded file to Data URI
            const fileUri = getDataUri(req.file);
            if (fileUri) {
                // Upload to Cloudinary
                const result = await cloudinary.uploader.upload(fileUri, {
                    folder: "profile_pictures",
                    resource_type: "auto",
                });
                profilePictureUrl = result.secure_url; // Save the Cloudinary URL
            }
        }

        // Create the user with the profile picture URL
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            profilePicture: profilePictureUrl, // Save the Cloudinary URL
        });

        console.log("User registered successfully:", user);
        res.status(201).json({ 
            message: "User registered successfully", 
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture
            }
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
        console.error("Registration Error:", err);
    }
};


// User login
export const loginUser = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        res.status(400).json({ message: "Email and password are required" });
        return;
    }

    try {
        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password || '');
        if (!isPasswordValid) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }

        // Generate a JWT token for the user
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY!, {
            expiresIn: "1d",
        });
        console.log(token);
        // Set the token as an HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // false in development
            sameSite: 'lax', 
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        console.log(" user controller "+req.cookies.token);
        

        // Respond with user information (without sending the token in the response body)
        res.status(200).json({ 
            message: "Login successful", 
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email 
            } 
        });
    } catch (err: any) {
        res.status(500).json({ message: "An error occurred during login" });
    }
};

export const sendOTP = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if(!email){
        res.status(400).json({ message: 'Email is required' });
        console.log('Email is required');
        return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
    const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    // Store OTP and expiration time in the database (update User model accordingly)
    await User.updateOne({ email }, { otp, otpExpiration: expirationTime });

    // Configure Nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // Send OTP email
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It is valid for 10 minutes.`,
    };
    console.log(mailOptions);

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'OTP sent successfully' });
        return;
        console.log('OTP sent successfully');
    } catch (error) {
        res.status(500).json({ message: 'Error sending OTP' });
    }
};

export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, otp, newPassword } = req.body;

        // Validate input fields
        if (!email || !otp || !newPassword) {
            res.status(400).json({ message: "All fields are required" });
            return;
        }

        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Check if OTP matches and is not expired
        if (user.otp !== otp) {
            res.status(400).json({ message: "Invalid OTP" });
            return;
        }

        if (!user.otpExpiration || Date.now() > user.otpExpiration.getTime()) {
            res.status(400).json({ message: "OTP has expired" });
            return;
        }

        // Check if the new password is different from the old one
        const isSamePassword = await bcrypt.compare(newPassword, user.password || '');
        if (isSamePassword) {
            res.status(400).json({ message: "New password must be different from the previous one" });
            return;
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user's password and reset OTP fields
        await User.updateOne(
            { email },
            { $set: { password: hashedPassword, otp: null, otpExpiration: null } }
        );

        console.log(`Password reset successful for ${email}`);

        // Sending email notification
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset Confirmation",
            text: "Your password has been reset successfully. If you did not request this change, please contact support immediately.",
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Password reset email sent to ${email}`);
        } catch (emailError) {
            console.error("Error sending email:", emailError);
        }

        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Error in verifyOTP:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Add a logout function
export const logoutUser = async (req: Request, res: Response): Promise<void> => {
    try {
        res.cookie('token', '', {
            httpOnly: true,
            expires: new Date(0),
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error logging out" });
    }
};
