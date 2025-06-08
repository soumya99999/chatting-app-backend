import dotenv from 'dotenv';
dotenv.config();

import express, { Application } from 'express';
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

// Initialize app and server
const app: Application = express();
const server = http.createServer(app);

// ✅ CORS setup — only allow known frontend origins
const allowedOrigins = [
  'https://chatting-app-frontend-roan.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin: function (origin, callback) {
    console.log('Incoming origin:', origin); // ✅ Debug CORS
    if (!origin) return callback(null, true); // Allow mobile apps / curl
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Helmet security headers with CSP
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      fontSrc: ["'self'", 'data:', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      connectSrc: [
        "'self'",
        'https://chatting-app-frontend-roan.vercel.app',
        'https://chatting-app-backend-vvad.onrender.com',
        'wss://chatting-app-backend-vvad.onrender.com'
      ],
      frameSrc: ["'self'", 'https://accounts.google.com'],
    }
  })
);

// ✅ Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// ✅ Connect to MongoDB
connectDB();

// ✅ Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

io.on('connect_error', (error) => {
  console.error('Socket.IO connection error:', error);
});

io.on('error', (error) => {
  console.error('Socket.IO error:', error);
});

app.set('io', io);

try {
  initSocket(io);
  console.log('✅ Socket.IO initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Socket.IO:', error);
}

// ✅ Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// ✅ Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ✅ Start server on assigned Render port
const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log('     ==> Your service is live 🎉');
});

// ✅ Catch unhandled errors
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
