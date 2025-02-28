import express from 'express';
import { 
    createGroupChat, 
    accessChat,
    fetchChats
} from '../controllers/chat.controller';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();

// One-to-One Chat Routes
router.post('/access-chat', authenticate, accessChat);         
router.get('/fetch-chats', authenticate, fetchChats);         

// Group Chat Routes
router.post('/group', authenticate, createGroupChat); 

export default router;
