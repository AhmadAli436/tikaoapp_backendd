import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  broadcastNotification,
  deleteNotification,
} from '../controllers/notificationController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

router.get('/:recipientId', authenticateToken, getNotifications);
router.put('/:id/read', authenticateToken, markAsRead);
router.put('/:recipientId/read-all', authenticateToken, markAllAsRead);
router.post('/', authenticateToken, createNotification);
router.post('/broadcast', authenticateToken, broadcastNotification);
router.delete('/:id', authenticateToken, deleteNotification);

export default router;
