import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Feedback from '../models/Feedback.js';

const getThreadId = (id1, id2) => {
  const sorted = [id1.toString(), id2.toString()].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

export const sendMessage = async (req, res) => {
  try {
    const { senderId, recipientId, senderRole, recipientRole, content } = req.body;

    if (!senderId || !recipientId || !content) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const threadId = getThreadId(senderId, recipientId);
    const message = await Message.create({
      senderId,
      recipientId,
      senderRole,
      recipientRole,
      content,
      threadId,
    });

    return res.status(201).json({ success: true, message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    const messages = await Message.find({
      $or: [{ senderId: userId }, { recipientId: userId }],
    }).sort({ createdAt: -1 });

    const threadMap = new Map();
    messages.forEach((msg) => {
      if (!threadMap.has(msg.threadId)) {
        const otherId = msg.senderId.toString() === userId.toString()
          ? msg.recipientId
          : msg.senderId;
        const otherRole = msg.senderId.toString() === userId.toString()
          ? msg.recipientRole
          : msg.senderRole;
        threadMap.set(msg.threadId, {
          threadId: msg.threadId,
          otherUserId: otherId,
          otherRole,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unread: msg.recipientId.toString() === userId.toString() && !msg.read ? 1 : 0,
        });
      } else if (msg.recipientId.toString() === userId.toString() && !msg.read) {
        const existing = threadMap.get(msg.threadId);
        existing.unread += 1;
      }
    });

    return res.status(200).json({
      success: true,
      conversations: Array.from(threadMap.values()),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getThreadMessages = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { userId } = req.query;

    const messages = await Message.find({ threadId }).sort({ createdAt: 1 });

    if (userId) {
      await Message.updateMany(
        { threadId, recipientId: userId, read: false },
        { read: true },
      );
    }

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const submitFeedback = async (req, res) => {
  try {
    const { fromId, toId, fromRole, toRole, rating, comment, type } = req.body;
    const feedback = await Feedback.create({ fromId, toId, fromRole, toRole, rating, comment, type });
    return res.status(201).json({ success: true, feedback });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeedbackForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const feedback = await Feedback.find({ toId: userId }).sort({ createdAt: -1 });
    const avgRating = feedback.length
      ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length
      : 0;
    return res.status(200).json({ success: true, feedback, averageRating: Math.round(avgRating * 10) / 10 });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllMessagesAdmin = async (_req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllFeedbackAdmin = async (_req, res) => {
  try {
    const feedback = await Feedback.find().sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ success: true, feedback });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
