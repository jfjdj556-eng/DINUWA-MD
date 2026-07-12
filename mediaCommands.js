const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const ytdl = require('ytdl-core');
const yts = require('yt-search');

const { PREFIX, BOT_NAME, OWNER_NAME } = require('./config');

// Downloads the media in a quoted message (or the message itself if it has media).
// Returns { buffer, type } or null if there's no usable media.
async function downloadQuoted(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quotedMsg = ctx?.quotedMessage;

  const target = quotedMsg
    ? {
        key: {
          remoteJid: msg.key.remoteJid,
          id: ctx.stanzaId,
          participant: ctx.participant,
        },
        message: quotedMsg,
      }
    : msg;

  const type = Object.keys(target.message || {})[0];
  if (!['imageMessage', 'videoMessage', 'stickerMessage'].includes(type)) return null;

  const buffer = await downloadMediaMessage(target, 'buffer', {});
  return { buffer, type };
}

async function searchYoutube(query) {
  const result = await yts(query);
  return result.videos?.[0] || null;
}

module.exports = {
  sticker: async (sock, msg, from) => {
    const media = await downloadQuoted(msg);
    if (!media || media.type === 'stickerMessage') {
      return sock.sendMessage(from, { text: `Reply to an image or short video with ${PREFIX}sticker` }, { quoted: msg });
    }
    try {
      const stickerObj = new Sticker(media.buffer, {
        pack: BOT_NAME,
        author: OWNER_NAME,
        type: StickerTypes.FULL,
        quality: 70,
      });
      const webpBuffer = await stickerObj.toBuffer();
      await sock.sendMessage(from, { sticker: webpBuffer }, { quoted: msg });
    } catch (err) {
      console.error('sticker error:', err.message);
      await sock.sendMessage(from, { text: '⚠️ Could not create sticker from that file.' }, { quoted: msg });
    }
  },

  toimg: async (sock, msg, from) => {
    const media = await downloadQuoted(msg);
    if (!media || media.type !== 'stickerMessage') {
      return sock.sendMessage(from, { text: `Reply to a sticker with ${PREFIX}toimg` }, { quoted: msg });
    }
    await sock.sendMessage(from, { image: media.buffer }, { quoted: msg });
  },

  ytmp3: async (sock, msg, from, args, text) => {
    const query = text.slice(text.indexOf(' ') + 1).trim();
    if (!query || query === 'ytmp3') {
      return sock.sendMessage(from, { text: `Usage: ${PREFIX}ytmp3 <song name or YouTube link>` }, { quoted: msg });
    }
    await sock.sendMessage(from, { text: '⏳ Searching & downloading audio...' }, { quoted: msg });
    try {
      const video = /^https?:\/\//.test(query) ? { url: query, title: 'audio' } : await searchYoutube(query);
      if (!video) return sock.sendMessage(from, { text: 'No results found.' }, { quoted: msg });

      const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      await sock.sendMessage(
        from,
        { audio: buffer, mimetype: 'audio/mp4', fileName: `${(video.title || 'audio').slice(0, 60)}.mp3` },
        { quoted: msg }
      );
    } catch (err) {
      console.error('ytmp3 error:', err.message);
      await sock.sendMessage(from, { text: '⚠️ Download failed. The link may be invalid or YouTube changed something ytdl-core needs updated for.' }, { quoted: msg });
    }
  },

  ytmp4: async (sock, msg, from, args, text) => {
    const query = text.slice(text.indexOf(' ') + 1).trim();
    if (!query || query === 'ytmp4') {
      return sock.sendMessage(from, { text: `Usage: ${PREFIX}ytmp4 <video name or YouTube link>` }, { quoted: msg });
    }
    await sock.sendMessage(from, { text: '⏳ Searching & downloading video...' }, { quoted: msg });
    try {
      const video = /^https?:\/\//.test(query) ? { url: query, title: 'video' } : await searchYoutube(query);
      if (!video) return sock.sendMessage(from, { text: 'No results found.' }, { quoted: msg });

      const stream = ytdl(video.url, { filter: 'videoandaudio', quality: 'highest' });
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      await sock.sendMessage(
        from,
        { video: buffer, fileName: `${(video.title || 'video').slice(0, 60)}.mp4`, caption: video.title || '' },
        { quoted: msg }
      );
    } catch (err) {
      console.error('ytmp4 error:', err.message);
      await sock.sendMessage(from, { text: '⚠️ Download failed. The link may be invalid or YouTube changed something ytdl-core needs updated for.' }, { quoted: msg });
    }
  },
};
