// backend/src/routes/chatRoutes.ts
import express from 'express';
import {  
    accessChat,
    fetchChats
} from '../controllers/chat.controller';
import {
    updateGroupInfo,
    addMembers,
    removeMembers,
    leaveGroup,
    transferOwnership,
    promoteToAdmin,
    muteUser,
    unmuteUser,
    deleteGroup,
    createGroupChat,
    fetchGroups
} from '../controllers/groupChat.controller';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();

// One-to-One Chat Routes
router.post('/access-chat', authenticate, accessChat);
router.get('/fetch-chats', authenticate, fetchChats);

// Group Chat Routes
router.post('/group', authenticate, createGroupChat);
router.get('/group', authenticate, fetchGroups);
router.put('/group/:chatId/info', authenticate, updateGroupInfo);
router.put('/group/:chatId/add-members', authenticate, addMembers);
router.put('/group/:chatId/remove-members', authenticate, removeMembers);
router.post('/group/:chatId/leave', authenticate, leaveGroup);
router.put('/group/:chatId/transfer-ownership', authenticate, transferOwnership);
router.put('/group/:chatId/promote-admin', authenticate, promoteToAdmin);
router.put('/group/:chatId/mute-user', authenticate, muteUser);
router.put('/group/:chatId/unmute-user', authenticate, unmuteUser);
router.delete('/group/:chatId', authenticate, deleteGroup);

export default router;