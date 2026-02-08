import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 Storage Client
 * S3-compatible storage with free egress bandwidth
 */

// Validate R2 configuration
const validateR2Config = () => {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing R2 configuration: ${missing.join(', ')}`);
  }
};

// Initialize R2 client (S3-compatible)
export const getR2Client = () => {
  validateR2Config();
  
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
};

/**
 * Upload video file to R2
 * @param videoBuffer - Video file buffer
 * @param videoId - Unique video ID
 * @param userId - User ID for access control
 * @returns Public URL of uploaded video
 */
export async function uploadVideoToR2(
  videoBuffer: Buffer,
  videoId: string,
  userId: string
): Promise<string> {
  console.log('[r2] Uploading video:', videoId, 'for user:', userId);
  
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME!;
  
  // Store with user prefix for organization: users/{userId}/videos/{videoId}.mp4
  const key = `users/${userId}/videos/${videoId}.mp4`;
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: videoBuffer,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000', // Cache for 1 year
    Metadata: {
      userId,
      videoId,
      uploadedAt: Date.now().toString(),
    },
  });
  
  await client.send(command);
  
  // Return public URL
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  console.log('[r2] Video uploaded successfully:', publicUrl);
  
  return publicUrl;
}

/**
 * Get video URL with optional signed URL for private access
 * @param videoId - Unique video ID
 * @param userId - User ID for validation
 * @param expiresIn - Signed URL expiration in seconds (default: 1 hour)
 * @returns Video URL
 */
export async function getVideoUrl(
  videoId: string,
  userId: string,
  expiresIn: number = 3600
): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME!;
  const key = `users/${userId}/videos/${videoId}.mp4`;
  
  // Check if video exists
  const client = getR2Client();
  try {
    const headCommand = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await client.send(headCommand);
  } catch (error) {
    console.error('[r2] Video not found:', videoId, 'for user:', userId);
    throw new Error('Video not found');
  }
  
  // For R2 with custom domain or public bucket, return public URL
  if (process.env.R2_PUBLIC_ACCESS === 'true') {
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  }
  
  // Generate signed URL for private access
  const getCommand = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  const signedUrl = await getSignedUrl(client, getCommand, { expiresIn });
  return signedUrl;
}

/**
 * Check if video exists in R2 for a specific user
 */
export async function videoExists(videoId: string, userId: string): Promise<boolean> {
  try {
    const client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;
    const key = `users/${userId}/videos/${videoId}.mp4`;
    
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    
    await client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Upload video from local file path (for Railway backend)
 */
export async function uploadVideoFileToR2(
  videoPath: string,
  videoId: string,
  userId: string
): Promise<string> {
  const fs = require('fs').promises;
  const videoBuffer = await fs.readFile(videoPath);
  return uploadVideoToR2(videoBuffer, videoId, userId);
}
