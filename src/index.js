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
const forumSSE   = require('./forum-sse');

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

    // Khởi động SSE endpoint cho forum real-time
    logger.log(`📡 Forum SSE: http://localhost:${PORT}/forum-sse`);
  });

  // ── Endpoint: Client đăng ký nhận tin real-time (SSE) ───
  app.get('/forum-sse', async (req, res) => {
    const token = req.query.token || '';
    if (!token) return res.status(401).end('Missing token');

    // Validate token against MySQL
    try {
      const db = await import('mysql2/promise').then(m => m.createPool({
        host:     process.env.MYSQL_HOST,
        user:     process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
      }).getConnection());

      const [rows] = await db.execute(
        'SELECT 1 FROM forum_sessions WHERE session_token = ? AND expires_at > NOW() LIMIT 1',
        [token]
      );
      await db.end();
      if (rows.length === 0) return res.status(401).end('Invalid token');
    } catch (_) {
      return res.status(500).end('Server error');
    }

    const clientId = forumSSE.addClient(res);
    req.on('close', () => forumSSE.removeClient(clientId));
    req.on('end',   () => forumSSE.removeClient(clientId));
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

    forumSSE.push('forum_message', { type, message, ts: Date.now() });
    res.json({ ok: true, clients: forumSSE.getClientCount() });
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
