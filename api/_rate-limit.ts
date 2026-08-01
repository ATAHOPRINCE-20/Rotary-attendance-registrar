import { Redis } from '@upstash/redis';
import type { VercelRequest } from '@vercel/node';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';

const redis = redisUrl && redisToken 
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

export async function rateLimit(
  req: VercelRequest,
  action: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ success: boolean; error?: string }> {
  if (!redis) {
    return { success: true };
  }

  let ip = req.headers['x-forwarded-for'] || '127.0.0.1';
  if (Array.isArray(ip)) ip = ip[0];
  ip = ip.split(',')[0].trim();

  const key = `rate-limit:${action}:${ip}`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    
    if (current > maxRequests) {
      return { success: false, error: 'Too many requests. Please try again later.' };
    }
    
    return { success: true };
  } catch (err) {
    console.error('Rate limit check failed (bypassing):', err);
    return { success: true };
  }
}
