# 🕊️ Focus Harar Confession – Telegram Bot & Admin System

A production-ready, anonymous Telegram confession and testimony bot built for church fellowship communities.

Features **3-language support** (English, Amharic, and Afaan Oromoo), a **Five-Administrator approval workflow**, **channel auto-publishing**, and a **web-based companion hub**.

---

## 📌 Project Information

- **Project Name:** Focus Harar Confession
- **Bot Username:** [@focusconfessionbot](https://t.me/focusconfessionbot)
- **Designated Channel:** [@focushararconfession](https://t.me/focushararconfession)
- **Authorized Administrators (Telegram IDs):**
  - `8288768451`
  - `500809303`
  - `1797336624`
  - `891456621`
  - `6998904064`
  - `728967558`
  - `1212461660`

---

## 🌟 Key Features

1. **3 Languages Supported:**
   - 🇬🇧 **English**
   - 🇪🇹 **Amharic (አማርኛ)**
   - 🌳 **Afaan Oromoo**
   - Automatically asks users on first `/start` and saves their preference in SQLite.

2. **Strict Anonymity & Privacy:**
   - No sender username, name, or Telegram ID is ever stored with confession text.
   - Decoupled anti-spam engine tracks cooldown (90 seconds) and daily limits (10/day) without linking to confession records.
   - Never exposes who submitted the message to admins or the channel.

3. **5-Admin Moderation System:**
   - All 5 admins immediately receive an instant notification in Telegram when a new confession arrives.
   - Interactive buttons: `[ ✅ Approve & Publish | አጽድቅ ]` and `[ ❌ Reject | ውድቅ አድርግ ]`.
   - **Atomic duplicate prevention:** As soon as any admin acts, the notification is updated across all other admins with moderator name and timestamp.
   - Admin command `/admin` or `/dashboard` provides queue stats and quick review tools.

4. **Channel Auto-Publishing:**
   - Approved confessions are formatted with church borders, category tags, unique ID (`#FC-0001`), biblical encouragement, and published to [@focushararconfession](https://t.me/focushararconfession).

5. **Persistent SQLite Database:**
   - WAL-mode SQLite database preserving all submissions, moderation actions, and user preferences.

---

## 🚀 24/7 Deployment on Railway (Recommended)

To keep this bot **active 24/7/365 forever**:

### Step 1: Deploy to Railway
1. Push this repository to **GitHub** (or click "Deploy from GitHub repo" in Railway).
2. Go to [railway.app](https://railway.app) and create a **New Project**.
3. Select **Deploy from GitHub repo** and choose your repository.

### Step 2: Set Environment Variables on Railway
In Railway Project Settings -> **Variables**, add:
```env
TELEGRAM_BOT_TOKEN=9076811511:AAHDbPOyKNC1rYrAD_8wFsOjosPQ3etCbR8
TELEGRAM_CHANNEL=@focushararconfession
ADMIN_USER_IDS=8288768451,500809303,1797336624,891456621,6998904064,728967558,1212461660
PORT=3000
DATABASE_PATH=/app/data/confessions.db
```

### Step 3: Add Persistent Volume (For Database)
1. In your Railway service dashboard, click **Volumes**.
2. Click **+ Add Volume**.
3. Set the Mount Path to:
   ```
   /app/data
   ```
   *This ensures your SQLite database persists across redeployments and restarts!*

---

## ⚙️ Telegram Channel Setup (Crucial!)

For the bot to post approved confessions to **@focushararconfession**:
1. Open [@focushararconfession](https://t.me/focushararconfession) on Telegram.
2. Go to **Channel Settings** > **Administrators** > **Add Administrator**.
3. Search for `@focusconfessionbot`.
4. Ensure the permission **"Post Messages"** is **TURNED ON**.
5. Save settings.

---

## 👥 How Admins Use the Bot

Each admin should open [@focusconfessionbot](https://t.me/focusconfessionbot) and tap `/start` at least once so Telegram allows the bot to message them.

### Admin Commands:
- `/admin` or `/dashboard`: View live statistics (total, pending, approved, rejected, today's count) and moderation shortcuts.
- `/pending`: Fetch the oldest pending confession to approve or reject right inside Telegram.
- `/rules`: View community guidelines.

---

## 🛠️ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run the fullstack server and Telegram bot
npm run dev

# 3. Open Web Companion Hub
http://localhost:3000
```
