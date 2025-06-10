import express from "express";
import jwt from 'jsonwebtoken';
import upload from '../middlewares/multer';
import passport from 'passport';
import { loginUser, logoutUser, registerUser, sendOTP, verifyOTP } from "../controllers/auth.controller";

const router = express.Router();

const FRONTEND_LOCAL_URL = process.env.FRONTEND_LOCAL_URL || 'http://localhost:5173';
const FRONTEND_PROD_URL = process.env.FRONTEND_PROD_URL || 'https://chatting-app-frontend-roan.vercel.app';
const NODE_ENV = process.env.NODE_ENV || 'development';

const allowedOrigins = [FRONTEND_LOCAL_URL, FRONTEND_PROD_URL];

// Add CORS headers for Google OAuth routes
router.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
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
        const redirectUrl = NODE_ENV === 'production' ? FRONTEND_PROD_URL : FRONTEND_LOCAL_URL;
        return res.redirect(`${redirectUrl}/login?error=Authentication failed`);
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
        secure: NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });

      // Redirect to frontend with success message
      const redirectUrl = NODE_ENV === 'production' ? FRONTEND_PROD_URL : FRONTEND_LOCAL_URL;
      res.redirect(`${redirectUrl}/auth/callback?success=true`);
    } catch (error) {
      console.error('Error in Google callback:', error);
      const redirectUrl = NODE_ENV === 'production' ? FRONTEND_PROD_URL : FRONTEND_LOCAL_URL;
      res.redirect(`${redirectUrl}/login?error=Authentication failed`);
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
