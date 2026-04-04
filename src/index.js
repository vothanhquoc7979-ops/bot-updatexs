/**
 * index.js — Entry point: khởi động Express + Telegram Bot + Auto-scheduler
 */
'use strict';

require('dotenv').config();

const express = require('express');
const { bot, tgLog } = require('./bot');
const { startAutoSchedule } = require('./scheduler');

const PORT = process.env.PORT || 3000;
const app  = express();
app.use(express.json());

// ─── Health check endpoint (Railway dùng để check app còn sống) ─
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'xoso-live-bot', time: new Date().toISOString() });
});

// ─── Khởi động Bot và Auto-scheduler ─────────────────────
async function main() {
  console.log('[Main] Khởi động KQXS Live Bot...');

  // Bật auto-schedule theo giờ xổ VN
  startAutoSchedule(tgLog);

  // Launch bot (long polling — phù hợp Railway)
  await bot.launch();
  console.log('[Main] Telegram Bot đang chạy (long polling)');

  // Keep Express alive (Railway cần HTTP server)
  app.listen(PORT, () => {
    console.log(`[Main] HTTP server: http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[Main] Lỗi khởi động:', err);
  process.exit(1);
});

// ─── Graceful shutdown ────────────────────────────────────
process.once('SIGINT',  () => { bot.stop('SIGINT');  process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
