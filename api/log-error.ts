import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logSystemEvent } from './lib/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { level = 'error', source = 'frontend', message, details = {}, organizationId, userId } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    await logSystemEvent({
      level: ['error', 'warn', 'info', 'fatal'].includes(level) ? level : 'error',
      source: `frontend/${source}`,
      message,
      details,
      organizationId: organizationId || null,
      userId: userId || null
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to capture error log' });
  }
}
