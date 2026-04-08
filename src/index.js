/**
 * index.js — Entry point: Express server + Bot + Auto-scheduler
 */
'use strict';

require('dotenv').config();

const express    = require('express');
const logger     = require('./logger');
const storage    = require('./storage');
const botManager = require('./bot-manager');
const ui         = require('./ui');
const forumWS    = require('./forum-ws');

const PORT = process.env.PORT || 3000;
const app  = express();

// ── Mount Web Dashboard ──────────────────────────────────
app.use(ui);

// ── Health check ─────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Khởi động ────────────────────────────────────────────
async function main() {
  logger.log('🚀 Khởi động KQXS Live Bot...');
  logger.log(`🌐 Dashboard: http://localhost:${PORT}`);

  // Khởi động Telegram bot (nếu đã có token)
  await botManager.start();

  // HTTP server (Railway cần để keepalive + Web UI)
  const server = app.listen(PORT, () => {
    logger.log(`✅ HTTP server đang chạy trên port ${PORT}`);

    // Khởi động WebSocket cho forum chat real-time
    forumWS.init(server);
    logger.log(`🔌 Forum WebSocket: ws://localhost:${PORT}/forum-ws`);
  });

  // ── Endpoint: PHP gọi khi có tin nhắn forum mới ──────────
  app.use(express.json());
  app.post('/forum/push', (req, res) => {
    const secret = req.headers['x-bot-secret'];
    const valid  = (process.env.PHP_PUSH_SECRET || '').trim()
                 || (storage.get('php_push_secret') || '').trim();

    if (!valid || secret !== valid) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { type, message } = req.body;
    if (!type || !message) {
      return res.status(400).json({ ok: false, error: 'Missing type or message' });
    }

    forumWS.broadcast({ type, message, ts: Date.now() });
    res.json({ ok: true, clients: forumWS.getClientCount() });
  });

  // Bật chế độ tự động check giờ xổ (nếu config auto_schedule đang bật)
  const scheduler = require('./scheduler');
  scheduler.startAutoSchedule(logger.log);
}

main().catch(err => {
  logger.log(`❌ Lỗi khởi động: ${err.message}`);
  process.exit(1);
});

// ── Graceful shutdown ────────────────────────────────────
process.once('SIGINT',  () => { logger.log('SIGINT — tắt bot'); process.exit(0); });
process.once('SIGTERM', () => { logger.log('SIGTERM — tắt bot'); process.exit(0); });
