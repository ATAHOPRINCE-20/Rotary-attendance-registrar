import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from './_rate-limit.js';
import { Redis } from '@upstash/redis';

const DEFAULT_SUPABASE_URL = 'https://phczqgytpbisjngwttnb.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoY3pxZ3l0cGJpc2puZ3d0dG5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyNjI1MiwiZXhwIjoyMDk3MjAyMjUyfQ.pbldO9-Z-JYzO4O5yatXFerltXwxnm3vXnAwBc0GL9Y';

function getSupabase() {
  const supabaseUrl = 
    process.env.VITE_SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    process.env.SUPABASE_URL || 
    DEFAULT_SUPABASE_URL;

  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    DEFAULT_SUPABASE_KEY;

  return createClient(supabaseUrl, supabaseKey);
}

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

  // Rate Limiting (30 requests per minute per IP)
  const rateLimitResult = await rateLimit(req, 'clubs', 30, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
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
    const supabase = getSupabase();

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
