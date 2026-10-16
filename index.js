const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Store
let latestQR = null;
let qrTimeout = null;

// Helper to clear auth
function clearAuth() {
  try {
    if (fs.existsSync('./auth')) {
      fs.rmSync('./auth', { recursive: true, force: true });
    }
  } catch {}
}

// PAIR CODE ROUTE
app.get('/pair', async (req, res) => {
  const number = req.query.number?.replace(/[^0-9]/g, '');
  if (!number) return res.json({ error: 'Enter number with country code' });

  try {
    clearAuth();
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Pearl-MD', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    await delay(1500);
    
    let code = await sock.requestPairingCode(number);
    code = code?.match(/.{1,4}/g)?.join('-') || code;
    
    res.json({ code: code });

  } catch (e) {
    console.error(e);
    res.json({ error: e.message });
  }
});

// QR CODE ROUTE - NEW!
app.get('/qr', async (req, res) => {
  try {
    clearAuth();
    latestQR = null;
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Pearl-MD', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { qr, connection } = update;
      if (qr) {
        latestQR = await QRCode.toDataURL(qr);
      }
      if (connection === 'open') {
        clearAuth();
      }
    });

    // Wait for QR
    let attempts = 0;
    while (!latestQR && attempts < 15) {
      await delay(1000);
      attempts++;
    }

    if (latestQR) {
      res.json({ qr: latestQR });
      // Auto clear after 60 sec
      if (qrTimeout) clearTimeout(qrTimeout);
      qrTimeout = setTimeout(clearAuth, 60000);
    } else {
      res.json({ error: 'Failed to generate QR. Try again' });
    }

  } catch (e) {
    console.error(e);
    res.json({ error: e.message });
  }
});

// SESSION ROUTE
app.get('/session', async (req, res) => {
  try {
    if (!fs.existsSync('./auth/creds.json')) {
      return res.json({ error: 'No session found. Pair first!' });
    }
    const creds = fs.readFileSync('./auth/creds.json', 'utf-8');
    const b64 = Buffer.from(creds).toString('base64');
    const sessionId = 'PEARL~' + b64;
    
    res.json({ session: sessionId });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Pearl Pair running on port ${PORT}`);
});
