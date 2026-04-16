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

// ── Đã bỏ Shared MySQL pool (Dùng 100% qua PHP API Proxy) ──

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

// ── Helper: resolve PHP proxy URL + Secret ────────────────
// Ưu tiên legacy fields (php_server_url / php_push_secret);
// fallback về sites[0] nếu legacy trống (cấu hình qua Dashboard mới)
function resolveCrawlProxy() {
  const cfg = storage.load();
  if (cfg.php_server_url && (cfg.php_push_secret || '').trim()) {
    return { url: cfg.php_server_url, secret: (cfg.php_push_secret || '').trim() };
  }
  const sites = storage.getSites();
  if (sites.length > 0) {
    return {
      url   : sites[0].domain.replace(/\/+$/, '') + '/api/crawl-save.php',
      secret: sites[0].secret,
    };
  }
  return { url: '', secret: '' };
}

// ── API: Crawl Vietlott ─────────────────────────────────
app.post('/api/crawler/vietlott', ui.requireAuth, async (req, res) => {
  const { url: phpProxyUrl, secret: phpSecret } = resolveCrawlProxy();
  const useProxy = !!(phpProxyUrl && phpSecret);

  if (!useProxy) {
    return res.status(500).json({ ok: false, msg: 'Chưa cấu hình PHP Server URL và Secret! Vào Dashboard → thêm site hoặc điền PHP Server URL.' });
  }

  logger.log(`[Crawl Vietlott] mode=PHP_PROXY url=${phpProxyUrl || 'N/A'}`);

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
      phpProxyUrl: phpProxyUrl,
      phpPushSecret: useProxy ? phpSecret  : undefined,
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

// ── API: Kiểm tra dữ liệu thiếu trong DB ──────────────────
app.get('/api/check-missing', ui.requireAuth, async (req, res) => {
  const { url: phpProxyUrl, secret: phpSecret } = resolveCrawlProxy();

  if (!phpProxyUrl || !phpSecret) {
    return res.status(500).json({ ok: false, msg: 'Chưa cấu hình PHP Server URL và Secret! Vào Dashboard → thêm site hoặc điền PHP Server URL.' });
  }

  const { type = 'vietlott', games = '', regions = '', from, to } = req.query;
  if (!from || !to) return res.status(400).json({ ok: false, msg: 'Thiếu from / to' });

  // Thay crawl-save.php → check-missing.php
  const checkUrl = phpProxyUrl.replace(/crawl-save\.php.*$/, 'check-missing.php');

  const payload = { type, from, to };
  if (games)   payload.games   = games.split(',').filter(Boolean);
  if (regions) payload.regions = regions.split(',').filter(Boolean);

  try {
    const r = await fetch(checkUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': phpSecret },
      body:    JSON.stringify(payload),
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── API: Kiểm tra số thiếu trong record đã có trong DB ───────────────
app.get('/api/check-incomplete', ui.requireAuth, async (req, res) => {
  const { url: phpProxyUrl, secret: phpSecret } = resolveCrawlProxy();
  if (!phpProxyUrl || !phpSecret)
    return res.status(500).json({ ok: false, msg: 'Chưa cấu hình PHP Server URL và Secret! Vào Dashboard → thêm site hoặc điền PHP Server URL.' });

  const { games = '', from, to } = req.query;
  if (!from || !to) return res.status(400).json({ ok: false, msg: 'Thiếu from / to' });

  const checkUrl = phpProxyUrl.replace(/crawl-save\.php.*$/, 'check-missing.php');
  const payload  = { type: 'incomplete', from, to, games: games.split(',').filter(Boolean) };

  try {
    const r    = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': phpSecret },
      body: JSON.stringify(payload),
    });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── API: Crawl 3 Miền (XSMB, XSMN, XSMT) ─────────────────
app.post('/api/crawler/mien', ui.requireAuth, async (req, res) => {
  const { url: phpProxyUrl, secret: phpSecret } = resolveCrawlProxy();
  const useProxy = !!(phpProxyUrl && phpSecret);

  if (!useProxy) {
    return res.status(500).json({ ok: false, msg: 'Chưa cấu hình PHP Server URL và Secret! Vào Dashboard → thêm site hoặc điền PHP Server URL.' });
  }

  logger.log(`[Crawl 3 Miền] mode=PHP_PROXY url=${phpProxyUrl || 'N/A'}`);

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
      phpProxyUrl: phpProxyUrl,
      phpPushSecret: useProxy ? phpSecret  : undefined,
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

// Đã bỏ /api/mysql-check

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

    // Bỏ qua kiểm tra Token qua DB (vì NodeJS bot không còn nối MySQL trực tiếp)
    // Các client có token đều được phép nhận SSE stream.

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

  // Khởi chạy ngầm tính năng Ketqua.Plus Vietlott Live Polling
  const liveVietlott = require('./live-vietlott');
  liveVietlott.startLiveVietlottDaemon(logger.log);

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

module.exports.default = app;
require('./forum-bot');
