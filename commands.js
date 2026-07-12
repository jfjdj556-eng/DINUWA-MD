const { PREFIX, BOT_NAME, OWNER_NAME, OWNER_NUMBER } = require('./config');
const db = require('./db');
const mediaCommands = require('./mediaCommands');

const startTime = Date.now();

function isOwner(msg) {
  const sender = (msg.key.participant || msg.key.remoteJid || '').replace(/[^0-9]/g, '');
  return OWNER_NUMBER && sender === OWNER_NUMBER.replace(/[^0-9]/g, '');
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

// Every command handler gets (sock, msg, from, args, text)
const commands = {
  menu: async (sock, msg, from) => {
    const menuText = `
╭───「 *${BOT_NAME}* 」
│ Owner: ${OWNER_NAME}
│ Prefix: ${PREFIX}
╰────────────

*General*
${PREFIX}menu   - show this menu
${PREFIX}ping   - check bot response speed
${PREFIX}alive  - check if bot is online

*Media*
${PREFIX}sticker           - reply to image/video to make a sticker
${PREFIX}toimg             - reply to a sticker to get the image back
${PREFIX}ytmp3 <query/link> - download audio from YouTube
${PREFIX}ytmp4 <query/link> - download video from YouTube

*Group (admin only)*
${PREFIX}tagall   - tag everyone in the group
${PREFIX}kick     - remove a mentioned member
${PREFIX}promote  - make a mentioned member admin
${PREFIX}demote   - remove admin from a mentioned member
${PREFIX}antilink - toggle auto-delete of links (on/off)

*Owner only*
${PREFIX}setemoji <emoji>     - change channel auto-react emoji
${PREFIX}addchannel           - watch current channel for auto-react
${PREFIX}removechannel        - stop watching current channel
${PREFIX}broadcast <message>  - send a message to every known chat

_Powered by Baileys (WhatsApp MD)_`.trim();

    await sock.sendMessage(from, { text: menuText }, { quoted: msg });
  },

  ping: async (sock, msg, from) => {
    const start = Date.now();
    const sent = await sock.sendMessage(from, { text: 'Pinging...' }, { quoted: msg });
    const speed = Date.now() - start;
    await sock.sendMessage(from, { text: `🏓 Pong! ${speed}ms` }, { quoted: msg });
  },

  alive: async (sock, msg, from) => {
    await sock.sendMessage(
      from,
      { text: `✅ ${BOT_NAME} is alive!\nUptime: ${formatUptime(Date.now() - startTime)}` },
      { quoted: msg }
    );
  },

  // ---- Group commands (admin only) ----
  tagall: async (sock, msg, from) => {
    if (!from.endsWith('@g.us')) return;
    const metadata = await sock.groupMetadata(from);
    const participants = metadata.participants.map((p) => p.id);
    const text = participants.map((id) => `@${id.split('@')[0]}`).join(' ');
    await sock.sendMessage(from, { text: `📢 *Tag All*\n${text}`, mentions: participants }, { quoted: msg });
  },

  kick: async (sock, msg, from) => {
    if (!from.endsWith('@g.us')) return;
    const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) return sock.sendMessage(from, { text: 'Mention the member to kick, e.g. .kick @user' }, { quoted: msg });
    await sock.groupParticipantsUpdate(from, [target], 'remove');
  },

  promote: async (sock, msg, from) => {
    if (!from.endsWith('@g.us')) return;
    const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) return sock.sendMessage(from, { text: 'Mention the member to promote, e.g. .promote @user' }, { quoted: msg });
    await sock.groupParticipantsUpdate(from, [target], 'promote');
  },

  demote: async (sock, msg, from) => {
    if (!from.endsWith('@g.us')) return;
    const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) return sock.sendMessage(from, { text: 'Mention the member to demote, e.g. .demote @user' }, { quoted: msg });
    await sock.groupParticipantsUpdate(from, [target], 'demote');
  },

  antilink: async (sock, msg, from, args) => {
    if (!from.endsWith('@g.us')) return;
    const state = (args[0] || '').toLowerCase();
    if (state !== 'on' && state !== 'off') {
      return sock.sendMessage(from, { text: `Usage: ${PREFIX}antilink on / off` }, { quoted: msg });
    }
    db.setGroupSetting(from, 'antilink', state === 'on');
    await sock.sendMessage(from, { text: `🔗 Antilink turned ${state.toUpperCase()}` }, { quoted: msg });
  },

  // ---- Owner-only commands ----
  setemoji: async (sock, msg, from, args) => {
    if (!isOwner(msg)) return;
    const emoji = args[0];
    if (!emoji) return sock.sendMessage(from, { text: `Usage: ${PREFIX}setemoji ❤️` }, { quoted: msg });
    db.setReactEmoji(emoji);
    await sock.sendMessage(from, { text: `✅ Auto-react emoji changed to ${emoji}` }, { quoted: msg });
  },

  addchannel: async (sock, msg, from) => {
    if (!isOwner(msg)) return;
    if (!from.endsWith('@newsletter')) {
      return sock.sendMessage(from, { text: `Send this command inside the channel you want to watch.` }, { quoted: msg });
    }
    const added = db.addChannel(from);
    await sock.sendMessage(from, {
      text: added ? '✅ This channel is now watched for auto-react.' : 'ℹ️ This channel is already being watched.',
    }, { quoted: msg }).catch(() => {});
  },

  removechannel: async (sock, msg, from) => {
    if (!isOwner(msg)) return;
    if (!from.endsWith('@newsletter')) {
      return sock.sendMessage(from, { text: `Send this command inside the channel you want to stop watching.` }, { quoted: msg });
    }
    const removed = db.removeChannel(from);
    await sock.sendMessage(from, {
      text: removed ? '✅ Stopped watching this channel.' : 'ℹ️ This channel was not being watched.',
    }, { quoted: msg }).catch(() => {});
  },

  broadcast: async (sock, msg, from, args, text) => {
    if (!isOwner(msg)) return;
    const message = text.slice(text.indexOf(' ') + 1).trim();
    if (!message || message === 'broadcast') {
      return sock.sendMessage(from, { text: `Usage: ${PREFIX}broadcast Your message here` }, { quoted: msg });
    }
    const contacts = db.getContacts();
    let sent = 0;
    for (const jid of contacts) {
      try {
        await sock.sendMessage(jid, { text: `📢 *Broadcast*\n\n${message}` });
        sent++;
      } catch (err) {
        console.error('Broadcast failed for', jid, err.message);
      }
    }
    await sock.sendMessage(from, { text: `✅ Broadcast sent to ${sent}/${contacts.length} chats.` }, { quoted: msg });
  },
};

module.exports = { ...commands, ...mediaCommands };
