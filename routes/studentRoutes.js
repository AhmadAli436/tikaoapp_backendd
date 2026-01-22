import { authenticateToken } from '../controllers/authController.js';
import {
  getClasses,
  getBoards,
  getPresignedUrl,
  createStudent,
  updateStudent,
} from '../controllers/studentController.js';
import express from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const router = express.Router();
//<<<<<<<<<<<<<<<<<<<<<<new flow routes below all >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.get('/classes',authenticateToken, getClasses);
router.get('/boards',authenticateToken, getBoards);
router.post('/student/presigned-url',authenticateToken, getPresignedUrl);
router.post('/details',authenticateToken, createStudent);
router.put('/createstudent',authenticateToken, createStudent);
router.put('/student/:id',authenticateToken, updateStudent); // <-- Added update route

//<<<<<<<<<<<<<<<<<<<<<<new flow routes end >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Validate environment variables
const requiredEnvVars = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing environment variable: ${envVar}`);
    process.exit(1);
  }
}

// GET /api/students/presigned-url - Generate presigned URL for S3 upload

router.get('/presigned-url', async (req, res) => {
  try {
    const { fileType, fileExtension } = req.query;

    // Validate query parameters
    if (!fileType || !fileExtension) {
      return res.status(400).json({ message: 'fileType and fileExtension are required' });
    }

    // Validate file type
    const allowedFileTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedFileTypes.includes(fileType)) {
      return res.status(400).json({ message: `Invalid file type. Allowed types: ${allowedFileTypes.join(', ')}` });
    }

    // Validate file extension
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowedExtensions.includes(fileExtension.toLowerCase())) {
      return res.status(400).json({ message: `Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}` });
    }

    const key = `avatars/${Date.now()}.${fileExtension}`;
    const bucketName = process.env.S3_BUCKET_NAME;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    console.log(`Generated presigned URL for key: ${key}`);

    res.json({
      url,
      filePath: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
    });
    res.status(500).json({ message: 'Failed to generate presigned URL', error: error.message });
  }
});



export default router;