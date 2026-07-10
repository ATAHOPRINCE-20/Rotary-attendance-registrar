import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Only initialize Redis if credentials are provided in env
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';

const redis = redisUrl && redisToken 
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

const CACHE_KEY = 'global:rotary_clubs';
const CACHE_TTL = 86400; // 24 hours in seconds

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Check Redis cache if enabled
    if (redis) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cached);
      }
    }

    // 2. Fetch from Supabase
    const { data: clubs, error } = await supabase
      .from('rotary_clubs')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    // 3. Store in Redis cache with TTL if enabled
    if (redis && clubs) {
      await redis.set(CACHE_KEY, clubs, { ex: CACHE_TTL });
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(clubs);
  } catch (error: any) {
    console.error('Error in /api/clubs:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch clubs' });
  }
}
