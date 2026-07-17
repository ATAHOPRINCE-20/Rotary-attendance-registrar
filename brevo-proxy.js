const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// The proxy endpoint
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

// Start the server on port 3001 (since 3000 is used by WhatsApp)
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Brevo Proxy Server running on http://localhost:${PORT}`);
});
