import { Router } from 'express';
import { dbService } from './db.js';
import { bot, botState, ADMIN_IDS, CHANNEL_ID, notifyAdminsOfNewConfession, setWebhookUrl, removeWebhookAndPoll, restartPolling } from './bot.js';
import { CATEGORIES, TRANSLATIONS, formatChannelPost } from './i18n.js';

const router = Router();

// Bot & System Status
router.get('/status', (req, res) => {
  const stats = dbService.getStats();
  res.json({
    bot: botState,
    channel: CHANNEL_ID,
    adminsCount: ADMIN_IDS.length,
    adminsList: ADMIN_IDS,
    stats,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Categories with translations
router.get('/categories', (req, res) => {
  res.json(CATEGORIES);
});

// Admin roster
router.get('/admins', (req, res) => {
  res.json({
    adminIds: ADMIN_IDS,
    total: ADMIN_IDS.length,
    channel: CHANNEL_ID,
  });
});

// Confessions list
router.get('/confessions', (req, res) => {
  const { status, category, language, search, limit, offset } = req.query;

  const results = dbService.getConfessions({
    status: status as string,
    category: category as string,
    language: language as string,
    search: search as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });

  res.json(results);
});

// Get single confession
router.get('/confessions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const confession = dbService.getConfessionById(id);
  if (!confession) {
    return res.status(404).json({ error: 'Confession not found' });
  }
  res.json(confession);
});

// Web approval action
router.post('/confessions/:id/approve', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { adminId = 'WEB_DASHBOARD', adminName = 'Web Administrator' } = req.body;

  const existing = dbService.getConfessionById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Confession not found' });
  }

  if (existing.status !== 'PENDING') {
    return res.status(400).json({ error: `Confession is already ${existing.status}` });
  }

  // Publish to Telegram channel
  let channelMsgId: number | undefined;
  let channelError: string | null = null;

  try {
    const postText = formatChannelPost(existing);
    const sentMsg = await bot.telegram.sendMessage(CHANNEL_ID, postText, {
      parse_mode: 'HTML',
    });
    channelMsgId = sentMsg.message_id;
  } catch (err: any) {
    console.error('Channel post error:', err.message);
    channelError = err.message;
  }

  const approveRes = dbService.approveConfession(id, adminId, adminName, channelMsgId);

  // Update messages sent to Telegram admins
  const trackers = dbService.getAdminTrackers(id);
  const updatedText = `✅ <b>CONFESSION APPROVED</b> (via Admin Hub)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 <b>ID:</b> <code>${existing.formatted_id}</code>\n` +
    `📁 <b>Category:</b> ${existing.category}\n` +
    `👤 <b>Moderated by:</b> ${adminName}\n` +
    `📢 <b>Channel:</b> Published to ${CHANNEL_ID}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `"<i>${existing.content}</i>"`;

  for (const tracker of trackers) {
    try {
      await bot.telegram.editMessageText(tracker.chat_id, tracker.message_id, undefined, updatedText, {
        parse_mode: 'HTML',
      });
    } catch (e) {
      // Ignored
    }
  }

  res.json({
    success: true,
    confession: approveRes.confession,
    channelPostId: channelMsgId,
    channelError,
  });
});

// Web rejection action
router.post('/confessions/:id/reject', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { adminId = 'WEB_DASHBOARD', adminName = 'Web Administrator', reason = 'Does not meet church fellowship guidelines' } = req.body;

  const existing = dbService.getConfessionById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Confession not found' });
  }

  if (existing.status !== 'PENDING') {
    return res.status(400).json({ error: `Confession is already ${existing.status}` });
  }

  const rejectRes = dbService.rejectConfession(id, adminId, adminName, reason);

  // Update messages sent to Telegram admins
  const trackers = dbService.getAdminTrackers(id);
  const updatedText = `❌ <b>CONFESSION REJECTED</b> (via Admin Hub)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 <b>ID:</b> <code>${existing.formatted_id}</code>\n` +
    `📁 <b>Category:</b> ${existing.category}\n` +
    `👤 <b>Rejected by:</b> ${adminName}\n` +
    `📝 <b>Reason:</b> ${reason}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `"<i>${existing.content}</i>"`;

  for (const tracker of trackers) {
    try {
      await bot.telegram.editMessageText(tracker.chat_id, tracker.message_id, undefined, updatedText, {
        parse_mode: 'HTML',
      });
    } catch (e) {
      // Ignored
    }
  }

  res.json({
    success: true,
    confession: rejectRes.confession,
  });
});

// Direct test ping to a Telegram User ID (e.g. admin or tester)
router.post('/telegram/test-ping', async (req, res) => {
  const { userId = '674224568', message = '🔔 Focus Harar Bot Test: System is online, active, and responsive right now!' } = req.body;

  try {
    const sent = await bot.telegram.sendMessage(userId, `🕊️ <b>Focus Harar Confession Bot</b>\n\n${message}\n\n⏰ <b>Timestamp:</b> ${new Date().toLocaleTimeString()}\n\n👇 Tap below to submit a confession, prayer request, or testimony:`, {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '✍️ Submit Confession' }],
          [{ text: '🛡️ Privacy & Guidelines' }, { text: '🌐 Change Language' }],
          [{ text: '📢 Join Our Channel' }]
        ],
        resize_keyboard: true
      }
    });
    dbService.logActivity('TEST_PING_SENT', `Direct ping sent to Telegram user ${userId}`);
    res.json({
      success: true,
      messageId: sent.message_id,
      userId,
      recipient: (sent.chat as any).first_name || (sent.chat as any).username || userId,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      hint: 'The user must have opened the bot chat and pressed Start at least once for Telegram to allow direct messages.',
    });
  }
});

// Reset all user sessions to clean idle state
router.post('/telegram/reset-user-sessions', (req, res) => {
  try {
    const count = dbService.clearUserSession('ALL');
    dbService.logActivity('SESSIONS_RESET', 'All user sessions reset to clean idle state');
    res.json({ success: true, message: 'All user sessions have been refreshed and reset to idle.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simulator: Submit confession from web
router.post('/confessions/submit-simulated', async (req, res) => {
  const { category, language, content } = req.body;

  if (!category || !content || content.trim().length < 5) {
    return res.status(400).json({ error: 'Category and content (at least 5 characters) are required.' });
  }

  const lang = (['en', 'am', 'om'].includes(language) ? language : 'en') as 'en' | 'am' | 'om';
  const confession = dbService.createConfession(category, lang, content.trim());

  // Notify admins on Telegram
  await notifyAdminsOfNewConfession(confession);

  res.json({
    success: true,
    confession,
    message: 'Confession created and dispatched to administrators for review.',
  });
});

// Channel test ping
router.post('/channel/test', async (req, res) => {
  try {
    const testMsg = `🕊️ **Focus Harar Confession - System Verification Ping**\n` +
      `📅 **Timestamp:** ${new Date().toUTCString()}\n` +
      `🤖 **Bot:** @focusconfessionbot\n` +
      `✅ Bot has administrator posting privileges in this channel!`;

    const sent = await bot.telegram.sendMessage(CHANNEL_ID, testMsg, {
      parse_mode: 'Markdown',
    });

    res.json({
      success: true,
      messageId: sent.message_id,
      channel: CHANNEL_ID,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      hint: 'Make sure @focusconfessionbot is added to the channel as an Administrator with "Post Messages" permission enabled.',
    });
  }
});

// Activity logs
router.get('/logs', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 40;
  res.json(dbService.getRecentLogs(limit));
});

// Data export
router.get('/export', (req, res) => {
  const format = req.query.format || 'json';
  const data = dbService.getConfessions({ limit: 10000 });

  if (format === 'csv') {
    const headers = ['ID', 'Category', 'Language', 'Status', 'Moderated By', 'Moderated At', 'Date', 'Content'];
    const rows = data.items.map((item) => [
      `"${item.formatted_id}"`,
      `"${item.category}"`,
      `"${item.language}"`,
      `"${item.status}"`,
      `"${item.moderator_name || item.moderated_by || ''}"`,
      `"${item.moderated_at || ''}"`,
      `"${item.created_at}"`,
      `"${item.content.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="focus-harar-confessions.csv"');
    return res.send(csvContent);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="focus-harar-confessions.json"');
  res.json(data);
});

// Bot Webhook Management Endpoints
router.post('/bot/set-webhook', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Webhook URL is required' });
  }
  const result = await setWebhookUrl(url);
  res.json(result);
});

router.post('/bot/set-polling', async (req, res) => {
  const result = await removeWebhookAndPoll();
  res.json(result);
});

router.post('/bot/restart', async (req, res) => {
  try {
    const state = await restartPolling();
    res.json({ success: true, bot: state, message: 'Telegram bot polling refreshed and active!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/bot/webhook-info', async (req, res) => {
  try {
    const info = await bot.telegram.getWebhookInfo();
    res.json({ success: true, info, botState });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
