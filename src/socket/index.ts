import { Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import type { Message } from '../types/message';
import MessageModel from '../models/Message';
import type { IMessage } from '../models/Message';
import { Types } from 'mongoose';

interface PopulatedChat {
    _id: Types.ObjectId;
    users: { _id: Types.ObjectId }[];
}

interface PopulatedMessage extends Omit<IMessage, 'chat'> {
    chat: PopulatedChat;
}

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

            // When a user comes online, mark all their unread messages as delivered
            MessageModel.find({
                deliveredBy: { $ne: new Types.ObjectId(userId) }
            })
            .populate({
                path: 'chat',
                select: 'users'
            })
            .lean()
            .then((messages) => {
                messages.forEach(async (message) => {
                    const populatedMessage = message as unknown as PopulatedMessage;
                    if (populatedMessage.chat.users.some(user => user._id.toString() === userId)) {
                        const userIdObjectId = new Types.ObjectId(userId);
                        if (!populatedMessage.deliveredBy.some(id => id.equals(userIdObjectId))) {
                            await MessageModel.findByIdAndUpdate(
                                populatedMessage._id,
                                { $addToSet: { deliveredBy: userIdObjectId } }
                            );
                            
                            io.to(populatedMessage.chat._id.toString()).emit('message delivered', {
                                messageId: populatedMessage._id,
                                chatId: populatedMessage.chat._id.toString(),
                                userId,
                                deliveredBy: [...populatedMessage.deliveredBy, userIdObjectId].map(id => id.toString()),
                                readBy: populatedMessage.readBy.map(id => id.toString()),
                                isRead: populatedMessage.isRead
                            });
                        }
                    }
                });
            });

            activeUsers.forEach((_, existingUserId) => {
                if (existingUserId !== userId) {
                    socket.emit('user online', existingUserId);
                }
            });
        });

        socket.on('join chat', (chatId: string) => {
            console.log(`📝 User joined chat: ${chatId}`);
            socket.join(chatId);

            // When a user joins a chat, mark all messages as read
            const userId = Array.from(activeUsers.entries())
                .find(([_, socketId]) => socketId === socket.id)?.[0];

            if (userId) {
                MessageModel.find({
                    chat: chatId,
                    readBy: { $ne: new Types.ObjectId(userId) }
                })
                .populate({
                    path: 'chat',
                    select: 'users'
                })
                .lean()
                .then((messages) => {
                    messages.forEach(async (message) => {
                        const populatedMessage = message as unknown as PopulatedMessage;
                        if (populatedMessage.chat.users.some(user => user._id.toString() === userId)) {
                            const userIdObjectId = new Types.ObjectId(userId);
                            if (!populatedMessage.readBy.some(id => id.equals(userIdObjectId))) {
                                await MessageModel.findByIdAndUpdate(
                                    populatedMessage._id,
                                    { 
                                        $addToSet: { readBy: userIdObjectId },
                                        isRead: true
                                    }
                                );
                                
                                io.to(chatId).emit('message status update', {
                                    messageId: populatedMessage._id,
                                    chatId: chatId,
                                    userId,
                                    deliveredBy: populatedMessage.deliveredBy.map(id => id.toString()),
                                    readBy: [...populatedMessage.readBy, userIdObjectId].map(id => id.toString()),
                                    isRead: true
                                });
                            }
                        }
                    });
                });
            }
        });

        socket.on('new message', (messageData: Message) => {
            const { _id, chatId, senderId } = messageData;
            if (!chatId) return console.error('❌ Missing chatId in messageData');

            if (messageHistory.has(_id)) {
                console.log(`⚠️ Duplicate message ignored: ${_id}`);
                return;
            }
            messageHistory.set(_id, true);
            
            // Get all users in the chat except the sender
            const chatUsers = messageData.chat?.users || [];
            const recipientId = chatUsers.find(user => user._id !== senderId)?._id;
            
            // If recipient is online, mark message as delivered immediately
            if (recipientId && activeUsers.has(recipientId)) {
                io.to(chatId).emit('message delivered', { 
                    messageId: _id, 
                    chatId, 
                    userId: recipientId,
                    deliveredBy: [recipientId],
                    readBy: [],
                    isRead: false
                });
                console.log(`✅ Message delivered to online user in chat ${chatId}`);
            }
            
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
                console.log(`Marking message as delivered via socket:`, { messageId, chatId, userId });
                io.to(chatId).emit('message delivered', { 
                    messageId, 
                    chatId, 
                    userId,
                    deliveredBy: [userId],
                    readBy: [],
                    isRead: false
                });
                console.log(`✅ Message delivered in chat ${chatId}`);
            } else {
                console.error('Missing required fields for mark message delivered:', { messageId, chatId, userId });
            }
        });

        socket.on('mark message read', ({ messageId, chatId, userId }) => {
            if (messageId && chatId && userId) {
                console.log(`Marking message as read via socket:`, { messageId, chatId, userId });
                io.to(chatId).emit('message status update', {
                    messageId,
                    chatId,
                    userId,
                    deliveredBy: [userId],
                    readBy: [userId],
                    isRead: true
                });
                console.log(`✅ Message read in chat ${chatId}`);
            } else {
                console.error('Missing required fields for mark message read:', { messageId, chatId, userId });
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
