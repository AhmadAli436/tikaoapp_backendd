import express from 'express';
import {
  createTeacher,
  updateTeacher,
  getPresignedUrl,
  getStudentListBasic,
} from '../controllers/teacherController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();



//here new flow teacher signup
router.post('/details', authenticateToken, createTeacher);
router.put('/teachersignup', authenticateToken, createTeacher);
router.put('/updateTeacher/:id',authenticateToken, updateTeacher);
router.post('/presigned-url',authenticateToken, getPresignedUrl);


//here from u get the list of teachers for the report 
router.get('/students/list/:teacherId',authenticateToken, getStudentListBasic); // <-- New route
export default router;