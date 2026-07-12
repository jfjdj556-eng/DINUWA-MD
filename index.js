// Node 18 doesn't expose the global `File` class that undici (a dependency
// pulled in by Baileys) expects. Polyfill it before anything else loads.
if (typeof globalThis.File === 'undefined') {
  const { File } = require('node:buffer');
  globalThis.File = File;
}

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const express = require('express');

const { PHONE_NUMBER, PREFIX, BOT_NAME } = require('./config');
const commands = require('./commands');
const db = require('./db');

const AUTH_DIR = path.join(__dirname, 'auth_info');
const PORT = process.env.PORT || 3000;

// If a SESSION env var (base64 of the auth_info folder as JSON) is provided,
// restore it before connecting instead of pairing again.
function restoreSessionFromEnv() {
  if (!process.env.SESSION) return;
  if (fs.existsSync(AUTH_DIR)) return; // already have a local session, don't overwrite

  try {
    const json = Buffer.from(process.env.SESSION, 'base64').toString('utf-8');
    const files = JSON.parse(json);
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    for (const [filename, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(AUTH_DIR, filename), JSON.stringify(content));
    }
    console.log('Session restored from SESSION env variable.');
  } catch (err) {
    console.error('Failed to restore session from SESSION env:', err.message);
  }
}

async function startBot() {
  restoreSessionFromEnv();

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: [BOT_NAME, 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  // ---- Built-in pairing website ----
  // Serves the pairing page and a /code endpoint that requests a pairing
  // code for THIS bot's own session, using the same socket created above.
  const app = express();

  // Serve the pairing page with the bot's actual name injected in place of
  // {{BOT_NAME}}. Registered before express.static so it takes priority.
  app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8').replace(/{{BOT_NAME}}/g, BOT_NAME);
    res.send(html);
  });

  app.use(express.static(path.join(__dirname, 'public')));

  let pairingRequested = false;

  app.get('/code', async (req, res) => {
    if (sock.authState.creds.registered) {
      return res.json({ code: 'ALREADY-PAIRED' });
    }

    const number = (req.query.number || PHONE_NUMBER || '').replace(/[^0-9]/g, '');
    if (!number || number.length < 10) {
      return res.status(400).json({ error: 'Please provide a valid phone number with country code.' });
    }

    if (pairingRequested) {
      return res.status(429).json({ error: 'A pairing code was already requested. Refresh and try again if it expired.' });
    }
    pairingRequested = true;

    try {
      const code = await sock.requestPairingCode(number);
      console.log(`\nPairing code for ${number}: ${code}\n`);
      res.json({ code });
    } catch (err) {
      pairingRequested = false;
      console.error('Failed to get pairing code:', err.message);
      res.status(500).json({ error: 'Could not generate a pairing code. Check the number and try again.' });
    }
  });

  if (!sock.authState.creds.registered) {
    app.listen(PORT, () => {
      console.log(`\nOpen the pairing website to link your WhatsApp number:`);
      console.log(`http://localhost:${PORT}\n`);
    });
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp successfully!');
    }
  });

  // ---- Message handling ----
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;

    // Auto-react to new posts in watched channels
    if (from.endsWith('@newsletter')) {
      const watchedChannels = db.getChannels();
      if (watchedChannels.includes(from)) {
        const emoji = db.getReactEmoji();
        const serverId = msg.newsletterServerId || msg.message?.messageContextInfo?.messageSecret;
        try {
          if (sock.newsletterReactMessage && serverId) {
            await sock.newsletterReactMessage(from, String(serverId), emoji);
          }
        } catch (err) {
          console.error('Channel auto-react failed:', err.message);
        }
      }
      return; // don't treat channel posts as commands
    }

    // Track private chats so .broadcast can reach them later
    if (!from.endsWith('@g.us') && !from.endsWith('@broadcast')) {
      db.addContact(from);
    }

    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      '';

    if (!body.startsWith(PREFIX)) return;

    const args = body.slice(PREFIX.length).trim().split(/\s+/);
    const cmdName = args.shift().toLowerCase();

    const handler = commands[cmdName];
    if (!handler) return;

    try {
      await handler(sock, msg, from, args, body);
    } catch (err) {
      console.error(`Error running command "${cmdName}":`, err);
      await sock.sendMessage(from, { text: '⚠️ An error occurred while running that command.' });
    }
  });
}

startBot();
