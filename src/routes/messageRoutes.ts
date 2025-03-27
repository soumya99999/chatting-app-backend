
import express from "express";
import {
    fetchMessages,
    sendMessage,
    markMessageAsRead,
    searchMessage,
    markMessageDelivered // Import the new function
} from "../controllers/message.controller";

import { authenticate } from "../middlewares/authMiddleware";
const router = express.Router();


// Message Routes
router.get('/:chatId/history', authenticate, fetchMessages);  // Fetch All messages
router.post('/messages', authenticate, sendMessage);     // Send message
router.put('/:messageId/read', authenticate, markMessageAsRead);   
router.put('/:messageId/delivered', authenticate, markMessageDelivered); // New route for marking message as delivered
router.get('/:messageId/search', authenticate, searchMessage);      // Search Message


export default router;
