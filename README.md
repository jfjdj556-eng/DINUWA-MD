# WhatsApp MD Mini Bot (with built-in pairing website)

A WhatsApp multi-device bot built with Baileys, with commands and a
built-in web page to get your pairing code — no terminal input needed.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set OWNER_NUMBER at least
npm start
```

## Pairing (first run only)

1. Run `npm start`.
2. Open `http://localhost:3000` (or your deployed URL) in a browser.
3. Type your WhatsApp number (with country code) and tap **Pair**.
4. On your phone: WhatsApp > Linked Devices > Link with phone number,
   then enter the code shown on the page.
5. Once linked, the bot saves the session in `auth_info/` and starts
   handling messages — the pairing website only matters until then.

On future restarts, the bot reuses `auth_info/` and skips pairing
automatically, as long as that folder isn't deleted.

## Commands

**General:** `.menu`, `.ping`, `.alive`

**Media:** `.sticker`, `.toimg`, `.ytmp3 <query/link>`, `.ytmp4 <query/link>`

**Group (admin only):** `.tagall`, `.kick`, `.promote`, `.demote`, `.antilink on/off`

**Owner only** (set `OWNER_NUMBER` in `.env`):
`.setemoji <emoji>`, `.addchannel`, `.removechannel`, `.broadcast <message>`

## Deploying to Replit / Render

1. Upload this whole folder (or push to GitHub and import it).
2. Start command: `npm start`.
3. The app already reads `process.env.PORT`, so it works with whatever
   port the platform assigns.
4. Open the deployed URL to pair, same as running locally.

## Notes / known limitations

- `ytdl-core` breaks from time to time when YouTube changes something —
  if `.ytmp3`/`.ytmp4` stop working, that package usually needs an update.
- Channel auto-react uses a Baileys API that's newer and less documented;
  if it errors, check your installed `@whiskeysockets/baileys` version's
  newsletter methods.
- The pairing website has no login — anyone with the URL can request a
  pairing code before you've paired once. Once paired, `/code` always
  responds with `ALREADY-PAIRED`, so this window is short, but consider
  taking the site down (or adding a password) right after pairing if
  it's deployed publicly.
