import { Telegraf, Markup } from 'telegraf';
import { dbService } from './db.js';
import { TRANSLATIONS, CATEGORIES, Language, formatChannelPost, getCategoryName, escapeHtml } from './i18n.js';

// Setup environment variables with user-specified defaults
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9076811511:AAHDbPOyKNC1rYrAD_8wFsOjosPQ3etCbR8';

function parseChannelId(raw?: string): string {
  if (!raw) return '@focushararconfession';
  let ch = raw.trim();
  if (ch.includes('t.me/')) {
    ch = ch.split('t.me/')[1].split('/')[0].trim();
  }
  if (!ch.startsWith('@') && !ch.startsWith('-')) {
    ch = '@' + ch;
  }
  return ch;
}

export const CHANNEL_ID = parseChannelId(process.env.TELEGRAM_CHANNEL);

const DEFAULT_ADMIN_IDS = ['8288768451', '500809303', '1797336624', '891456621', '6998904064', '728967558', '1212461660'];

export const ADMIN_IDS: string[] = (() => {
  const raw = process.env.ADMIN_USER_IDS || '';
  const parsed = (raw.match(/\d+/g) || []).map((id) => id.trim());
  const list = parsed.length > 0 ? parsed : DEFAULT_ADMIN_IDS;
  const result: string[] = [];
  for (const item of list) {
    if (item.length > 12) {
      for (const known of DEFAULT_ADMIN_IDS) {
        if (item.includes(known) && !result.includes(known)) {
          result.push(known);
        }
      }
    } else if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result.length > 0 ? result : DEFAULT_ADMIN_IDS;
})();

export function isAdmin(userId: string | number): boolean {
  return ADMIN_IDS.includes(String(userId));
}

export const bot = new Telegraf(BOT_TOKEN);

// Global Telegraf error boundary to prevent process crashes or silent deadlocks
bot.catch((err: any, ctx: any) => {
  console.error(`Telegraf error encountered for update ${ctx?.update?.update_id}:`, err?.message || err);
});

// Debouncing to protect against rapid double-clicks ONLY on critical actions
const lastUserActionTime = new Map<string, number>();

function isActionDebounced(userId: string, actionKey: string, cooldownMs = 600): boolean {
  const key = `${userId}:${actionKey}`;
  const now = Date.now();
  const lastTime = lastUserActionTime.get(key) || 0;
  if (now - lastTime < cooldownMs) {
    return true; // Debounced: skip duplicate execution
  }
  lastUserActionTime.set(key, now);
  if (lastUserActionTime.size > 2000) {
    lastUserActionTime.clear();
  }
  return false;
}

// Global middleware: instant callback query answering to prevent spinning button syndrome, plus activity logging and debounce
bot.use(async (ctx, next) => {
  botState.lastActiveAt = new Date().toISOString();
  const userId = ctx.from ? String(ctx.from.id) : '';
  const from = ctx.from ? `${ctx.from.first_name || ''} (@${ctx.from.username || ctx.from.id})` : 'unknown';

  if (ctx.callbackQuery) {
    // Instant answer prevents Telegram loading spinner from hanging
    ctx.answerCbQuery().catch(() => {});
    const data = (ctx.callbackQuery as any).data || 'button';

    // Debounce rapid repeated button clicks from the same user within 600ms
    if (userId && isActionDebounced(userId, `btn_${data}`, 600)) {
      console.log(`[DEBOUNCE] Blocked rapid double-click on button "${data}" from ${userId}`);
      return;
    }

    try {
      dbService.logActivity('BUTTON_CLICK', `${from} clicked: ${data}`);
    } catch (e) {}
  } else if (ctx.message && 'text' in ctx.message) {
    const text = ctx.message.text.trim();
    // Debounce duplicate text message within 600ms from the same user
    if (userId && isActionDebounced(userId, `msg_${text}`, 600)) {
      console.log(`[DEBOUNCE] Blocked rapid duplicate message "${text.substring(0, 30)}" from ${userId}`);
      return;
    }
    const textPreview = text.substring(0, 60);
    try {
      dbService.logActivity('MESSAGE_RECEIVED', `${from}: "${textPreview}"`);
    } catch (e) {}
  }

  return next();
});

export interface BotState {
  status: 'idle' | 'starting' | 'running' | 'error';
  mode: 'polling' | 'webhook';
  botUsername: string;
  webhookUrl: string | null;
  error: string | null;
  startedAt: string | null;
  lastActiveAt: string;
  lastPollAt: string | null;
  pollCycles: number;
}

export const botState: BotState = {
  status: 'idle',
  mode: 'polling',
  botUsername: 'focusconfessionbot',
  webhookUrl: null,
  error: null,
  startedAt: null,
  lastActiveAt: new Date().toISOString(),
  lastPollAt: null,
  pollCycles: 0,
};

// Outbound rate limiter per chat to prevent Telegram 429 penalties
const lastChatReplyTime = new Map<string, number>();

// Safe reply helper: attempts HTML rendering, gracefully handles Telegram rate limits
export async function safeReply(ctx: any, text: string, extra: any = {}) {
  botState.lastActiveAt = new Date().toISOString();
  const chatId = ctx.chat ? String(ctx.chat.id) : '';

  if (chatId) {
    const now = Date.now();
    const lastSent = lastChatReplyTime.get(chatId) || 0;
    if (now - lastSent < 200) {
      // Gentle pacing to maintain safe Telegram rate
      await new Promise((r) => setTimeout(r, 200 - (now - lastSent)));
    }
    lastChatReplyTime.set(chatId, Date.now());
  }

  try {
    return await ctx.reply(text, { parse_mode: 'HTML', ...extra });
  } catch (err: any) {
    if (err.message && err.message.includes('429')) {
      const match = err.message.match(/retry after (\d+)/i);
      const waitSec = match ? Math.min(parseInt(match[1], 10), 3) : 1;
      console.warn(`Telegram 429 rate limit hit in safeReply, retrying in ${waitSec}s...`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      try {
        return await ctx.reply(text, { parse_mode: 'HTML', ...extra });
      } catch (retryErr: any) {
        console.warn('Retry after 429 failed:', retryErr.message);
        return null;
      }
    }
    console.warn('HTML reply failed, falling back to plain text:', err.message);
    const plainText = text.replace(/<[^>]*>/g, '');
    const { parse_mode, ...safeExtra } = extra;
    try {
      return await ctx.reply(plainText, safeExtra);
    } catch (fallbackErr: any) {
      console.warn('Fallback plain text reply failed:', fallbackErr.message);
      return null;
    }
  }
}

function getMainKeyboard(lang: Language) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return Markup.keyboard([
    [t.btn_submit],
    [t.btn_rules, t.btn_language],
    [t.btn_channel],
  ]).resize();
}

function getLanguageInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇬🇧 English', 'set_lang_en'),
      Markup.button.callback('🇪🇹 አማርኛ', 'set_lang_am'),
    ],
    [
      Markup.button.callback('🌳 Afaan Oromoo', 'set_lang_om'),
    ],
  ]);
}

function getCategoriesKeyboard(lang: Language) {
  const buttons = CATEGORIES.map((cat) => [
    Markup.button.callback(`${cat.icon} ${cat[lang]}`, `cat_${cat.id}`),
  ]);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  buttons.push([Markup.button.callback(t.btn_cancel, 'action_cancel')]);
  return Markup.inlineKeyboard(buttons);
}

// ----------------------------------------------------
// Bot Commands & Handlers
// ----------------------------------------------------

// /start command - Welcomes user in a single clean message with main reply keyboard attached
async function handleStartFlow(ctx: any) {
  try {
    const userId = String(ctx.from.id);
    const userFirstName = ctx.from.first_name || '';
    console.log(`[BOT UPDATE] /start received from ${userFirstName} (${userId})`);
    
    // Always clear any previous pending state so the user starts totally fresh
    dbService.clearUserSession(userId);
    const profile = dbService.getUserProfile(userId);
    const lang = (profile.language as Language) || 'en';
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

    // Send ONE pristine welcome message with main keyboard
    await safeReply(
      ctx,
      `🕊️ <b>Welcome to Focus Harar Anonymous Confession Bot</b>\n\n` +
      `Grace and peace to you in Christ! 🙏\n` +
      `የጌታችን የኢየሱስ ክርስቶስ ጸጋና ሰላም ከእናንተ ጋር ይሁን!\n` +
      `Nagaan Gooftaa Yesuus Kiristoos isinii wajjin haa ta'u!\n\n` +
      `🔒 <b>100% Anonymous & Confidential</b>\n\n` +
      `👇 Tap <b>${t.btn_submit}</b> below to submit a confession, prayer request, or testimony.\n\n` +
      `• Supports English, አማርኛ, & Afaan Oromoo\n` +
      `• Tap <b>${t.btn_language}</b> anytime to change language.`,
      getMainKeyboard(lang)
    );
  } catch (err: any) {
    console.error('Error on /start:', err);
    await ctx.reply('🕊️ Welcome! Tap a button below to get started:', getMainKeyboard('en')).catch(() => {});
  }
}

bot.command(['start', 'restart', 'reset'], handleStartFlow);
bot.hears(/^\s*(start|restart|reset|menu|hi|hello|helli|hey|hola|ሰላም|akkam)\s*$/i, handleStartFlow);

// /help and /menu commands
bot.command(['help', 'menu'], async (ctx) => {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const helpText = `🕊️ <b>Focus Harar Fellowship Bot Commands:</b>\n\n` +
    `• /start - Start the bot & choose language\n` +
    `• /submit - Submit anonymous confession or prayer\n` +
    `• /language - Change language (English, አማርኛ, Afaan Oromoo)\n` +
    `• /rules - Privacy policy & moderation guidelines\n` +
    `• /channel - Visit @focushararconfession\n` +
    `• /cancel - Cancel current submission\n` +
    (isAdmin(userId) ? `• /admin - Church admin moderation dashboard\n• /pending - Review pending confessions\n` : '');

  await safeReply(ctx, helpText, getMainKeyboard(lang));
});

// /language command
bot.command('language', async (ctx) => {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  await safeReply(ctx, t.choose_lang, getLanguageInlineKeyboard());
});

// Language callbacks - Confirms language and shows main menu keyboard
bot.action(/set_lang_(en|am|om)/, async (ctx) => {
  try {
    const lang = ctx.match[1] as Language;
    const userId = String(ctx.from.id);
    dbService.setUserLanguage(userId, lang);

    const t = TRANSLATIONS[lang];
    await ctx.answerCbQuery('Language set! / ቋንቋው ተቀይሯል!').catch(() => {});

    // Provide visual feedback by editing the language picker message
    try {
      await ctx.editMessageText(
        `✅ <b>${t.lang_changed}</b>\n\n🕊️ <i>Focus Harar Anonymous Confession</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}

    await safeReply(ctx, t.welcome_body, getMainKeyboard(lang));
  } catch (err) {
    console.error('Error in set_lang callback:', err);
  }
});

// /submit command
bot.command('submit', async (ctx) => {
  await initiateSubmission(ctx);
});

// /rules command
bot.command('rules', async (ctx) => {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  await safeReply(ctx, t.privacy_policy, getMainKeyboard(lang));
});

// /channel command
bot.command('channel', async (ctx) => {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  await safeReply(
    ctx,
    t.channel_info,
    Markup.inlineKeyboard([
      [Markup.button.url('📢 Visit @focushararconfession', 'https://t.me/focushararconfession')],
    ])
  );
});

// Text matching for main menu buttons - supports exact strings and clean keywords
bot.hears([
  '✍️ Submit Confession',
  '✍️ መልእክት / ንስሐ ላክ',
  '✍️ Yaada / Qalbii Jijjiirraa Ergi',
  /^\s*(✍️|submit\s+confession|submit)\s*$/i,
], async (ctx) => {
  await initiateSubmission(ctx);
});

bot.hears([
  '🛡️ Privacy & Guidelines',
  '🛡️ ሚስጥራዊነትና መመሪያ',
  '🛡️ Iccitiifi Qajeelfama',
  /^\s*(🛡️|privacy|rules|policy|guidelines|ሚስጥራዊነት|መመሪያ|iccitii|qajeelfama)\s*$/i,
], async (ctx) => {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  await safeReply(ctx, t.privacy_policy, getMainKeyboard(lang));
});

bot.hears([
  '🌐 Change Language',
  '🌐 ቋንቋ ቀይር',
  '🌐 Afaan Jijjiiri',
  /^\s*(🌐|language|lang|ቋንቋ|afaan)\s*$/i,
], async (ctx) => {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  await safeReply(ctx, t.choose_lang, getLanguageInlineKeyboard());
});

bot.hears([
  '📢 Join Our Channel',
  '📢 ቻናላችንን ተቀላቀል',
  '📢 Chaanaalii Keenya',
  /^\s*(📢|channel|ቻናል|chaanaalii)\s*$/i,
], async (ctx) => {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  await safeReply(
    ctx,
    t.channel_info,
    Markup.inlineKeyboard([
      [Markup.button.url('📢 Visit @focushararconfession', 'https://t.me/focushararconfession')],
    ])
  );
});

// Cancel buttons
bot.hears([
  '❌ Cancel',
  '❌ ሰርዝ',
  '❌ Haqi',
  '/cancel',
  /^\s*(❌|cancel|ሰርዝ|haqi)\s*$/i,
], async (ctx) => {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  dbService.clearUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  await safeReply(ctx, t.cancelled, getMainKeyboard(lang));
});

async function initiateSubmission(ctx: any) {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Always reset previous session state so user starts completely fresh
  dbService.clearUserSession(userId);
  dbService.updateUserSession(userId, { step: 'choosing_category', category: null, pendingText: null });
  await safeReply(ctx, t.choose_category, getCategoriesKeyboard(lang));
}

// Category selection callback
bot.action(/^cat_([a-z_]+)$/, async (ctx) => {
  try {
    const categoryId = ctx.match[1];
    const userId = String(ctx.from.id);
    const session = dbService.getUserSession(userId);
    const lang = (session.language as Language) || 'en';
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

    dbService.updateUserSession(userId, {
      step: 'waiting_for_text',
      category: categoryId,
      pendingText: null,
    });

    await ctx.answerCbQuery().catch(() => {});
    const catName = getCategoryName(categoryId, lang);

    // Disable the category buttons in the previous message
    try {
      await ctx.editMessageText(`✅ Selected: <b>${catName}</b>`, { parse_mode: 'HTML' });
    } catch {}

    // Send a fresh new message with ping and sound so user immediately sees the prompt
    await safeReply(
      ctx,
      t.write_prompt(catName),
      Markup.inlineKeyboard([
        [Markup.button.callback(t.btn_cancel, 'action_cancel')],
      ])
    );
  } catch (err) {
    console.error('Error on cat action:', err);
  }
});

// Cancel inline callback
bot.action('action_cancel', async (ctx) => {
  const userId = String(ctx.from.id);
  const session = dbService.getUserSession(userId);
  dbService.clearUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  await ctx.answerCbQuery().catch(() => {});
  try {
    await ctx.editMessageText(`❌ <b>${t.cancelled}</b>`, { parse_mode: 'HTML' });
  } catch {}
  await safeReply(ctx, t.cancelled, getMainKeyboard(lang));
});

// Receive text message during submission
bot.on('text', async (ctx, next) => {
  const userId = String(ctx.from.id);
  const text = ctx.message.text ? ctx.message.text.trim() : '';

  // Ignore command strings
  if (text.startsWith('/')) {
    return next();
  }

  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // If user is writing text, or typed message while choosing category, or sent any text while idle
  const isSubmissionText =
    session.step === 'waiting_for_text' ||
    session.step === 'awaiting_confirmation' ||
    session.step === 'choosing_category' ||
    (session.step === 'idle' && text.length >= 2);

  if (isSubmissionText) {
    if (text.length > 3000) {
      await safeReply(ctx, '⚠️ Message too long. Please keep it under 3,000 characters.');
      return;
    }

    const assignedCategory = session.category || 'prayer';

    dbService.updateUserSession(userId, {
      step: 'awaiting_confirmation',
      category: assignedCategory,
      pendingText: text,
    });

    const catName = getCategoryName(assignedCategory, lang);

    await safeReply(
      ctx,
      t.confirm_prompt(catName, text),
      Markup.inlineKeyboard([
        [Markup.button.callback(t.btn_confirm, 'confirm_submit')],
        [Markup.button.callback(t.btn_cancel, 'action_cancel')],
      ])
    );
    return;
  }

  // Not a submission text - pass to bot.hears or general fallback
  return next();
});

// Fallback text handler for any remaining unhandled text
bot.hears(/.+/, async (ctx) => {
  const userId = String(ctx.from.id);
  const text = ctx.message.text ? ctx.message.text.trim() : '';
  const session = dbService.getUserSession(userId);
  const lang = (session.language as Language) || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // If there is any content, capture it immediately as a prayer request so the user is never ignored!
  if (text.length >= 2) {
    const assignedCategory = 'prayer';
    dbService.updateUserSession(userId, {
      step: 'awaiting_confirmation',
      category: assignedCategory,
      pendingText: text,
    });
    const catName = getCategoryName(assignedCategory, lang);
    await safeReply(
      ctx,
      t.confirm_prompt(catName, text),
      Markup.inlineKeyboard([
        [Markup.button.callback(t.btn_confirm, 'confirm_submit')],
        [Markup.button.callback(t.btn_cancel, 'action_cancel')],
      ])
    );
    return;
  }

  await safeReply(
    ctx,
    `🕊️ <b>Focus Harar Fellowship Bot</b>\n\n` +
    (lang === 'am'
      ? `የልብ ሸክምዎን፣ የንስሐ ቃልዎን ወይም ምስክርነትዎን በድብቅ ለመላክ እባክዎ ከታች <b>✍️ መልእክት / ንስሐ ላክ</b> የሚለውን ይጫኑ።`
      : lang === 'om'
      ? `Yaada garaa keessanii ykn gaaffii kadhannaa iccitiin erguuf maaloo furtuu <b>✍️ Yaada / Qalbii Jijjiirraa Ergi</b> jedhu tuqaa.`
      : `To submit an anonymous reflection, prayer request, or confession, please tap <b>✍️ Submit Confession</b> below.`),
    getMainKeyboard(lang)
  );
});

// Confirm submission callback
bot.action('confirm_submit', async (ctx) => {
  try {
    const userId = String(ctx.from.id);
    const session = dbService.getUserSession(userId);
    const lang = (session.language as Language) || 'en';
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

    if (!session.category || !session.pendingText) {
      await ctx.answerCbQuery('Session expired. Please start over.').catch(() => {});
      dbService.clearUserSession(userId);
      await safeReply(ctx, t.cancelled, getMainKeyboard(lang));
      return;
    }

    // Double check rate limit
    const check = dbService.checkRateLimit(userId);
    if (!check.allowed) {
      await ctx.answerCbQuery('Please wait a moment...').catch(() => {});
      if (check.reason === 'COOLDOWN' && check.waitSeconds) {
        await safeReply(ctx, t.rate_limited(check.waitSeconds), getMainKeyboard(lang));
      } else {
        await safeReply(ctx, t.daily_limit, getMainKeyboard(lang));
      }
      return;
    }

    // Save confession anonymously to SQLite
    const confession = dbService.createConfession(
      session.category,
      lang,
      session.pendingText
    );

    // Record submission for rate limiting
    dbService.recordUserSubmission(userId);

    // Clear session
    dbService.clearUserSession(userId);

    await ctx.answerCbQuery('✅ Submitted successfully!').catch(() => {});

    // Disable the confirmation button in the previous message
    try {
      await ctx.editMessageText('✅ <b>Confirmed & Sent Anonymously!</b>', { parse_mode: 'HTML' });
    } catch {}

    await safeReply(ctx, t.submission_success, getMainKeyboard(lang));

    // Notify all authorized church administrators
    await notifyAdminsOfNewConfession(confession);
  } catch (err) {
    console.error('Error confirming submission:', err);
    await ctx.answerCbQuery('Error submitting confession. Please try again.').catch(() => {});
  }
});

// ----------------------------------------------------
// Admin System & Moderation Handlers
// ----------------------------------------------------

export async function notifyAdminsOfNewConfession(confession: any) {
  const cat = CATEGORIES.find((c) => c.id === confession.category);
  const catDisplay = cat ? `${cat.icon} ${escapeHtml(cat.en)} | ${escapeHtml(cat.am)}` : escapeHtml(confession.category);

  const adminMsg = `🚨 <b>NEW CONFESSION FOR MODERATION</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 <b>ID:</b> <code>${escapeHtml(confession.formatted_id)}</code>\n` +
    `📁 <b>Category:</b> ${catDisplay}\n` +
    `🌐 <b>Language:</b> ${escapeHtml(confession.language.toUpperCase())}\n` +
    `⏰ <b>Received:</b> ${escapeHtml(new Date(confession.created_at).toUTCString())}\n` +
    `🔒 <b>Identity:</b> Guaranteed 100% Anonymous\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `"<i>${escapeHtml(confession.content)}</i>"\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Please review according to church fellowship guidelines:`;

  const inlineKeyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve & Publish | አጽድቅ', `approve_${confession.id}`),
      Markup.button.callback('❌ Reject | ውድቅ አድርግ', `reject_${confession.id}`),
    ],
  ]);

  for (const adminId of ADMIN_IDS) {
    try {
      const sent = await bot.telegram.sendMessage(adminId, adminMsg, {
        parse_mode: 'HTML',
        ...inlineKeyboard,
      });
      dbService.trackAdminMessage(confession.id, adminId, sent.message_id, String(sent.chat.id));
      // Pacing to avoid Telegram 429 rate limit
      await new Promise((r) => setTimeout(r, 150));
    } catch (e: any) {
      // Admin might not have opened chat with the bot yet
      console.warn(`Could not send notification to admin ${adminId}: ${e.message}`);
    }
  }
}

// Admin callback: Approve
bot.action(/^approve_(\d+)$/, async (ctx) => {
  const confessionId = Number(ctx.match[1]);
  const adminId = String(ctx.from.id);

  if (!isAdmin(adminId)) {
    return ctx.answerCbQuery('⛔ Unauthorized. You are not an authorized admin.').catch(() => {});
  }

  const existing = dbService.getConfessionById(confessionId);
  if (!existing) {
    return ctx.answerCbQuery('❌ Confession not found.').catch(() => {});
  }

  if (existing.status !== 'PENDING') {
    return ctx.answerCbQuery(`⚠️ Already moderated: ${existing.status} by ${existing.moderated_by}`).catch(() => {});
  }

  const adminName = ctx.from.first_name || `Admin_${adminId}`;

  try {
    // 1. Post to Telegram Channel
    const channelPostText = formatChannelPost(existing);
    let channelMsgId: number | undefined;

    try {
      const channelMsg = await bot.telegram.sendMessage(CHANNEL_ID, channelPostText, {
        parse_mode: 'HTML',
      });
      channelMsgId = channelMsg.message_id;
    } catch (channelErr: any) {
      console.error('Error posting to channel:', channelErr.message);
      dbService.logActivity('CHANNEL_POST_ERROR', `Failed to post ${existing.formatted_id} to ${CHANNEL_ID}: ${channelErr.message}`);
    }

    // 2. Mark Approved in DB
    const res = dbService.approveConfession(confessionId, adminId, adminName, channelMsgId);
    if (!res.success) {
      return ctx.answerCbQuery(`❌ Error: ${res.error}`).catch(() => {});
    }

    await ctx.answerCbQuery('✅ Confession approved and published!').catch(() => {});

    // 3. Update notification for ALL admins to prevent double actions
    const trackers = dbService.getAdminTrackers(confessionId);
    const updatedText = `✅ <b>CONFESSION APPROVED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <b>ID:</b> <code>${escapeHtml(existing.formatted_id)}</code>\n` +
      `📁 <b>Category:</b> ${escapeHtml(existing.category)}\n` +
      `👤 <b>Moderated by:</b> ${escapeHtml(adminName)} (ID: ${escapeHtml(adminId)})\n` +
      `⏰ <b>Time:</b> ${escapeHtml(new Date().toUTCString())}\n` +
      `📢 <b>Status:</b> Published to ${escapeHtml(CHANNEL_ID)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `"<i>${escapeHtml(existing.content)}</i>"`;

    for (const tracker of trackers) {
      try {
        await bot.telegram.editMessageText(tracker.chat_id, tracker.message_id, undefined, updatedText, {
          parse_mode: 'HTML',
        });
      } catch (editErr) {}
    }
  } catch (err: any) {
    console.error('Error approving confession:', err);
    await ctx.answerCbQuery(`Error: ${err.message}`).catch(() => {});
  }
});

// Admin callback: Reject
bot.action(/^reject_(\d+)$/, async (ctx) => {
  const confessionId = Number(ctx.match[1]);
  const adminId = String(ctx.from.id);

  if (!isAdmin(adminId)) {
    return ctx.answerCbQuery('⛔ Unauthorized. You are not an authorized admin.').catch(() => {});
  }

  const existing = dbService.getConfessionById(confessionId);
  if (!existing) {
    return ctx.answerCbQuery('❌ Confession not found.').catch(() => {});
  }

  if (existing.status !== 'PENDING') {
    return ctx.answerCbQuery(`⚠️ Already moderated: ${existing.status} by ${existing.moderated_by}`).catch(() => {});
  }

  const adminName = ctx.from.first_name || `Admin_${adminId}`;

  try {
    const res = dbService.rejectConfession(confessionId, adminId, adminName, 'Violates church fellowship guidelines');
    if (!res.success) {
      return ctx.answerCbQuery(`❌ Error: ${res.error}`).catch(() => {});
    }

    await ctx.answerCbQuery('❌ Confession rejected.').catch(() => {});

    // Update message for all admins
    const trackers = dbService.getAdminTrackers(confessionId);
    const updatedText = `❌ <b>CONFESSION REJECTED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <b>ID:</b> <code>${escapeHtml(existing.formatted_id)}</code>\n` +
      `📁 <b>Category:</b> ${escapeHtml(existing.category)}\n` +
      `👤 <b>Rejected by:</b> ${escapeHtml(adminName)} (ID: ${escapeHtml(adminId)})\n` +
      `⏰ <b>Time:</b> ${escapeHtml(new Date().toUTCString())}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `"<i>${escapeHtml(existing.content)}</i>"`;

    for (const tracker of trackers) {
      try {
        await bot.telegram.editMessageText(tracker.chat_id, tracker.message_id, undefined, updatedText, {
          parse_mode: 'HTML',
        });
      } catch (editErr) {}
    }
  } catch (err: any) {
    console.error('Error rejecting confession:', err);
    await ctx.answerCbQuery(`Error: ${err.message}`).catch(() => {});
  }
});

// /admin and /dashboard commands
bot.command(['admin', 'dashboard'], async (ctx) => {
  const userId = String(ctx.from.id);
  if (!isAdmin(userId)) {
    await safeReply(ctx, '⛔ <b>Access Denied.</b>\nYou are not authorized as an administrator of Focus Harar Confession.');
    return;
  }

  const stats = dbService.getStats();
  const text = `🛡️ <b>FOCUS HARAR ADMIN DASHBOARD</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 <b>Moderation Statistics:</b>\n` +
    `• 📥 <b>Total Submissions:</b> ${stats.total}\n` +
    `• ⏳ <b>Pending Queue:</b> ${stats.pending}\n` +
    `• ✅ <b>Approved & Published:</b> ${stats.approved}\n` +
    `• ❌ <b>Rejected:</b> ${stats.rejected}\n` +
    `• 📅 <b>Today's Submissions:</b> ${stats.todayCount}\n\n` +
    `👥 <b>Configured Admins:</b> ${ADMIN_IDS.length}\n` +
    `📢 <b>Channel:</b> ${escapeHtml(CHANNEL_ID)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await safeReply(
    ctx,
    text,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('⏳ Review Pending (Next)', 'admin_review_next'),
        Markup.button.callback('🔄 Refresh Stats', 'admin_refresh_stats'),
      ],
      [
        Markup.button.url('📢 View Channel', `https://t.me/${CHANNEL_ID.replace('@', '')}`),
      ],
    ])
  );
});

// /pending command
bot.command('pending', async (ctx) => {
  const userId = String(ctx.from.id);
  if (!isAdmin(userId)) {
    await safeReply(ctx, '⛔ Access Denied.');
    return;
  }

  const pending = dbService.getPendingConfessions(1);
  if (pending.length === 0) {
    await safeReply(ctx, '🎉 <b>All caught up!</b> There are no pending confessions waiting for review.');
    return;
  }

  const c = pending[0];
  const msg = `⏳ <b>PENDING CONFESSION REVIEW (1 of ${dbService.getStats().pending})</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 <b>ID:</b> <code>${escapeHtml(c.formatted_id)}</code>\n` +
    `📁 <b>Category:</b> ${escapeHtml(c.category)}\n` +
    `🌐 <b>Language:</b> ${escapeHtml(c.language.toUpperCase())}\n` +
    `⏰ <b>Received:</b> ${escapeHtml(new Date(c.created_at).toUTCString())}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `"<i>${escapeHtml(c.content)}</i>"`;

  await safeReply(
    ctx,
    msg,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Approve & Publish', `approve_${c.id}`),
        Markup.button.callback('❌ Reject', `reject_${c.id}`),
      ],
      [Markup.button.callback('➡️ Next', 'admin_review_next')],
    ])
  );
});

// Admin review next callback
bot.action('admin_review_next', async (ctx) => {
  const userId = String(ctx.from.id);
  if (!isAdmin(userId)) {
    return ctx.answerCbQuery('⛔ Unauthorized').catch(() => {});
  }

  const pending = dbService.getPendingConfessions(1);
  if (pending.length === 0) {
    await ctx.answerCbQuery('No pending confessions!').catch(() => {});
    await safeReply(ctx, '🎉 All caught up! There are no pending confessions.');
    return;
  }

  const c = pending[0];
  await ctx.answerCbQuery().catch(() => {});
  const msg = `⏳ <b>PENDING REVIEW</b>\n` +
    `🆔 <code>${escapeHtml(c.formatted_id)}</code> | 📁 ${escapeHtml(c.category)} | 🌐 ${escapeHtml(c.language.toUpperCase())}\n\n` +
    `"<i>${escapeHtml(c.content)}</i>"`;

  await safeReply(
    ctx,
    msg,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Approve & Publish', `approve_${c.id}`),
        Markup.button.callback('❌ Reject', `reject_${c.id}`),
      ],
      [Markup.button.callback('➡️ Skip / Next', 'admin_review_next')],
    ])
  );
});

// Admin refresh stats callback
bot.action('admin_refresh_stats', async (ctx) => {
  const userId = String(ctx.from.id);
  if (!isAdmin(userId)) {
    return ctx.answerCbQuery('⛔ Unauthorized').catch(() => {});
  }

  const stats = dbService.getStats();
  const text = `🛡️ <b>FOCUS HARAR ADMIN DASHBOARD</b> (Refreshed)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 <b>Moderation Statistics:</b>\n` +
    `• 📥 <b>Total Submissions:</b> ${stats.total}\n` +
    `• ⏳ <b>Pending Queue:</b> ${stats.pending}\n` +
    `• ✅ <b>Approved & Published:</b> ${stats.approved}\n` +
    `• ❌ <b>Rejected:</b> ${stats.rejected}\n` +
    `• 📅 <b>Today's Submissions:</b> ${stats.todayCount}\n\n` +
    `👥 <b>Configured Admins:</b> ${ADMIN_IDS.length}\n` +
    `📢 <b>Channel:</b> ${escapeHtml(CHANNEL_ID)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.answerCbQuery('Updated!').catch(() => {});
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('⏳ Review Pending', 'admin_review_next'),
          Markup.button.callback('🔄 Refresh Stats', 'admin_refresh_stats'),
        ],
        [
          Markup.button.url('📢 View Channel', `https://t.me/${CHANNEL_ID.replace('@', '')}`),
        ],
      ]),
    });
  } catch (e) {}
});

// ----------------------------------------------------
// Bot Lifecycle & Keep-Alive Manager
// ----------------------------------------------------

let launchRetryTimer: NodeJS.Timeout | null = null;
let isLaunching = false;

export async function launchBot() {
  if (isLaunching) return;
  if (!BOT_TOKEN || BOT_TOKEN.includes('MY_BOT_TOKEN')) {
    botState.status = 'error';
    botState.error = 'No Telegram Bot Token provided.';
    console.warn('Telegram Bot Token not configured.');
    return;
  }

  isLaunching = true;
  if (launchRetryTimer) {
    clearTimeout(launchRetryTimer);
    launchRetryTimer = null;
  }

  try {
    botState.status = 'starting';
    botState.error = null;
    const me = await bot.telegram.getMe();
    botState.botUsername = me.username || 'focusconfessionbot';
    console.log(`Telegram Bot verified: @${botState.botUsername} (${me.first_name})`);

    // Register native bot menu commands with Telegram
    try {
      await bot.telegram.setMyCommands([
        { command: 'start', description: '🕊️ Start bot & choose language | ጀምር' },
        { command: 'submit', description: '✍️ Submit anonymous confession / prayer | ላክ' },
        { command: 'language', description: '🌐 Change language | ቋንቋ ቀይር' },
        { command: 'rules', description: '🛡️ Privacy policy & guidelines | መመሪያ' },
        { command: 'channel', description: '📢 Visit @focushararconfession' },
        { command: 'cancel', description: '❌ Cancel current action | ሰርዝ' },
        { command: 'admin', description: '🛡️ Church admin moderation dashboard' },
        { command: 'pending', description: '⏳ Review pending confessions (Admins)' },
      ]);
      console.log('Telegram bot commands registered successfully.');
    } catch (cmdErr: any) {
      console.warn('Could not register bot commands:', cmdErr.message);
    }

    // Load saved offset if available
    const savedOffsetStr = dbService.getSetting('telegram_update_offset');
    if (savedOffsetStr) {
      currentOffset = parseInt(savedOffsetStr, 10);
      console.log(`Loaded saved Telegram update offset from DB: ${currentOffset}`);
    } else {
      // Synchronize initial offset to the latest update on Telegram so historical backlog is not replayed
      try {
        const latest = await fetchUpdatesWithTimeout(-1, 0, 1);
        if (latest && latest.length > 0) {
          currentOffset = latest[0].update_id;
          dbService.setSetting('telegram_update_offset', String(currentOffset));
          console.log(`Synchronized initial Telegram update offset to latest: ${currentOffset}`);
        } else {
          currentOffset = 0;
        }
      } catch (probeErr: any) {
        console.warn('Could not probe latest update:', probeErr.message);
        currentOffset = 0;
      }
    }

    // Ensure any existing webhook is cleared so polling has 100% direct access
    try {
      const webhookInfo = await bot.telegram.getWebhookInfo();
      if (webhookInfo.url) {
        console.log(`Clearing existing webhook (${webhookInfo.url}) to guarantee active polling...`);
        await bot.telegram.deleteWebhook({ drop_pending_updates: false });
      }
    } catch (e: any) {
      console.warn('Could not check/delete webhook:', e.message);
    }

    // Start robust timeout-protected polling loop and active watchdog
    startPolling();
    startWatchdog();
  } catch (err: any) {
    botState.status = 'error';
    botState.error = err.message;
    console.error('Failed to initialize Telegram Bot, retrying in 5s:', err);
    dbService.logActivity('BOT_ERROR', `Bot launch error (retrying in 5s): ${err.message}`);
    launchRetryTimer = setTimeout(() => {
      launchRetryTimer = null;
      launchBot().catch(() => {});
    }, 5000);
  } finally {
    isLaunching = false;
  }
}

let isPollingActive = false;
let pollingGeneration = 0;
let currentOffset = 0;
let lastIterationTime = Date.now();
const processedUpdateIds = new Set<number>();

async function fetchUpdatesWithTimeout(offset: number, timeoutSec = 3, limit = 30): Promise<any[]> {
  const url = new URL(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('timeout', String(timeoutSec));
  url.searchParams.set('allowed_updates', JSON.stringify(['message', 'callback_query', 'edited_message']));

  const res = await fetch(url.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout((timeoutSec + 5) * 1000),
  });
  const data: any = await res.json();
  if (!res.ok || !data?.ok) {
    const err: any = new Error(data?.description || `Telegram HTTP ${res.status}`);
    err.code = data?.error_code || res.status;
    throw err;
  }
  return Array.isArray(data.result) ? data.result : [];
}

export function startPolling(forceRestart = false) {
  if (isPollingActive && !forceRestart) return;

  const myGeneration = ++pollingGeneration;
  isPollingActive = true;
  lastIterationTime = Date.now();

  botState.mode = 'polling';
  botState.status = 'running';
  botState.error = null;
  botState.startedAt = new Date().toISOString();
  console.log(`🚀 Telegram Bot @${botState.botUsername} polling loop active (gen: ${myGeneration}, offset: ${currentOffset})!`);
  dbService.logActivity('BOT_START', `Bot @${botState.botUsername} polling started (offset: ${currentOffset})`);

  (async () => {
    while (isPollingActive && myGeneration === pollingGeneration) {
      lastIterationTime = Date.now();
      try {
        // Fast 3-second polling with strict 8-second AbortSignal timeout so sockets never hang
        const updates = await fetchUpdatesWithTimeout(currentOffset, 3, 30);
        if (!isPollingActive || myGeneration !== pollingGeneration) break;

        lastIterationTime = Date.now();
        const nowIso = new Date().toISOString();
        botState.lastPollAt = nowIso;
        botState.pollCycles += 1;
        botState.status = 'running';
        botState.error = null;

        if (updates.length > 0) {
          for (const update of updates) {
            // Immediately advance and persist offset so update is never re-processed
            currentOffset = update.update_id + 1;
            dbService.setSetting('telegram_update_offset', String(currentOffset));
            botState.lastActiveAt = new Date().toISOString();

            if (processedUpdateIds.has(update.update_id)) {
              continue; // Deduplicated
            }
            processedUpdateIds.add(update.update_id);
            if (processedUpdateIds.size > 2000) {
              const first = processedUpdateIds.values().next().value;
              if (first !== undefined) processedUpdateIds.delete(first);
            }

            // Preserve updates up to 24 hours old (Telegram's retention limit) so sleep wake-up still answers
            const isTextMessage = Boolean(update.message);
            const msgDate = update.message?.date;
            if (isTextMessage && msgDate && (Date.now() / 1000 - msgDate > 86400)) {
              console.log(`[STALE MESSAGE SKIPPED] Text update ${update.update_id} older than 24h, skipping.`);
              continue;
            }

            try {
              await bot.handleUpdate(update);
            } catch (handleErr: any) {
              console.error(`Error processing update ${update.update_id}:`, handleErr?.message || handleErr);
            }
          }
          dbService.checkpoint('PASSIVE');
        } else if (botState.pollCycles % 20 === 0) {
          dbService.checkpoint('PASSIVE');
        }
      } catch (err: any) {
        if (!isPollingActive || myGeneration !== pollingGeneration) break;
        lastIterationTime = Date.now();
        const msg = err?.message || String(err);
        if (err?.code === 409 || msg.includes('409')) {
          console.warn('Telegram 409 Conflict: waiting 2s for other poller to clear...');
          await new Promise((r) => setTimeout(r, 2000));
        } else if (err?.code === 429 || msg.includes('429')) {
          const match = msg.match(/retry after (\d+)/i);
          const waitSec = match ? parseInt(match[1], 10) : 5;
          console.warn(`Telegram 429 rate limit in polling loop, backing off for ${waitSec}s...`);
          await new Promise((r) => setTimeout(r, (waitSec + 1) * 1000));
        } else {
          botState.error = msg;
          console.warn('Telegram polling error, retrying in 1.5s:', msg);
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
  })().catch((loopErr) => {
    console.error('Fatal polling error, restarting in 2s:', loopErr);
    if (myGeneration === pollingGeneration) {
      isPollingActive = false;
      setTimeout(() => {
        if (!isPollingActive && myGeneration === pollingGeneration) startPolling();
      }, 2000);
    }
  });
}

export async function restartPolling(): Promise<BotState> {
  if (botState.mode === 'webhook') {
    await removeWebhookAndPoll();
    return botState;
  }
  if (botState.status === 'error' || botState.status === 'idle') {
    await launchBot();
    return botState;
  }
  startPolling(true);
  startWatchdog();
  return botState;
}

let watchdogTimer: NodeJS.Timeout | null = null;

export function startWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    if (botState.mode === 'polling') {
      if (!isPollingActive || Date.now() - lastIterationTime > 20000) {
        console.log('[WATCHDOG] Reviving stalled Telegram polling loop...');
        startPolling(true);
      }
    }
  }, 10000);
}

export function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

export function stopPolling() {
  pollingGeneration++;
  isPollingActive = false;
  stopWatchdog();
  botState.status = 'idle';
  dbService.checkpoint('TRUNCATE');
}

// Set Webhook for 24/7 immediate wake-up
export async function setWebhookUrl(url: string): Promise<{ success: boolean; message: string }> {
  try {
    stopPolling();

    const cleanUrl = url.trim().replace(/\/$/, '') + '/api/telegram-webhook';
    await bot.telegram.setWebhook(cleanUrl, {
      drop_pending_updates: false,
      allowed_updates: ['message', 'callback_query'],
    });

    botState.mode = 'webhook';
    botState.webhookUrl = cleanUrl;
    botState.status = 'running';
    botState.error = null;
    dbService.logActivity('WEBHOOK_SET', `Webhook registered at ${cleanUrl}`);

    return { success: true, message: `Webhook registered at ${cleanUrl}` };
  } catch (err: any) {
    console.error('Error setting webhook:', err);
    return { success: false, message: err.message };
  }
}

// Remove Webhook and switch back to Polling
export async function removeWebhookAndPoll(): Promise<{ success: boolean; message: string }> {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    botState.webhookUrl = null;
    startPolling(true);
    startWatchdog();
    dbService.logActivity('WEBHOOK_REMOVED', 'Webhook deleted, switched back to long-polling');
    return { success: true, message: 'Switched back to real-time polling mode' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// Stop gracefully
process.once('SIGINT', () => stopPolling());
process.once('SIGTERM', () => stopPolling());
