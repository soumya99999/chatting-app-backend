import dotenv from 'dotenv';
dotenv.config();

import express, { Application} from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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
    origin: 'http://localhost:5173', // Your frontend URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Make sure these middleware are in the correct order
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Ensure Database is Connected Before Initializing Socket.IO

connectDB(); // Wait for MongoDB to connect

// Initialize Socket.IO only after DB connection
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

app.set('io', io);

initSocket(io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes)

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});