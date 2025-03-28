import express from "express";
import jwt from 'jsonwebtoken';
import upload from '../middlewares/multer';
import passport from 'passport';
import { loginUser, logoutUser, registerUser, sendOTP, verifyOTP } from "../controllers/auth.controller";

const router = express.Router();

// Add CORS headers for Google OAuth routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Google OAuth routes
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account' // Forces Google to show account selection
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.redirect('http://localhost:5173/login?error=Authentication failed');
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id }, 
        process.env.JWT_SECRET_KEY!, 
        { expiresIn: '1d' }
      );

      // Set the token as an HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });

      // Redirect to frontend with success message
      res.redirect('http://localhost:5173/auth/callback?success=true');
    } catch (error) {
      console.error('Error in Google callback:', error);
      res.redirect('http://localhost:5173/login?error=Authentication failed');
    }
  }
);

// Regular auth routes
router.route('/register').post(upload.single('profilePicture'), registerUser);
router.route('/login').post(loginUser);
router.post('/logout', logoutUser);

// Forgot Password routes
router.post('/forgot-password/send-otp', sendOTP);
router.post('/forgot-password/verify-otp', verifyOTP);

export default router;