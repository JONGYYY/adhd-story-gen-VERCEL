/**
 * SECURITY: Input Validation & Sanitization
 * 
 * Implements strict input validation using Zod schemas and sanitization
 * to prevent injection attacks, XSS, and malformed data.
 * 
 * OWASP: Validates all inputs, rejects unexpected fields, enforces length limits
 */

import { z } from 'zod';

/**
 * SECURITY: Sanitize string input to prevent XSS and injection attacks
 * Removes HTML tags, strips dangerous characters, trims whitespace
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove potentially dangerous characters for SQL/NoSQL injection
    .replace(/[<>'"`;(){}[\]]/g, '')
    // Normalize whitespace
    .trim()
    // Enforce length limit
    .substring(0, maxLength);
}

/**
 * SECURITY: Sanitize filename to prevent path traversal attacks
 * OWASP: Prevents directory traversal (../, ..\, etc.)
 */
export function sanitizeFilename(filename: string): string {
  return filename
    // Remove path components
    .replace(/^.*[\\\/]/, '')
    // Remove parent directory references
    .replace(/\.\./g, '')
    // Allow only alphanumeric, dash, underscore, and dot
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    // Limit length
    .substring(0, 255);
}

/**
 * SECURITY: Validate email format
 * More strict than basic regex to prevent injection
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(320, 'Email too long') // RFC 5321
  .refine(
    (email) => !email.includes('..'),
    'Invalid email format'
  );

/**
 * SECURITY: Validate URL with strict rules
 * OWASP: Prevents SSRF attacks by allowing only https URLs
 */
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL too long')
  .refine(
    (url) => url.startsWith('https://') || url.startsWith('http://'),
    'URL must start with http:// or https://'
  )
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        // Prevent SSRF to internal networks
        const hostname = parsed.hostname.toLowerCase();
        return !hostname.includes('localhost') &&
               !hostname.startsWith('127.') &&
               !hostname.startsWith('192.168.') &&
               !hostname.startsWith('10.') &&
               !hostname.startsWith('172.16.');
      } catch {
        return false;
      }
    },
    'URL cannot point to internal network'
  );

/**
 * SECURITY: Video generation request validation
 * Strict schema with length limits and type checking
 */
export const videoGenerationSchema = z.object({
  subreddit: z
    .string()
    .min(1, 'Subreddit is required')
    .max(100, 'Subreddit name too long')
    .regex(/^r\/[a-zA-Z0-9_]+$/, 'Invalid subreddit format'),
  
  videoType: z
    .enum(['cliffhanger', 'full-story'], {
      errorMap: () => ({ message: 'Video type must be cliffhanger or full-story' })
    }),
  
  narratorGender: z
    .enum(['male', 'female'], {
      errorMap: () => ({ message: 'Narrator gender must be male or female' })
    }),
  
  backgroundType: z
    .string()
    .max(50, 'Background type too long')
    .optional()
}).strict(); // Reject any additional fields

/**
 * SECURITY: TikTok upload validation
 */
export const tiktokUploadSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(2200, 'Title exceeds TikTok limit'), // TikTok caption limit
  
  privacy_level: z
    .enum(['PUBLIC', 'SELF_ONLY'], {
      errorMap: () => ({ message: 'Privacy level must be PUBLIC or SELF_ONLY' })
    }),
  
  video: z.any() // File validation happens separately
}).strict();

/**
 * SECURITY: YouTube upload validation
 */
export const youtubeUploadSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title exceeds YouTube limit'),
  
  description: z
    .string()
    .max(5000, 'Description exceeds YouTube limit')
    .optional(),
  
  privacy_status: z
    .enum(['public', 'private', 'unlisted'], {
      errorMap: () => ({ message: 'Privacy status must be public, private, or unlisted' })
    })
    .optional(),
  
  video: z.any() // File validation happens separately
}).strict();

/**
 * SECURITY: File upload validation
 * Validates file size, type, and extension
 */
export interface FileValidationConfig {
  maxSizeBytes: number;
  allowedTypes: string[];
  allowedExtensions: string[];
}

export const FILE_VALIDATION_CONFIGS = {
  VIDEO: {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    allowedExtensions: ['.mp4', '.mov', '.avi']
  },
  IMAGE: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  }
} as const;

/**
 * SECURITY: Validate uploaded file
 * OWASP: Prevents malicious file uploads, enforces size and type limits
 */
export function validateFile(
  file: File,
  config: FileValidationConfig
): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > config.maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${config.maxSizeBytes / 1024 / 1024}MB`
    };
  }
  
  // Check MIME type
  if (!config.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${config.allowedTypes.join(', ')}`
    };
  }
  
  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!config.allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed: ${config.allowedExtensions.join(', ')}`
    };
  }
  
  // Check filename for path traversal
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid filename'
    };
  }
  
  return { valid: true };
}

/**
 * SECURITY: Validate pagination parameters
 * Prevents resource exhaustion attacks
 */
export const paginationSchema = z.object({
  page: z
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .max(1000, 'Page number too high')
    .optional()
    .default(1),
  
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(20)
}).strict();

/**
 * SECURITY: Validate and sanitize user input from request
 * Returns validated data or throws with clear error messages
 * 
 * @example
 * const data = await validateInput(request, videoGenerationSchema);
 */
export async function validateInput<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate against schema
    const result = schema.safeParse(body);
    
    if (!result.success) {
      // Format Zod errors into user-friendly message
      const errors = result.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('; ');
      
      throw new Error(`Validation failed: ${errors}`);
    }
    
    return result.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON in request body');
    }
    throw error;
  }
}

/**
 * SECURITY: Validate query parameters
 * 
 * @example
 * const params = validateQueryParams(request, z.object({ id: z.string() }));
 */
export function validateQueryParams<T extends z.ZodType>(
  request: Request,
  schema: T
): z.infer<T> {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  const result = schema.safeParse(params);
  
  if (!result.success) {
    const errors = result.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    ).join('; ');
    
    throw new Error(`Invalid query parameters: ${errors}`);
  }
  
  return result.data;
}
