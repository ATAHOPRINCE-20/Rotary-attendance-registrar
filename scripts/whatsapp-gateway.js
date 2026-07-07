const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

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

// Maps to store multiple active socket connections and states keyed by sessionId
const sessions = new Map();
const sessionStatuses = new Map();
const sessionQRs = new Map();

async function connectToWhatsApp(sessionId, phoneNumber = null) {
    if (sessions.has(sessionId) && sessionStatuses.get(sessionId) === 'connected') {
        console.log(`Session ${sessionId} is already active.`);
        return;
    }

    sessionStatuses.set(sessionId, 'initializing');
    sessionQRs.delete(sessionId);

    // Session state will be saved inside 'baileys_auth_info/{sessionId}'
    const authFolder = path.join(__dirname, 'baileys_auth_info', sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false // We will print it manually and save it for API
    });

    if (phoneNumber && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`[SESSION: ${sessionId}] Pairing Code: ${code}`);
                sessionQRs.set(sessionId, `PAIRING_CODE:${code}`);
                sessionStatuses.set(sessionId, 'waiting_for_qr');
            } catch (err) {
                console.error(`[SESSION: ${sessionId}] Pairing code error:`, err);
            }
        }, 3000);
    }

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // Monitor connection updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            const currentQR = sessionQRs.get(sessionId);
            if (!currentQR || !currentQR.startsWith('PAIRING_CODE:')) {
                console.clear();
                console.log(`\n====================================================================`);
                console.log(`[SESSION: ${sessionId}]`);
                console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP MOBILE APP TO AUTHENTICATE:');
                console.log(`====================================================================\n`);
                qrcode.generate(qr, { small: true });
                
                // Save state for the API
                sessionQRs.set(sessionId, qr);
                sessionStatuses.set(sessionId, 'waiting_for_qr');
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[SESSION: ${sessionId}] Connection closed due to: `, lastDisconnect?.error || 'Unknown error');
            sessions.delete(sessionId);
            sessionStatuses.set(sessionId, 'disconnected');
            sessionQRs.delete(sessionId);
            
            if (shouldReconnect) {
                console.log(`[SESSION: ${sessionId}] Reconnecting to WhatsApp...`);
                setTimeout(() => connectToWhatsApp(sessionId, phoneNumber), 3000); // Wait 3s before reconnecting
            } else {
                console.log(`[SESSION: ${sessionId}] Logged out or conflicting session. Automatically clearing credentials.`);
                if (fs.existsSync(authFolder)) {
                    fs.rmSync(authFolder, { recursive: true, force: true });
                }
            }
        } else if (connection === 'open') {
            console.clear();
            console.log(`\n==========================================================`);
            console.log(`SUCCESS: WhatsApp Connection for [${sessionId}] is active and online!`);
            console.log(`==========================================================\n`);
            
            sessions.set(sessionId, sock);
            sessionStatuses.set(sessionId, 'connected');
            sessionQRs.delete(sessionId); // QR no longer needed
        }
    });

    // Store the socket in the map immediately so we can reference it
    sessions.set(sessionId, sock);
}

// Endpoint to get the current status and QR code of a session
app.get('/session/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId parameter' });
    }

    const status = sessionStatuses.get(sessionId) || 'not_started';
    const qr = sessionQRs.get(sessionId) || null;

    return res.status(200).json({ status, qr });
});

// Endpoint to start a session and generate QR code for a specific club
app.post('/session/start/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { phone } = req.body || {};
    
    if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId parameter' });
    }

    if (sessionStatuses.get(sessionId) === 'connected') {
        return res.status(200).json({ message: `Session ${sessionId} is already active.`, status: 'connected' });
    }

    connectToWhatsApp(sessionId, phone);
    return res.status(200).json({ message: `Initializing session ${sessionId}...`, status: 'initializing' });
});

// HTTP API Endpoint to send message via a specific session
app.post('/send-whatsapp/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { phone, message } = req.body;

    if (!sessionId || !phone || !message) {
        return res.status(400).json({ error: 'Missing sessionId, phone, or message parameter' });
    }

    const sock = sessions.get(sessionId);

    if (!sock || sessionStatuses.get(sessionId) !== 'connected') {
        return res.status(404).json({ error: `WhatsApp client for session [${sessionId}] is not initialized or not connected. Call /session/start/${sessionId} first.` });
    }

    try {
        // Sanitize phone: keep only numbers
        let cleanPhone = phone.replace(/\D/g, '');
        
        // Auto-format Ugandan numbers if they start with 0 (e.g. 075... -> 25675...)
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '256' + cleanPhone.substring(1);
        }
        // Fallback for missing country code (if they typed 757... instead of 0757...)
        else if (cleanPhone.length === 9) {
            cleanPhone = '256' + cleanPhone;
        }
        
        // Target format for Baileys JID is: country_code + number + @s.whatsapp.net
        const jid = `${cleanPhone}@s.whatsapp.net`;

        // Send the text message
        await sock.sendMessage(jid, { text: message });
        console.log(`[SESSION: ${sessionId}] Successfully sent message to ${phone}`);
        return res.status(200).json({ success: true, messageId: jid });
    } catch (err) {
        console.error(`[SESSION: ${sessionId}] Failed to send message:`, err);
        return res.status(500).json({ error: err.message || 'Failed to send WhatsApp message.' });
    }
});

// Endpoint to logout and delete a session
app.post('/session/delete/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId parameter' });
    }

    try {
        const sock = sessions.get(sessionId);
        if (sock) {
            try {
                sock.ev.removeAllListeners();
            } catch (e) {
                console.error(`[SESSION: ${sessionId}] Error removing listeners:`, e);
            }
            sessions.delete(sessionId);
        }
        
        sessionStatuses.set(sessionId, 'not_started');
        sessionQRs.delete(sessionId);
        
        // Delete the credentials folder
        const authFolder = path.join(__dirname, 'baileys_auth_info', sessionId);
        if (fs.existsSync(authFolder)) {
            fs.rmSync(authFolder, { recursive: true, force: true });
        }
        
        console.log(`[SESSION: ${sessionId}] Successfully logged out and deleted session data.`);
        return res.status(200).json({ success: true, message: 'Session deleted' });
    } catch (err) {
        console.error(`[SESSION: ${sessionId}] Failed to delete session:`, err);
        return res.status(500).json({ error: err.message || 'Failed to delete session' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Multi-Tenant WhatsApp Baileys Gateway Server listening on port ${PORT}`);
    console.log(`\nUsage:\n1. POST to http://localhost:${PORT}/session/start/your-club-id to generate a QR Code in this terminal.`);
    console.log(`2. POST to http://localhost:${PORT}/send-whatsapp/your-club-id with { "phone": "...", "message": "..." } to send messages.\n`);
    
    // Automatically connect existing sessions based on folders
    const authBasePath = path.join(__dirname, 'baileys_auth_info');
    if (fs.existsSync(authBasePath)) {
        const existingSessions = fs.readdirSync(authBasePath).filter(file => {
            return fs.statSync(path.join(authBasePath, file)).isDirectory();
        });
        
        if (existingSessions.length > 0) {
            console.log(`Found ${existingSessions.length} existing sessions. Reconnecting...`);
            existingSessions.forEach(sessionId => {
                connectToWhatsApp(sessionId);
            });
        }
    }
});
