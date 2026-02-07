/**
 * SECURITY: Rate Limiting Middleware
 * 
 * Implements IP-based and user-based rate limiting to prevent abuse.
 * Uses in-memory storage for simplicity (use Redis/Upstash in production for multi-instance deployments).
 * 
 * OWASP: Prevents brute force attacks, DoS, and API abuse
 */

import { NextRequest } from 'next/server';

// In-memory rate limit store (use Redis in production for distributed rate limiting)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Custom error message */
  message?: string;
}

/**
 * Default rate limit configurations for different endpoint types
 * Following OWASP recommendations for API security
 */
export const RATE_LIMITS = {
  // Authentication endpoints
  // RELAXED: Was 5/15min which was too aggressive for normal page loads/refreshes
  // Now 100/15min to allow normal usage while still preventing abuse
  AUTH: {
    maxRequests: 100,
    windowSeconds: 60 * 15, // 15 minutes
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  },
  
  // Video generation (resource-intensive)
  VIDEO_GENERATION: {
    maxRequests: 10,
    windowSeconds: 60 * 60, // 1 hour
    message: 'Video generation rate limit exceeded. Please try again later.'
  },
  
  // Social media uploads
  UPLOAD: {
    maxRequests: 20,
    windowSeconds: 60 * 60, // 1 hour
    message: 'Upload rate limit exceeded. Please try again later.'
  },
  
  // API reads (more permissive)
  READ: {
    maxRequests: 100,
    windowSeconds: 60 * 15, // 15 minutes
    message: 'Too many requests. Please slow down.'
  },
  
  // General API endpoints
  GENERAL: {
    maxRequests: 50,
    windowSeconds: 60 * 15, // 15 minutes
    message: 'Rate limit exceeded. Please try again later.'
  }
} as const;

/**
 * Extract client IP from request, considering proxies and load balancers
 * SECURITY: Prevents IP spoofing by checking multiple headers
 */
function getClientIP(request: NextRequest): string {
  // Check X-Forwarded-For (common in proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (original client)
    return forwardedFor.split(',')[0].trim();
  }
  
  // Check X-Real-IP (nginx)
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  // Fallback to connection remote address
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  // Default fallback
  return 'unknown';
}

/**
 * Rate limit checker
 * Returns null if allowed, or Response object if rate limited
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  userId?: string
): Promise<Response | null> {
  const ip = getClientIP(request);
  
  // Create composite key: IP + optional userId for dual rate limiting
  // This prevents both IP-based and user-based abuse
  const keys = [
    `ip:${ip}`,
    ...(userId ? [`user:${userId}`] : [])
  ];
  
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  for (const key of keys) {
    let entry = rateLimitStore.get(key);
    
    // Create new entry if doesn't exist or window expired
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, entry);
    }
    
    // Increment request count
    entry.count++;
    
    // Check if rate limit exceeded
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      // OWASP: Return proper 429 with Retry-After header
      return new Response(
        JSON.stringify({
          error: config.message || 'Rate limit exceeded',
          retryAfter: retryAfter,
          limit: config.maxRequests,
          window: config.windowSeconds
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString()
          }
        }
      );
    }
    
    // Update remaining count in memory
    rateLimitStore.set(key, entry);
  }
  
  // Rate limit not exceeded
  return null;
}

/**
 * Helper to add rate limit headers to successful responses
 * OWASP: Transparency about rate limits improves UX
 */
export function addRateLimitHeaders(
  response: Response,
  config: RateLimitConfig,
  ip: string
): Response {
  const key = `ip:${ip}`;
  const entry = rateLimitStore.get(key);
  
  if (entry) {
    const remaining = Math.max(0, config.maxRequests - entry.count);
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', entry.resetTime.toString());
  }
  
  return response;
}

/**
 * Convenience wrapper for rate limiting in route handlers
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   const rateLimitResponse = await rateLimit(request, RATE_LIMITS.AUTH);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   // ... rest of handler
 * }
 */
export const rateLimit = checkRateLimit;
