const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// The Brevo proxy endpoint
app.post('/proxy-brevo', async (req, res) => {
    try {
        const apiKey = req.headers['api-key'];
        
        if (!apiKey) {
            return res.status(401).json({ error: 'Missing api-key header' });
        }

        console.log(`[Brevo Proxy] Forwarding email request to Brevo API...`);
        
        // Forward the exact same payload to Brevo
        const response = await axios.post('https://api.brevo.com/v3/smtp/email', req.body, {
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            validateStatus: () => true // Allow all status codes to be handled manually
        });

        if (response.status >= 400) {
            console.error('[Brevo Proxy] Error from Brevo:', response.data);
            return res.status(response.status).json(response.data);
        }

        console.log(`[Brevo Proxy] Success! Message ID: ${response.data.messageId}`);
        return res.status(200).json(response.data);
    } catch (error) {
        console.error('[Brevo Proxy] Internal Server Error:', error);
        return res.status(500).json({ error: error.message });
    }
});

// The Relworx proxy endpoint (for forwarding payment requests via static VPS IP ugpay.tech)
app.all('/proxy-relworx', async (req, res) => {
    try {
        const targetUrl = req.headers['x-target-url'] || req.query.targetUrl;
        if (!targetUrl) {
            return res.status(400).json({ error: 'Missing x-target-url header or targetUrl query parameter' });
        }

        const authHeader = req.headers['authorization'];
        console.log(`[Relworx Proxy] Forwarding ${req.method} request to ${targetUrl}...`);

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.method !== 'GET' ? req.body : undefined,
            headers: {
                'accept': req.headers['accept'] || 'application/vnd.relworx.v2',
                'content-type': 'application/json',
                ...(authHeader ? { 'authorization': authHeader } : {})
            },
            validateStatus: () => true
        });

        console.log(`[Relworx Proxy] Relworx returned status ${response.status}`);
        return res.status(response.status).json(response.data);
    } catch (error) {
        console.error('[Relworx Proxy] Internal Server Error:', error.message);
        return res.status(500).json({ error: error.message });
    }
});

// Start the server on port 3001 (since 3000 is used by WhatsApp)
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Proxy Server (Brevo & Relworx) running on http://localhost:${PORT}`);
});
