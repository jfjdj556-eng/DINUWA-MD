const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

const { DEFAULT_REACT_EMOJI } = require('./config');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { groups: {}, channels: [], contacts: [], reactEmoji: DEFAULT_REACT_EMOJI };
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    if (!data.channels) data.channels = [];
    if (!data.contacts) data.contacts = [];
    if (!data.reactEmoji) data.reactEmoji = DEFAULT_REACT_EMOJI;
    return data;
  } catch {
    return { groups: {}, channels: [], contacts: [], reactEmoji: DEFAULT_REACT_EMOJI };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getGroupSettings(groupId) {
  const db = loadDB();
  if (!db.groups[groupId]) {
    db.groups[groupId] = { antilink: false };
    saveDB(db);
  }
  return db.groups[groupId];
}

function setGroupSetting(groupId, key, value) {
  const db = loadDB();
  if (!db.groups[groupId]) db.groups[groupId] = { antilink: false };
  db.groups[groupId][key] = value;
  saveDB(db);
}

// ---- Channels to auto-react to ----
function getChannels() {
  return loadDB().channels;
}

function addChannel(channelJid) {
  const db = loadDB();
  if (!db.channels.includes(channelJid)) {
    db.channels.push(channelJid);
    saveDB(db);
    return true;
  }
  return false;
}

function removeChannel(channelJid) {
  const db = loadDB();
  const before = db.channels.length;
  db.channels = db.channels.filter((c) => c !== channelJid);
  saveDB(db);
  return db.channels.length < before;
}

// ---- React emoji ----
function getReactEmoji() {
  return loadDB().reactEmoji;
}

function setReactEmoji(emoji) {
  const db = loadDB();
  db.reactEmoji = emoji;
  saveDB(db);
}

// ---- Known contacts/chats (for broadcast) ----
function addContact(jid) {
  const db = loadDB();
  if (!db.contacts.includes(jid)) {
    db.contacts.push(jid);
    saveDB(db);
  }
}

function getContacts() {
  return loadDB().contacts;
}

module.exports = {
  getGroupSettings,
  setGroupSetting,
  getChannels,
  addChannel,
  removeChannel,
  getReactEmoji,
  setReactEmoji,
  addContact,
  getContacts,
};
