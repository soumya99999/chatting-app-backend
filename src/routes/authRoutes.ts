import express from "express";
import jwt from 'jsonwebtoken';
import upload from '../middlewares/multer';
import passport from 'passport';
import { googleLoginHandler, loginUser, logoutUser, registerUser, sendOTP, verifyOTP } from "../controllers/auth.controller";

const router = express.Router();

// * Google Login Part
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
    '/google/callback',
    passport.authenticate('google', { session: false }),
    (req: any, res) => {
        const user = req.user;
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY!, { expiresIn: '1d' });
        res.redirect(`http://localhost:5173?token=${token}`); 
    }
);

router.post('/google-login', googleLoginHandler);

// * Register and Login Part
router.route('/register').post(upload.single('profilePicture'), registerUser); // Updated to include multer m
router.route('/login').post(loginUser);
router.post('/logout', logoutUser);

// * Forgot Password Part
router.post('/forgot-password/send-otp', sendOTP);
router.post('/forgot-password/verify-otp', verifyOTP);


export default router;