import { Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import type { Message } from '../types/message';

const initSocket = (io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>) => {
    const activeUsers = new Map<string, string>(); // Maps userId -> socketId
    const messageHistory = new Map<string, boolean>(); // Prevent duplicate message sends
    const MESSAGE_CLEANUP_INTERVAL = 1000 * 60 * 10; // 10 minutes

    // Clean up old message history every 10 minutes to prevent memory overflow
    setInterval(() => {
        messageHistory.clear();
        console.log('🗑️ Cleared old message history.');
    }, MESSAGE_CLEANUP_INTERVAL);

    io.on('connection', (socket) => {
        // console.log(`🔗 User connected: ${socket.id}`);

        socket.on('setup', (userId: string) => {
            // console.log(`✅ User setup: ${userId}`);
            activeUsers.set(userId, socket.id);
            socket.join(userId); 
            io.emit('user online', userId); 

            activeUsers.forEach((_, existingUserId) => {
                if (existingUserId !== userId) {
                    socket.emit('user online', existingUserId);
                }
            });
        });

        socket.on('join chat', (chatId: string) => {
            console.log(`📝 User joined chat: ${chatId}`);
            socket.join(chatId);
        });

        socket.on('new message', (messageData: Message) => {
            const { _id, chatId } = messageData;
            if (!chatId) return console.error('❌ Missing chatId in messageData');

            if (messageHistory.has(_id)) {
                console.log(`⚠️ Duplicate message ignored: ${_id}`);
                return;
            }
            messageHistory.set(_id, true);
            io.to(chatId).emit('message received', messageData);
            console.log(`📩 Message sent to chat ${chatId}`);
        });

        socket.on('typing', ({ chatId, userId }: { chatId: string; userId: string }) => {
            if (chatId && userId) io.to(chatId).emit('user typing', { chatId, userId });
        });

        socket.on('stop typing', ({ chatId, userId }: { chatId: string; userId: string }) => {
            if (chatId && userId) io.to(chatId).emit('user stopped typing', { chatId, userId });
        });

        socket.on('mark message delivered', ({ messageId, chatId, userId }) => {
            if (messageId && chatId && userId) {
                io.to(chatId).emit('message delivered', { messageId, chatId, userId });
                console.log(`✅ Message delivered in chat ${chatId}`);
            }
        });

        socket.on('mark message read', ({ messageId, chatId, userId }) => {
            if (messageId && chatId && userId) {
                io.to(chatId).emit('message status update', {
                    messageId,
                    chatId,
                    userId,
                    isRead: true,
                });
                console.log(`✅ Message read in chat ${chatId}`);
            }
        });

        socket.on('disconnect', () => {
            for (const [userId, socketId] of activeUsers.entries()) {
                if (socketId === socket.id) {
                    activeUsers.delete(userId);
                    console.log(`❌ User disconnected: ${userId}`);
                    io.emit('user offline', userId);
                    break;
                }
            }
        });
    });
};

export default initSocket;
