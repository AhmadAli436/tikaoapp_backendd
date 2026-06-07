import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ success: false, message: 'Invalid recipient ID' });
    }

    const notifications = await Notification.find({ recipientId })
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const unreadCount = await Notification.countDocuments({ recipientId, read: false });

    return res.status(200).json({ success: true, notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { read: true });
    return res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const { recipientId } = req.params;
    await Notification.updateMany({ recipientId, read: false }, { read: true });
    return res.status(200).json({ success: true, message: 'All marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createNotification = async (req, res) => {
  try {
    const { title, message, recipientId, recipientRole, type, metadata } = req.body;
    const notification = await Notification.create({
      title,
      message,
      recipientId,
      recipientRole: recipientRole || 'student',
      type: type || 'system',
      metadata,
    });
    return res.status(201).json({ success: true, notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const broadcastNotification = async (req, res) => {
  try {
    const { title, message, recipientIds, recipientRole, type } = req.body;
    const notifications = recipientIds.map((recipientId) => ({
      title,
      message,
      recipientId,
      recipientRole: recipientRole || 'student',
      type: type || 'announcement',
    }));
    const created = await Notification.insertMany(notifications);
    return res.status(201).json({ success: true, count: created.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
