import express from 'express';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
});

router.get('/presign-url', async (req, res) => {
  try {
    const { fileType } = req.query;
    if (!fileType) return res.status(400).json({ message: 'fileType is required' });

    const ext = fileType.split('/')[1];
    const key = `teachers/${uuidv4()}.${ext}`;

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Expires: 60,
      ContentType: fileType,
    };

    const uploadURL = await s3.getSignedUrlPromise('putObject', params);

    res.json({
      uploadURL,
      fileURL: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to generate pre-signed URL', error: err.message });
  }
});

export default router;
