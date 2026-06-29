import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { webhookUrl, phone, message } = req.body;

  if (!webhookUrl || !phone || !message) {
    return res.status(400).json({ error: 'Missing webhookUrl, phone, or message parameters' });
  }

  try {
    // Forward the request from Vercel (server-side HTTPS) to the user's custom gateway (HTTP)
    // Server-to-server requests bypass all browser CORS and Mixed-Content blocks
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: phone,
        message: message
      })
    });

    const result: any = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to forward message via server-side gateway');
    }

    return res.status(200).json({ success: true, gatewayResponse: result });
  } catch (error: any) {
    console.error('Proxy routing error:', error);
    return res.status(500).json({ error: error.message || 'Failed to proxy WhatsApp message' });
  }
}
