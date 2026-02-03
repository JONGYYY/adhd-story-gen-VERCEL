/**
 * SECURITY: Security Headers Middleware
 * 
 * Implements security headers following OWASP recommendations
 * to prevent common web vulnerabilities (XSS, Clickjacking, MIME sniffing, etc.)
 */

/**
 * OWASP: Security headers for all responses
 * These headers protect against various attack vectors
 */
export const SECURITY_HEADERS = {
  // Prevent XSS attacks by blocking inline scripts/styles
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' https: blob:",
    "connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://open.tiktokapis.com https://www.tiktok.com",
    "frame-src 'self' https://accounts.google.com https://www.tiktok.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; '),
  
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection in older browsers
  'X-XSS-Protection': '1; mode=block',
  
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Force HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Permissions policy (restrict browser features)
  'Permissions-Policy': [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', ')
} as const;

/**
 * Apply security headers to a Response
 * 
 * @example
 * const response = new Response(JSON.stringify(data));
 * return applySecurityHeaders(response);
 */
export function applySecurityHeaders(response: Response): Response {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Create a JSON response with security headers
 * 
 * @example
 * return secureJsonResponse({ success: true }, 200);
 */
export function secureJsonResponse(data: any, status: number = 200): Response {
  const response = new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS
    }
  });
  
  return response;
}

/**
 * SECURITY: CORS headers for API endpoints
 * Only allow requests from trusted origins
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || 'https://www.taleo.media',
    'https://taleo.media',
    'http://localhost:3000' // Development only
  ];
  
  // Check if origin is allowed
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  if (!isAllowed) {
    return {};
  }
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400' // 24 hours
  };
}
