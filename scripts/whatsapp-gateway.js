const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const app = express();
app.use(express.json());

// Enable CORS middleware for browser-to-server requests during local development
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

let sock = null;

async function connectToWhatsApp() {
    // Session state will be saved inside the 'baileys_auth_info' directory
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false // We will print it manually using qrcode-terminal with clear layout
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // Monitor connection updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.clear();
            console.log('====================================================================');
            console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP MOBILE APP TO AUTHENTICATE:');
            console.log('====================================================================\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to: ', lastDisconnect?.error || 'Unknown error');
            if (shouldReconnect) {
                console.log('Reconnecting to WhatsApp...');
                connectToWhatsApp();
            } else {
                console.log('Logged out of WhatsApp. Run: rm -rf baileys_auth_info to clear credentials and scan again.');
            }
        } else if (connection === 'open') {
            console.clear();
            console.log('\n==========================================================');
            console.log('SUCCESS: WhatsApp Connection is active and online!');
            console.log('==========================================================\n');
        }
    });
}

// HTTP API Endpoint to send message
app.post('/send-whatsapp', async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ error: 'Missing phone or message parameter' });
    }

    try {
        if (!sock) {
            return res.status(500).json({ error: 'WhatsApp client is not initialized.' });
        }

        // Sanitize phone: keep only numbers
        let cleanPhone = phone.replace(/\D/g, '');
        
        // Target format for Baileys JID is: country_code + number + @s.whatsapp.net
        const jid = `${cleanPhone}@s.whatsapp.net`;

        // Send the text message
        await sock.sendMessage(jid, { text: message });
        console.log(`Successfully sent message to ${phone}`);
        return res.status(200).json({ success: true, messageId: jid });
    } catch (err) {
        console.error('Failed to send message:', err);
        return res.status(500).json({ error: err.message || 'Failed to send WhatsApp message.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`WhatsApp Baileys Gateway Server listening on port ${PORT}`);
    console.log('Initializing WhatsApp connection, please wait...');
    connectToWhatsApp();
});
