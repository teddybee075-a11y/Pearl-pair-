const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));
app.use(require('cors')());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/pair', async (req, res) => {
  let num = req.query.number;
  if (!num) return res.json({ error: "Add ?number=23480xxxxxxx" });
  num = num.replace(/[^0-9]/g, '');
  
  const dir = `./session_${Date.now()}`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  
  try {
    const sock = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:"silent"})) },
      logger: pino({level:"silent"}),
      browser: Browsers.ubuntu("Pearl-Pair"),
      printQRInTerminal: false
    });
    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered) {
      await delay(1500);
      const code = await sock.requestPairingCode(num);
      res.json({ code: code });
    }

    sock.ev.on("connection.update", async (s) => {
      if (s.connection === "open") {
        await delay(3000);
        const credsPath = path.join(dir, "creds.json");
        if (fs.existsSync(credsPath)) {
          const credsData = fs.readFileSync(credsPath);
          const b64 = Buffer.from(credsData).toString('base64');
          const sessionId = `PEARL~${b64}`;
          fs.writeFileSync(path.join(dir, "pearl_session.txt"), sessionId);
          console.log("SESSION:", sessionId);
        }
        setTimeout(()=> { fs.rmSync(dir, {recursive:true, force:true}); }, 10000);
      }
    });
  } catch(e) {
    res.json({ error: e.message });
    if (fs.existsSync(dir)) fs.rmSync(dir, {recursive:true, force:true});
  }
});

app.get('/session', async (req, res) => {
  const dirs = fs.readdirSync('.').filter(d => d.startsWith('session_'));
  for (let d of dirs) {
    const p = path.join(d, "pearl_session.txt");
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf8');
      return res.json({ session: data });
    }
  }
  res.json({ error: "No session yet, pair first" });
});

app.listen(PORT, () => console.log(`Pearl Pair running on ${PORT}`));
