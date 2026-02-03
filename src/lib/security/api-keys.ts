/**
 * SECURITY: API Key Management
 * 
 * Secure handling of API keys with validation, rotation support,
 * and environment variable enforcement.
 * 
 * OWASP: Never expose API keys client-side, validate before use
 */

/**
 * SECURITY: Validate that required environment variables are set
 * Throws clear error if any are missing
 */
export function validateRequiredEnvVars(vars: string[]): void {
  const missing: string[] = [];
  
  for (const varName of vars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Please set these in your Railway/deployment environment.`
    );
  }
}

/**
 * SECURITY: Get API key from environment with validation
 * Ensures key exists and has minimum length
 */
export function getSecureApiKey(envVarName: string, minLength: number = 10): string {
  const key = process.env[envVarName];
  
  if (!key) {
    throw new Error(`${envVarName} is not set in environment variables`);
  }
  
  if (key.length < minLength) {
    throw new Error(`${envVarName} is too short (possible configuration error)`);
  }
  
  return key;
}

/**
 * SECURITY: Mask API key for logging
 * Shows first/last 4 chars only
 * 
 * @example
 * console.log('API Key:', maskApiKey(apiKey));
 * // Output: "API Key: sk-1234...xyz9"
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) {
    return '***';
  }
  
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

/**
 * SECURITY: Environment variable configuration
 * Maps all required secrets with their validation rules
 */
export const REQUIRED_ENV_VARS = {
  // OpenAI
  OPENAI_API_KEY: { minLength: 20, description: 'OpenAI API key for story generation' },
  
  // ElevenLabs
  ELEVENLABS_API_KEY: { minLength: 20, description: 'ElevenLabs API key for TTS' },
  
  // Firebase Admin
  FIREBASE_ADMIN_PROJECT_ID: { minLength: 5, description: 'Firebase project ID' },
  FIREBASE_ADMIN_CLIENT_EMAIL: { minLength: 10, description: 'Firebase service account email' },
  FIREBASE_ADMIN_PRIVATE_KEY: { minLength: 100, description: 'Firebase private key' },
  
  // TikTok OAuth
  TIKTOK_CLIENT_KEY: { minLength: 10, description: 'TikTok OAuth client key' },
  TIKTOK_CLIENT_SECRET: { minLength: 20, description: 'TikTok OAuth client secret' },
  
  // YouTube OAuth
  YOUTUBE_CLIENT_ID: { minLength: 20, description: 'YouTube OAuth client ID' },
  YOUTUBE_CLIENT_SECRET: { minLength: 20, description: 'YouTube OAuth client secret' },
  
  // Railway API
  RAILWAY_API_URL: { minLength: 10, description: 'Railway API URL for video generation' },
  
  // App configuration
  NEXT_PUBLIC_APP_URL: { minLength: 10, description: 'Public app URL' }
} as const;

/**
 * SECURITY: Validate all required environment variables on app startup
 * Call this in your middleware or layout to fail fast
 */
export function validateAllEnvVars(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [varName, config] of Object.entries(REQUIRED_ENV_VARS)) {
    try {
      const value = process.env[varName];
      
      if (!value) {
        errors.push(`${varName} is not set (${config.description})`);
        continue;
      }
      
      if (value.length < config.minLength) {
        errors.push(`${varName} is too short (min ${config.minLength} chars)`);
      }
    } catch (error) {
      errors.push(`Error validating ${varName}: ${error}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * SECURITY: Check if code is running on server-side
 * Prevents API keys from being exposed to client
 */
export function ensureServerSide(): void {
  if (typeof window !== 'undefined') {
    throw new Error('This code must run on the server only (security violation)');
  }
}

/**
 * SECURITY: Generate secure random token for CSRF, nonces, etc.
 * Uses crypto.randomBytes for cryptographically secure randomness
 */
export function generateSecureToken(length: number = 32): string {
  if (typeof window !== 'undefined') {
    throw new Error('Cannot generate secure tokens on client-side');
  }
  
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('base64url');
}
