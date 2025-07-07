// Utility function to handle uploading a file buffer to AWS S3
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME;
const PUBLIC_URL = process.env.AWS_S3_PUBLIC_URL || '';

const s3 = new S3Client({ region: REGION });
// Updated to accept precomputed key (videos/<hash>.<ext>)
export async function uploadToS3(fileBuffer, mimetype, key) {
  if (!BUCKET || !REGION) {
    throw new Error('Missing AWS S3 bucket or region configuration');
  }
  const uploadParams = {
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  };
  try {
    await s3.send(new PutObjectCommand(uploadParams));
  } catch (err) {
    console.error('S3 upload error:', err);
    throw err;
  }

  // Compose public URL (using standard S3 URL form)
  let url;
  if (PUBLIC_URL) {
    url = `${PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  } else {
    url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  }

  return { url, key };
}

export async function deleteFromS3(key) {
  if (!BUCKET) throw new Error('Missing S3 bucket');
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

