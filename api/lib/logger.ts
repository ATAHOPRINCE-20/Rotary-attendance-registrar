import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://phczqgytpbisjngwttnb.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoY3pxZ3l0cGJpc2puZ3d0dG5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyNjI1MiwiZXhwIjoyMDk3MjAyMjUyfQ.pbldO9-Z-JYzO4O5yatXFerltXwxnm3vXnAwBc0GL9Y';

function getSupabaseAdmin() {
  const supabaseUrl = 
    process.env.VITE_SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    process.env.SUPABASE_URL || 
    DEFAULT_SUPABASE_URL;

  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    DEFAULT_SUPABASE_KEY;

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}

export type LogLevel = 'error' | 'warn' | 'info' | 'fatal';

export interface LogEventOptions {
  level?: LogLevel;
  source: string;
  message: string;
  details?: Record<string, any>;
  organizationId?: string | null;
  userId?: string | null;
  status?: 'unresolved' | 'acknowledged' | 'resolved';
}

/**
 * Log system events, backend errors, and operational telemetry to Supabase system_logs table
 */
export async function logSystemEvent({
  level = 'error',
  source,
  message,
  details = {},
  organizationId = null,
  userId = null,
  status = 'unresolved'
}: LogEventOptions): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // Format console log output for Vercel/Node runtime logs
  const logPrefix = `[SYSTEM_LOG][${level.toUpperCase()}][${source}]`;
  if (level === 'error' || level === 'fatal') {
    console.error(`${logPrefix} ${message}`, details);
  } else if (level === 'warn') {
    console.warn(`${logPrefix} ${message}`, details);
  } else {
    console.log(`${logPrefix} ${message}`, details);
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Clean details payload to ensure valid JSON
    const sanitizedDetails = typeof details === 'object' && details !== null 
      ? JSON.parse(JSON.stringify(details, (_key, value) => {
          if (value instanceof Error) {
            return { message: value.message, stack: value.stack, name: value.name };
          }
          return value;
        }))
      : { raw: String(details) };

    const payload = {
      level,
      source,
      message: String(message || 'Unknown error').slice(0, 1000),
      details: sanitizedDetails,
      organization_id: organizationId || null,
      user_id: userId || null,
      status,
      created_at: timestamp
    };

    // Insert into system_logs table asynchronously
    const { error } = await supabase.from('system_logs').insert(payload);
    
    if (error) {
      console.warn('[Logger] Failed to persist log to system_logs table:', error.message);
    }
  } catch (err: any) {
    // Fail silently without disrupting main application flow
    console.warn('[Logger] Unexpected exception while writing system log:', err?.message || err);
  }
}
