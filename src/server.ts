import dotenv from 'dotenv';
dotenv.config();

import express, { Application} from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import passport from 'passport';
import connectDB from './Config/db';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/UserRoutes';
import chatRoutes from './routes/chatRoutes';
import messageRoutes from './routes/messageRoutes';
import initSocket from './socket';
import './Config/passport';

// console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
// console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET);
// console.log('JWT_SECRET_KEY:', process.env.JWT_SECRET_KEY);
// console.log('EMAIL_USER:', process.env.EMAIL_USER);
// console.log('EMAIL_PASS:', process.env.EMAIL_PASS);
// console.log('Mongo URI:', process.env.MONGO_URI);

// Create Express application and HTTP server
const app: Application = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://chatting-app-frontend-roan.vercel.app',
        'https://chatting-app-backend-vvad.onrender.com'
    ], // Allow both localhost, IP, and hosted URLs
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Configure CSP with helmet
app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        fontSrc: ["'self'", 'data:', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'", 'http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:5173', 'ws://localhost:8081'],
        frameSrc: ["'self'", 'https://accounts.google.com'],
      },
    })
);

// Make sure these middleware are in the correct order
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Ensure Database is Connected Before Initializing Socket.IO

connectDB(); // Wait for MongoDB to connect

// Initialize Socket.IO with proper error handling
const io = new Server(server, {
    cors: {
        origin: [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'https://chatting-app-frontend-roan.vercel.app',
            'https://chatting-app-backend-vvad.onrender.com'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});

// Handle Socket.IO errors
io.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
});

io.on('error', (error) => {
    console.error('Socket.IO error:', error);
});

app.set('io', io);

// Initialize socket with error handling
try {
    initSocket(io);
    console.log('✅ Socket.IO initialized successfully');
} catch (error) {
    console.error('❌ Error initializing Socket.IO:', error);
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Global error handler:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Start the server
const PORT = process.env.PORT || 8081; // Changed default port to 8081
server.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});

// Handle server errors
server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
    } else {
        console.error('❌ Server error:', error);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});