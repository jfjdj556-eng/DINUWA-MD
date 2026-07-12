require('dotenv').config();

module.exports = {
  // Your WhatsApp number in international format, no + or spaces. e.g. 947XXXXXXXX
  PHONE_NUMBER: process.env.PHONE_NUMBER || '',

  // Prefix used before every command, e.g. "." means .menu, .ping
  PREFIX: process.env.PREFIX || '.',

  // Bot name shown in the menu
  BOT_NAME: process.env.BOT_NAME || 'DINUWA MD',

  // Owner name shown in the menu
  OWNER_NAME: process.env.OWNER_NAME || 'Owner',

  // Owner's WhatsApp number, digits only with country code (no +). Used to
  // restrict owner-only commands like .broadcast, .addchannel, .setemoji
  OWNER_NUMBER: process.env.OWNER_NUMBER || '',

  // Default emoji used to auto-react to posts in watched channels
  DEFAULT_REACT_EMOJI: process.env.DEFAULT_REACT_EMOJI || '❤️',
};
