# Archix Welcome Bot — Setup Guide

## 1. Create the Bot on Discord

1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it `Archix Welcome Bot`
3. Go to **Bot** (left sidebar) → click **Add Bot**
4. Under **Token** → click **Reset Token** → copy it (you only see it once)
5. Scroll down to **Privileged Gateway Intents** → enable:
   - ✅ **Server Members Intent** (required to detect new members)
   - ✅ **Message Content Intent**
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Manage Roles`, `Send Messages`, `Embed Links`, `Read Message History`
7. Copy the generated URL → open it → add the bot to **Archix Digital**

---

## 2. Create the Roles in Discord

In Archix Digital server settings → **Roles**:

1. Create **Builder** role (suggested color: `#5865F2` blurple)
2. Create **Gamer** role (suggested color: `#57F287` green)
3. **Important**: drag the bot's role ABOVE the Builder and Gamer roles —
   a bot can only assign roles below its own in the hierarchy

---

## 3. Enable Developer Mode & Grab IDs

In Discord: **User Settings → Advanced → Developer Mode** → ON

Then right-click to copy IDs:

| What | How |
|------|-----|
| Server ID | Right-click server name → Copy Server ID |
| #welcome channel ID | Right-click #welcome → Copy Channel ID |
| Community Member role ID | Server Settings → Roles → right-click → Copy Role ID |
| Builder role ID | Same |
| Gamer role ID | Same |

---

## 4. Configure Environment Variables

Copy `.env.example` → `.env` and fill it in:

```env
BOT_TOKEN=your_token_here
GUILD_ID=248171801887244289
WELCOME_CHANNEL_ID=your_welcome_channel_id
ROLE_COMMUNITY_MEMBER=your_community_member_role_id
ROLE_BUILDER=your_builder_role_id
ROLE_GAMER=your_gamer_role_id
```

---

## 5. Run Locally (Test First)

```bash
npm install
npm run dev
```

To simulate a member join for testing, temporarily add the test account to the server.

---

## 6. Deploy to Railway

1. Push this project to a GitHub repo (can be private)
2. Go to https://railway.app → **New Project → Deploy from GitHub**
3. Select your repo
4. Go to **Variables** tab → add all env vars from `.env`
5. Railway auto-detects `railway.json` and deploys

The bot runs as a **worker** (no web server needed) — Railway's free tier handles it fine.

---

## How It Works

```
Member joins
    ↓
Bot DMs them with 3 buttons: Builder / Gamer / Both
    ↓
Member clicks a button
    ↓
Bot assigns Community Member + selected role(s)
    ↓
Bot posts welcome embed in #welcome with @mention
    ↓
DM updates to confirm — buttons disabled
```

**Edge case handled**: if a member has DMs disabled, the bot logs a warning and skips silently. You can extend this to post a fallback in #welcome asking them to pick a role there.
