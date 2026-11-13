import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './server/routes.js';
import { bot, launchBot, botState, setWebhookUrl } from './server/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Telegram Webhook Handler (allows instant wakeup on incoming messages from Telegram)
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error('Error handling webhook update:', err);
    if (!res.headersSent) res.sendStatus(200);
  }
});

// API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    botStatus: botState.status,
    botMode: botState.mode,
    lastPollAt: botState.lastPollAt,
    pollCycles: botState.pollCycles,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Focus Harar Confession Server running at http://0.0.0.0:${PORT}`);
  });

  // Launch Telegram Bot
  launchBot().catch((err) => {
    console.error('Error launching bot:', err);
  });

  // Keep-alive heartbeat (every 25 seconds) to ensure process remains active and warm
  setInterval(() => {
    fetch(`http://127.0.0.1:${PORT}/health`).catch(() => {});
  }, 25000);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
