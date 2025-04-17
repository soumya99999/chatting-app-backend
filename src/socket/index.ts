import { Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import type { Message } from '../types/message';
import MessageModel from '../models/Message';
import type { IMessage } from '../models/Message';
import { Types } from 'mongoose';

import type { Chat } from '../types/chat';
import type { RawUser } from '../types/message'; // Correctly import RawUser from message.ts

interface PopulatedChat extends Chat {
    _id: Types.ObjectId;
    users: RawUser[]; // Change this to match the Chat interface
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
                    // Add null check for chat and users
                    if (populatedMessage?.chat?.users && 
                        populatedMessage.chat.users.some(user => user?._id?.toString() === userId)) {
                        const userIdObjectId = new Types.ObjectId(userId);
                        if (!populatedMessage.deliveredBy?.some(id => id?.equals(userIdObjectId))) {
                            try {
                                await MessageModel.findByIdAndUpdate(
                                    populatedMessage._id,
                                    { $addToSet: { deliveredBy: userIdObjectId } }
                                );
                                
                                io.to(populatedMessage.chat._id.toString()).emit('message delivered', {
                                    messageId: populatedMessage._id,
                                    chatId: populatedMessage.chat._id.toString(),
                                    userId,
                                    deliveredBy: [...(populatedMessage.deliveredBy || []), userIdObjectId].map(id => id?.toString()),
                                    readBy: (populatedMessage.readBy || []).map(id => id?.toString()),
                                    isRead: populatedMessage.isRead
                                });
                            } catch (error) {
                                console.error('Error updating message delivery status:', error);
                            }
                        }
                    }
                });
            })
            .catch(error => {
                console.error('Error fetching messages for delivery status:', error);
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
                        // Add null check for chat and users
                        if (populatedMessage?.chat?.users && 
                            populatedMessage.chat.users.some(user => user?._id?.toString() === userId)) {
                            const userIdObjectId = new Types.ObjectId(userId);
                            if (!populatedMessage.readBy?.some(id => id?.equals(userIdObjectId))) {
                                try {
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
                                        deliveredBy: (populatedMessage.deliveredBy || []).map(id => id?.toString()),
                                        readBy: [...(populatedMessage.readBy || []), userIdObjectId].map(id => id?.toString()),
                                        isRead: true
                                    });
                                } catch (error) {
                                    console.error('Error updating message read status:', error);
                                }
                            }
                        }
                    });
                })
                .catch(error => {
                    console.error('Error fetching messages for read status:', error);
                });
            }
        });

        socket.on('new message', (messageData: Message & { chat: Chat }) => {
            const { _id, chatId, senderId } = messageData;
            if (!chatId) return console.error('❌ Missing chatId in messageData');

            if (messageHistory.has(_id)) {
                console.log(`⚠️ Duplicate message ignored: ${_id}`);
                return;
            }
            messageHistory.set(_id, true);
            
            // Get all users in the chat except the sender
            const chatUsers = messageData.chat.users;
            let deliveredBy: string[] = [];
            
            // For group chats, mark as delivered to all online members
            if (messageData.chat.isGroupChat) {
                const onlineMembers = chatUsers
                    .filter(user => user._id.toString() !== senderId && activeUsers.has(user._id.toString()))
                    .map(user => user._id.toString());
                
                deliveredBy = onlineMembers;
                
                if (onlineMembers.length > 0) {
                    io.to(chatId).emit('message delivered', { 
                        messageId: _id, 
                        chatId, 
                        userId: senderId,
                        deliveredBy: onlineMembers,
                        readBy: [],
                        isRead: false
                    });
                    console.log(`✅ Message delivered to online group members in chat ${chatId}`);
                }
            } else {
                // For one-to-one chat, mark as delivered if recipient is online
                const recipientId = chatUsers.find(user => user._id.toString() !== senderId)?._id.toString();
                if (recipientId && activeUsers.has(recipientId)) {
                    deliveredBy = [recipientId];
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
            }

            // Prepare the message to emit
            const messageToEmit = {
                ...messageData,
                deliveredBy: deliveredBy,
                timestamp: new Date().toISOString()
            };

            // Only emit to the chat room, not to individual users
            io.to(chatId).emit('new message', messageToEmit);
            console.log(`📩 Message sent to chat room ${chatId}`);
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

        // Group chat events
        socket.on('group info updated', (chat) => {
            io.to(chat._id).emit('group info updated', chat);
        });

        socket.on('group members updated', (chat) => {
            io.to(chat._id).emit('group members updated', chat);
        });

        socket.on('group admins updated', (chat) => {
            io.to(chat._id).emit('group admins updated', chat);
        });

        socket.on('group muted users updated', (chat) => {
            io.to(chat._id).emit('group muted users updated', chat);
        });

        socket.on('group ownership transferred', (chat) => {
            io.to(chat._id).emit('group ownership transferred', chat);
        });

        socket.on('group deleted', (chatId: string) => {
            io.to(chatId).emit('group deleted', chatId);
        });

        socket.on('message pinned', ({ chatId, messageId }) => {
            io.to(chatId).emit('message pinned', { chatId, messageId });
        });

        socket.on('message unpinned', ({ chatId, messageId }) => {
            io.to(chatId).emit('message unpinned', { chatId, messageId });
        });

        socket.on('message reaction updated', ({ messageId, chatId, userId, emoji, reactions }) => {
            io.to(chatId).emit('message reaction updated', { messageId, chatId, userId, emoji, reactions });
        });

        socket.on('mentioned in message', ({ messageId, chatId, senderId, content }) => {
            io.to(chatId).emit('mentioned in message', { messageId, chatId, senderId, content });
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
