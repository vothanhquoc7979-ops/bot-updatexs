/**
 * index.js — Entry point: Express server + Bot + Auto-scheduler
 */
'use strict';

require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const logger     = require('./logger');
const storage    = require('./storage');
const botManager = require('./bot-manager');
const ui         = require('./ui');

const PORT = process.env.PORT || 3000;
const app  = express();

// ── Shared MySQL pool (dùng chung cho forum-SSE và crawl) ──
let mysqlPool = null;

function getMySQLPool() {
  if (!mysqlPool && process.env.MYSQL_HOST) {
    mysqlPool = require('mysql2/promise').createPool({
      host:     process.env.MYSQL_HOST,
      port:     parseInt(process.env.MYSQL_PORT || '3306'),
      user:     process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
    logger.log('✅ MySQL pool đã khởi tạo');
  }
  return mysqlPool;
}

// ── Session middleware (cho bot dashboard) ───────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'xoso-bot-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
}));

// ── Body parser ───────────────────────────────────────────
app.use(express.json());

// ── Mount Web Dashboard (UI + auth routes) ─────────────
app.use(ui);

// ── Health check ─────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── API: Crawl Vietlott ─────────────────────────────────
app.post('/api/crawler/vietlott', ui.requireAuth, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(500).json({ ok: false, msg: 'Chưa cấu hình MySQL (MYSQL_HOST env)' });
  }

  const { games = [], from, to, force = false } = req.body;

  if (!games.length || !from || !to) {
    return res.status(400).json({ ok: false, msg: 'Thiếu games / from / to' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ ok: false, msg: 'Ngày không hợp lệ (định dạng YYYY-MM-DD)' });
  }

  const { crawl } = require('./crawler-vietlott');

  const startTime = Date.now();
  const collectedLogs = [];

  try {
    const result = await crawl({
      games,
      from,
      to,
      db: pool,
      force,
      onLog: (msg) => {
        collectedLogs.push({ ts: new Date().toISOString(), msg });
        logger.log(msg);
      },
    });

    res.json({
      ok: true,
      saved: result.saved,
      errors: result.errors,
      elapsed: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      logs: collectedLogs,
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message, logs: collectedLogs });
  }
});

// ── API: Crawl 3 Miền (XSMB, XSMN, XSMT) ─────────────────
app.post('/api/crawler/mien', ui.requireAuth, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(500).json({ ok: false, msg: 'Chưa cấu hình MySQL (MYSQL_HOST env)' });
  }

  const { regions = [], from, to } = req.body;

  if (!regions.length || !from || !to) {
    return res.status(400).json({ ok: false, msg: 'Thiếu regions / from / to' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ ok: false, msg: 'Ngày không hợp lệ (định dạng YYYY-MM-DD)' });
  }

  const { crawl } = require('./crawler-3mien');

  const startTime = Date.now();
  const collectedLogs = [];

  try {
    const result = await crawl({
      regions,
      from,
      to,
      db: pool,
      onLog: (msg) => {
        collectedLogs.push({ ts: new Date().toISOString(), msg });
        logger.log(msg);
      },
    });

    res.json({
      ok: true,
      saved: result.saved,
      errors: result.errors,
      elapsed: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      logs: collectedLogs,
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message, logs: collectedLogs });
  }
});

// ── POST /api/mysql-check ────────────────────────────────
app.post('/api/mysql-check', ui.requireAuth, express.json(), async (req, res) => {
  const { mysql_host, mysql_port, mysql_user, mysql_password, mysql_database } = req.body;

  if (!mysql_host || !mysql_user || !mysql_database) {
    return res.json({ ok: false, msg: 'Thiếu thông tin kết nối' });
  }

  try {
    const mysql2 = require('mysql2/promise');
    const testPool = mysql2.createPool({
      host:     mysql_host,
      port:     parseInt(mysql_port || '3306'),
      user:     mysql_user,
      password: mysql_password || '',
      database: mysql_database,
      connectTimeout: 8000,
    });
    await testPool.query('SELECT 1');
    await testPool.end();
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ── POST /api/save-mysql ─────────────────────────────────
app.post('/api/save-mysql', ui.requireAuth, express.json(), async (req, res) => {
  const { mysql_host, mysql_port, mysql_user, mysql_password, mysql_database } = req.body;

  // Validate basic fields
  if (!mysql_host || !mysql_user || !mysql_database) {
    return res.status(400).json({ ok: false, msg: 'Thiếu host / user / database' });
  }

  // Test connection first
  try {
    const mysql2 = require('mysql2/promise');
    const testPool = mysql2.createPool({
      host:     mysql_host,
      port:     parseInt(mysql_port || '3306'),
      user:     mysql_user,
      password: mysql_password || '',
      database: mysql_database,
      connectTimeout: 8000,
    });
    await testPool.query('SELECT 1');
    await testPool.end();
  } catch (e) {
    return res.json({ ok: false, msg: 'Kết nối thất bại: ' + e.message });
  }

  // Lưu vào storage (config.json)
  const cfg = storage.load();
  cfg.mysql_host     = mysql_host;
  cfg.mysql_port     = mysql_port;
  cfg.mysql_user     = mysql_user;
  cfg.mysql_password = mysql_password;
  cfg.mysql_database = mysql_database;
  storage.save(cfg);

  // Cập nhật env cho process hiện tại
  process.env.MYSQL_HOST     = mysql_host;
  process.env.MYSQL_PORT     = mysql_port || '3306';
  process.env.MYSQL_USER     = mysql_user;
  process.env.MYSQL_PASSWORD = mysql_password || '';
  process.env.MYSQL_DATABASE = mysql_database;

  // Reset pool để dùng config mới
  mysqlPool = null;
  getMySQLPool();

  res.json({ ok: true });
});
async function main() {
  logger.log('🚀 Khởi động KQXS Live Bot...');
  logger.log(`🌐 Dashboard: http://localhost:${PORT}`);

  // Khởi động Telegram bot (nếu đã có token)
  await botManager.start();

  // HTTP server (Railway cần để keepalive + Web UI)
  const server = app.listen(PORT, () => {
    logger.log(`✅ HTTP server đang chạy trên port ${PORT}`);
    logger.log(`📡 Forum SSE: http://localhost:${PORT}/forum-sse`);
  });

  // ── Endpoint: Client đăng ký nhận tin real-time (SSE) ───
  app.get('/forum-sse', async (req, res) => {
    const token = req.query.token || '';
    if (!token) return res.status(401).end('Missing token');

    try {
      const pool = getMySQLPool();
      if (!pool) return res.status(500).end('Server error');
      const [rows] = await pool.execute(
        'SELECT 1 FROM forum_sessions WHERE session_token = ? AND expires_at > NOW() LIMIT 1',
        [token]
      );
      if (rows.length === 0) return res.status(401).end('Invalid token');
    } catch (_) {
      return res.status(500).end('Server error');
    }

    const forumSSE = require('./forum-sse');
    const clientId = forumSSE.addClient(res);
    req.on('close', () => forumSSE.removeClient(clientId));
    req.on('end',   () => forumSSE.removeClient(clientId));
  });

  // ── Endpoint: PHP gọi khi có tin nhắn forum mới ──────────
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

    const forumSSE = require('./forum-sse');
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

// ── Graceful shutdown ───────────────────────────────────
process.once('SIGINT',  () => { logger.log('SIGINT — tắt bot'); process.exit(0); });
process.once('SIGTERM', () => { logger.log('SIGTERM — tắt bot'); process.exit(0); });

// Export getMySQLPool để ui.js có thể dùng
module.exports = { getMySQLPool };
module.exports.default = app;
