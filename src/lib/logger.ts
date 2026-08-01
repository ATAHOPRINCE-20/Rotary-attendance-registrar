import { supabase } from './supabase';

export type ClientLogLevel = 'error' | 'warn' | 'info' | 'fatal';

export interface ClientLogOptions {
  level?: ClientLogLevel;
  source?: string;
  message: string;
  details?: Record<string, any>;
  organizationId?: string | null;
  userId?: string | null;
}

/**
 * Report client-side UI error, exception, or telemetry log to Super Admin system logs
 */
export async function logClientError({
  level = 'error',
  source = 'frontend',
  message,
  details = {},
  organizationId = null,
  userId = null
}: ClientLogOptions): Promise<void> {
  const timestamp = new Date().toISOString();
  console.error(`[CLIENT_LOG][${level.toUpperCase()}][${source}] ${message}`, details);

  try {
    const payload = {
      level,
      source: `frontend/${source}`,
      message: String(message).slice(0, 1000),
      details: {
        ...details,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      },
      organization_id: organizationId,
      user_id: userId,
      status: 'unresolved',
      created_at: timestamp
    };

    // Insert directly into Supabase system_logs table
    const { error } = await supabase.from('system_logs').insert(payload as any);
    if (error) {
      // Fallback: send via API endpoint
      await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          source,
          message,
          details,
          organizationId,
          userId
        })
      }).catch(() => {});
    }
  } catch (err) {
    // Silent fallback
  }
}
