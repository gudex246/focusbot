import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Safely resolve database directory and path
function initializeDatabase(): Database.Database {
  // Always default to persistent workspace data directory
  let targetPath = path.resolve(process.cwd(), 'data', 'confessions.db');

  // If in custom Docker production volume (e.g. Railway /app/data/confessions.db)
  if (process.env.DATABASE_PATH && !process.env.DATABASE_PATH.includes('DB_PATH=')) {
    targetPath = path.isAbsolute(process.env.DATABASE_PATH)
      ? process.env.DATABASE_PATH
      : path.resolve(process.cwd(), process.env.DATABASE_PATH);
  }

  // Ensure directory exists
  try {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const db = new Database(targetPath);
    return db;
  } catch (err) {
    console.warn(`Could not open database at ${targetPath}, falling back to local confessions.db:`, err);
    const fallbackPath = path.resolve(process.cwd(), 'confessions.db');
    const db = new Database(fallbackPath);
    return db;
  }
}

const db = initializeDatabase();

// Enable WAL mode for better concurrency & sleep-safe persistence
try {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('wal_checkpoint(TRUNCATE)');
} catch (e) {
  // Ignored if memory or WAL unsupported
}

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS confessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    formatted_id TEXT,
    category TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    moderated_by TEXT,
    moderator_name TEXT,
    moderated_at TEXT,
    rejection_reason TEXT,
    telegram_channel_msg_id INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_message_tracker (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confession_id INTEGER NOT NULL,
    admin_id TEXT NOT NULL,
    message_id INTEGER NOT NULL,
    chat_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(confession_id) REFERENCES confessions(id)
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    telegram_id TEXT PRIMARY KEY,
    language TEXT NOT NULL DEFAULT 'en',
    last_submission_time INTEGER NOT NULL DEFAULT 0,
    submissions_today INTEGER NOT NULL DEFAULT 0,
    last_submission_date TEXT,
    session_step TEXT DEFAULT 'idle',
    session_category TEXT,
    session_text TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bot_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Gracefully add session columns if table already existed without them
try {
  db.exec(`ALTER TABLE user_profiles ADD COLUMN session_step TEXT DEFAULT 'idle'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE user_profiles ADD COLUMN session_category TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE user_profiles ADD COLUMN session_text TEXT`);
} catch (e) {}

export interface Confession {
  id: number;
  formatted_id: string;
  category: string;
  language: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  moderated_by: string | null;
  moderator_name: string | null;
  moderated_at: string | null;
  rejection_reason: string | null;
  telegram_channel_msg_id: number | null;
  created_at: string;
}

export interface AdminMessageTracker {
  id: number;
  confession_id: number;
  admin_id: string;
  message_id: number;
  chat_id: string;
  created_at: string;
}

export interface UserProfile {
  telegram_id: string;
  language: string;
  last_submission_time: number;
  submissions_today: number;
  last_submission_date: string;
  created_at: string;
}

export interface BotStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  todayCount: number;
  byCategory: { category: string; count: number }[];
  byLanguage: { language: string; count: number }[];
}

export const dbService = {
  // Confessions
  createConfession(category: string, language: string, content: string): Confession {
    const createdAt = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO confessions (category, language, content, status, created_at)
      VALUES (?, ?, ?, 'PENDING', ?)
    `);
    const result = insert.run(category, language, content, createdAt);
    const id = Number(result.lastInsertRowid);
    const formattedId = `#FC-${String(id).padStart(4, '0')}`;

    db.prepare(`UPDATE confessions SET formatted_id = ? WHERE id = ?`).run(formattedId, id);

    this.logActivity('CONFESSION_SUBMITTED', `New confession submitted: ${formattedId} [${category}] [${language}]`);
    this.checkpoint();

    return this.getConfessionById(id)!;
  },

  getConfessionById(id: number): Confession | undefined {
    const stmt = db.prepare(`SELECT * FROM confessions WHERE id = ?`);
    return stmt.get(id) as Confession | undefined;
  },

  getPendingConfessions(limit = 50): Confession[] {
    const stmt = db.prepare(`SELECT * FROM confessions WHERE status = 'PENDING' ORDER BY id ASC LIMIT ?`);
    return stmt.all(limit) as Confession[];
  },

  getConfessions(params?: {
    status?: string;
    category?: string;
    language?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): { items: Confession[]; total: number } {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.status && params.status !== 'ALL') {
      conditions.push('status = ?');
      values.push(params.status);
    }
    if (params?.category && params.category !== 'ALL') {
      conditions.push('category = ?');
      values.push(params.category);
    }
    if (params?.language && params.language !== 'ALL') {
      conditions.push('language = ?');
      values.push(params.language);
    }
    if (params?.search && params.search.trim()) {
      conditions.push('(content LIKE ? OR formatted_id LIKE ?)');
      const s = `%${params.search.trim()}%`;
      values.push(s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM confessions ${whereClause}`);
    const countResult = countStmt.get(...values) as { total: number };

    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    const queryStmt = db.prepare(`
      SELECT * FROM confessions 
      ${whereClause} 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
    `);

    const items = queryStmt.all(...values, limit, offset) as Confession[];

    return {
      items,
      total: countResult?.total || 0,
    };
  },

  approveConfession(id: number, adminId: string, moderatorName = 'Admin', channelMsgId?: number): { success: boolean; error?: string; confession?: Confession } {
    const existing = this.getConfessionById(id);
    if (!existing) {
      return { success: false, error: 'Confession not found' };
    }
    if (existing.status !== 'PENDING') {
      return { success: false, error: `Already moderated (${existing.status}) by ${existing.moderated_by}` };
    }

    const moderatedAt = new Date().toISOString();
    db.prepare(`
      UPDATE confessions 
      SET status = 'APPROVED', 
          moderated_by = ?, 
          moderator_name = ?, 
          moderated_at = ?,
          telegram_channel_msg_id = ?
      WHERE id = ?
    `).run(adminId, moderatorName, moderatedAt, channelMsgId || null, id);

    this.logActivity('CONFESSION_APPROVED', `Confession ${existing.formatted_id} approved by ${moderatorName} (${adminId})`);
    this.checkpoint();
    return { success: true, confession: this.getConfessionById(id) };
  },

  rejectConfession(id: number, adminId: string, moderatorName = 'Admin', reason = 'Violates fellowship guidelines'): { success: boolean; error?: string; confession?: Confession } {
    const existing = this.getConfessionById(id);
    if (!existing) {
      return { success: false, error: 'Confession not found' };
    }
    if (existing.status !== 'PENDING') {
      return { success: false, error: `Already moderated (${existing.status}) by ${existing.moderated_by}` };
    }

    const moderatedAt = new Date().toISOString();
    db.prepare(`
      UPDATE confessions 
      SET status = 'REJECTED', 
          moderated_by = ?, 
          moderator_name = ?, 
          moderated_at = ?, 
          rejection_reason = ?
      WHERE id = ?
    `).run(adminId, moderatorName, moderatedAt, reason, id);

    this.logActivity('CONFESSION_REJECTED', `Confession ${existing.formatted_id} rejected by ${moderatorName} (${adminId}). Reason: ${reason}`);
    this.checkpoint();
    return { success: true, confession: this.getConfessionById(id) };
  },

  // Admin message tracking (to update messages across all admins)
  trackAdminMessage(confessionId: number, adminId: string, messageId: number, chatId: string) {
    db.prepare(`
      INSERT INTO admin_message_tracker (confession_id, admin_id, message_id, chat_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(confessionId, adminId, messageId, chatId, new Date().toISOString());
  },

  getAdminTrackers(confessionId: number): AdminMessageTracker[] {
    return db.prepare(`SELECT * FROM admin_message_tracker WHERE confession_id = ?`).all(confessionId) as AdminMessageTracker[];
  },

  // User Profiles and anti-spam (stored strictly decoupled from confessions)
  getUserProfile(telegramId: string): UserProfile {
    const row = db.prepare(`SELECT * FROM user_profiles WHERE telegram_id = ?`).get(telegramId) as UserProfile | undefined;
    if (row) return row;

    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO user_profiles (telegram_id, language, last_submission_time, submissions_today, last_submission_date, created_at)
      VALUES (?, 'en', 0, 0, '', ?)
    `).run(telegramId, createdAt);

    return {
      telegram_id: telegramId,
      language: 'en',
      last_submission_time: 0,
      submissions_today: 0,
      last_submission_date: '',
      created_at: createdAt,
    };
  },

  setUserLanguage(telegramId: string, language: string) {
    this.getUserProfile(telegramId);
    db.prepare(`UPDATE user_profiles SET language = ? WHERE telegram_id = ?`).run(language, telegramId);
  },

  getUserSession(telegramId: string): {
    step: 'idle' | 'choosing_category' | 'waiting_for_text' | 'awaiting_confirmation';
    category?: string;
    pendingText?: string;
    language: string;
  } {
    const profile = this.getUserProfile(telegramId) as any;
    return {
      step: (profile.session_step as any) || 'idle',
      category: profile.session_category || undefined,
      pendingText: profile.session_text || undefined,
      language: profile.language || 'en',
    };
  },

  updateUserSession(
    telegramId: string,
    session: {
      step?: 'idle' | 'choosing_category' | 'waiting_for_text' | 'awaiting_confirmation';
      category?: string | null;
      pendingText?: string | null;
    }
  ) {
    this.getUserProfile(telegramId);
    db.prepare(`
      UPDATE user_profiles 
      SET session_step = COALESCE(?, session_step),
          session_category = CASE WHEN ? IS NOT NULL THEN ? ELSE session_category END,
          session_text = CASE WHEN ? IS NOT NULL THEN ? ELSE session_text END
      WHERE telegram_id = ?
    `).run(
      session.step ?? null,
      session.category !== undefined ? 1 : null,
      session.category ?? null,
      session.pendingText !== undefined ? 1 : null,
      session.pendingText ?? null,
      telegramId
    );
  },

  clearUserSession(telegramId: string) {
    if (telegramId === 'ALL') {
      db.prepare(`UPDATE user_profiles SET session_step = 'idle', session_category = NULL, session_text = NULL`).run();
      return;
    }
    db.prepare(`
      UPDATE user_profiles 
      SET session_step = 'idle', session_category = NULL, session_text = NULL 
      WHERE telegram_id = ?
    `).run(telegramId);
  },

  checkRateLimit(telegramId: string): { allowed: boolean; waitSeconds?: number; reason?: string } {
    const profile = this.getUserProfile(telegramId);
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    // Admin accounts bypass rate limits for testing and operations
    const ADMIN_IDS = ['8288768451', '500809303', '1797336624', '891456621', '6998904064', '728967558', '1212461660'];
    if (ADMIN_IDS.includes(telegramId)) {
      return { allowed: true };
    }

    // Cooldown between submissions: 5 seconds (rapid but safe)
    const COOLDOWN_SECONDS = 5;
    const elapsedSeconds = Math.floor((now - profile.last_submission_time) / 1000);
    if (elapsedSeconds < COOLDOWN_SECONDS && profile.last_submission_time > 0) {
      return {
        allowed: false,
        waitSeconds: COOLDOWN_SECONDS - elapsedSeconds,
        reason: 'COOLDOWN',
      };
    }

    // Daily limit: 30 confessions per day per user
    const DAILY_LIMIT = 30;
    const countToday = profile.last_submission_date === today ? profile.submissions_today : 0;
    if (countToday >= DAILY_LIMIT) {
      return {
        allowed: false,
        reason: 'DAILY_LIMIT',
      };
    }

    return { allowed: true };
  },

  recordUserSubmission(telegramId: string) {
    const profile = this.getUserProfile(telegramId);
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const countToday = profile.last_submission_date === today ? profile.submissions_today + 1 : 1;

    db.prepare(`
      UPDATE user_profiles 
      SET last_submission_time = ?, submissions_today = ?, last_submission_date = ?
      WHERE telegram_id = ?
    `).run(now, countToday, today, telegramId);
  },

  // Stats
  getStats(): BotStats {
    const totalRow = db.prepare(`SELECT COUNT(*) as c FROM confessions`).get() as { c: number };
    const pendingRow = db.prepare(`SELECT COUNT(*) as c FROM confessions WHERE status = 'PENDING'`).get() as { c: number };
    const approvedRow = db.prepare(`SELECT COUNT(*) as c FROM confessions WHERE status = 'APPROVED'`).get() as { c: number };
    const rejectedRow = db.prepare(`SELECT COUNT(*) as c FROM confessions WHERE status = 'REJECTED'`).get() as { c: number };

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRow = db.prepare(`SELECT COUNT(*) as c FROM confessions WHERE created_at LIKE ?`).get(`${todayStr}%`) as { c: number };

    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count FROM confessions GROUP BY category ORDER BY count DESC
    `).all() as { category: string; count: number }[];

    const byLanguage = db.prepare(`
      SELECT language, COUNT(*) as count FROM confessions GROUP BY language ORDER BY count DESC
    `).all() as { language: string; count: number }[];

    return {
      total: totalRow?.c || 0,
      pending: pendingRow?.c || 0,
      approved: approvedRow?.c || 0,
      rejected: rejectedRow?.c || 0,
      todayCount: todayRow?.c || 0,
      byCategory,
      byLanguage,
    };
  },

  // Logs & Audit
  logActivity(action: string, details: string) {
    try {
      db.prepare(`INSERT INTO bot_logs (action, details, created_at) VALUES (?, ?, ?)`).run(
        action,
        details,
        new Date().toISOString()
      );
    } catch (e) {
      console.error('Failed to log activity:', e);
    }
  },

  getRecentLogs(limit = 30): { id: number; action: string; details: string; created_at: string }[] {
    return db.prepare(`SELECT * FROM bot_logs ORDER BY id DESC LIMIT ?`).all(limit) as any[];
  },

  seedInitialDataIfNeeded() {
    const row = db.prepare(`SELECT COUNT(*) as count FROM confessions`).get() as { count: number };
    if (row.count === 0) {
      const samples = [
        {
          cat: 'prayer',
          lang: 'am',
          content: 'ሰላም ለሁላችሁ። በዚህ ሳምንት ለፈተና እየተዘጋጀሁ ነው፣ እንዲሁም በቤተሰቤ ውስጥ አንዳንድ ጭንቀቶች አሉ። እባካችሁ በጸሎታችሁ አስቡኝ፣ ጌታ ሰላሙንና ጥበቡን እንዲሰጠኝ።',
          status: 'PENDING',
        },
        {
          cat: 'testimony',
          lang: 'om',
          content: 'Waaqayyo guddaadha! Kadhannaa ji\'a darbe waldattiin naaf gooteen fayyina argadheera. Amantii kootiinis guddachaa jira. Gooftaan haa ulfaatu!',
          status: 'APPROVED',
          moderator: '8288768451',
          name: 'Pastor / Admin Team',
        },
        {
          cat: 'confession',
          lang: 'en',
          content: 'I have been struggling with secret pride and comparing myself to others in church fellowship. I want to genuinely ask for forgiveness from God and learn to walk in genuine humility.',
          status: 'APPROVED',
          moderator: '500809303',
          name: 'Elder Admin',
        },
        {
          cat: 'relationship',
          lang: 'am',
          content: 'በጓደኝነት ውስጥ ይቅር የማለት ነገር ፈተና ሆኖብኛል። ላለፉት ጥቂት ወራት በውስጤ ቅሬታ ይዤ ኖሬያለሁ። ዛሬ በጌታ ፊት ይቅር ለማለት ወስኛለሁ። ጸልዩልኝ።',
          status: 'PENDING',
        },
      ];

      for (const s of samples) {
        const c = this.createConfession(s.cat, s.lang, s.content);
        if (s.status === 'APPROVED') {
          this.approveConfession(c.id, s.moderator || '8288768451', s.name || 'Admin', 101);
        }
      }
    }
  },

  getSetting(key: string): string | null {
    try {
      const row = db.prepare(`SELECT value FROM bot_settings WHERE key = ?`).get(key) as { value: string } | undefined;
      return row ? row.value : null;
    } catch {
      return null;
    }
  },

  setSetting(key: string, value: string) {
    try {
      db.prepare(`INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`).run(key, value, value);
    } catch (e) {
      console.warn('Failed to set setting:', e);
    }
  },

  checkpoint(mode: 'PASSIVE' | 'TRUNCATE' = 'PASSIVE') {
    try {
      db.pragma(`wal_checkpoint(${mode})`);
    } catch (e) {
      // Ignore if DB closed or in-memory
    }
  },
};

// Seed on startup if first time
dbService.seedInitialDataIfNeeded();

export default db;
