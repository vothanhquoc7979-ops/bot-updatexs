/**
 * bot-manager.js — Khởi động và restart Telegram Bot
 * Tách ra để UI có thể trigger restart khi save config mới
 */
'use strict';

const { Telegraf } = require('telegraf');
const storage = require('./storage');
const logger  = require('./logger');

let botInstance = null;

async function start() {
  const token = storage.get('telegram_bot_token')
    || process.env.TELEGRAM_BOT_TOKEN || '';

  if (!token) {
    logger.log('⚠️ Chưa có Telegram Bot Token — bot Telegram chưa khởi động');
    return null;
  }

  const { Telegraf } = require('telegraf');
  const bot = new Telegraf(token);

  // ── Commands ─────────────────────────────────────────
  const { start: schedStart, stop: schedStop, stopAll, getStatus, getCurrentData } = require('./scheduler');
  const { REGION_NAMES } = require('./config');

  function tgLog(msg) {
    logger.log(msg);
    const chatId = storage.get('telegram_chat_id') || process.env.TELEGRAM_CHAT_ID || '';
    if (chatId) {
      bot.telegram.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {});
    }
  }

  function formatResults(results) {
    if (!results || results.length === 0) return 'Chưa có dữ liệu.';
    return results.map(r => {
      const p = r.prizes || {};
      const icon = r.done ? '✅' : '🔄';
      const lines = [
        `${icon} <b>${r.province}</b>`,
        p.prize_db ? `🎯 ĐB: <code>${p.prize_db}</code>` : '🎯 ĐB: --',
        p.prize_1  ? `  G1: ${p.prize_1}` : '',
        p.prize_2  ? `  G2: ${p.prize_2}` : '',
        p.prize_7  ? `  G7: ${p.prize_7}` : '',
        p.prize_8  ? `  G8: ${p.prize_8}` : '',
      ].filter(Boolean);
      return lines.join('\n');
    }).join('\n\n');
  }

  bot.command('start', ctx => ctx.reply(
    '🎰 <b>KQXS Live Bot</b>\n\n' +
    '/chay mb|mn|mt|all — Bắt đầu poll\n' +
    '/dung [mb|mn|mt] — Dừng\n' +
    '/xem mb|mn|mt — Xem KQ\n' +
    '/status — Trạng thái\n' +
    '/lichxo — Lịch xổ hôm nay',
    { parse_mode: 'HTML' }
  ));

  bot.command('chay', ctx => {
    const arg = ctx.message.text.split(' ')[1]?.toLowerCase() || '';
    if (arg === 'all') {
      ['mn', 'mt', 'mb'].forEach(r => schedStart(r, tgLog, true));
      return ctx.reply('🚀 Đã bắt đầu poll cả 3 miền!');
    }
    if (!['mb','mn','mt'].includes(arg)) return ctx.reply('❌ Dùng: /chay mb | mn | mt | all');
    schedStart(arg, tgLog, true);
    ctx.reply(`🚀 Bắt đầu poll ${REGION_NAMES[arg]}...`);
  });

  bot.command('dung', ctx => {
    const arg = ctx.message.text.split(' ')[1]?.toLowerCase() || '';
    if (!arg || arg === 'all') { stopAll(tgLog); return ctx.reply('⏹ Đã dừng tất cả.'); }
    if (!['mb','mn','mt'].includes(arg)) return ctx.reply('❌ Dùng: /dung | /dung mb|mn|mt');
    schedStop(arg, tgLog);
    ctx.reply(`⏹ Đã dừng ${REGION_NAMES[arg]}`);
  });

  bot.command('xem', ctx => {
    const arg = ctx.message.text.split(' ')[1]?.toLowerCase() || '';
    if (!['mb','mn','mt'].includes(arg)) return ctx.reply('❌ Dùng: /xem mb | mn | mt');
    const data = getCurrentData(arg);
    if (!data) return ctx.reply(`ℹ️ Chưa có dữ liệu. Dùng /chay ${arg} trước.`);
    ctx.reply(`📊 <b>KQ ${REGION_NAMES[arg]}</b>\n\n` + formatResults(data), { parse_mode: 'HTML' });
  });

  bot.command('status', ctx => {
    ctx.reply('📊 <b>Trạng thái:</b>\n\n' + getStatus(), { parse_mode: 'HTML' });
  });

  bot.command('lichxo', ctx => {
    ctx.reply(
      '📅 <b>Lịch xổ hôm nay</b>\n\n' +
      '🟢 Miền Nam / Miền Trung: 16:00 – 17:30\n' +
      '🔴 Miền Bắc: 18:30 – 19:15',
      { parse_mode: 'HTML' }
    );
  });

  bot.catch(err => logger.log(`[Bot Error] ${err.message}`));

  try {
    await bot.launch();
    logger.log('✅ Telegram Bot đã khởi động');
    botInstance = bot;

    // Bật auto-schedule
    const cfg = storage.load();
    if (cfg.auto_schedule !== false) {
      const { startAutoSchedule } = require('./scheduler');
      startAutoSchedule(tgLog);
    }
  } catch (e) {
    logger.log(`❌ Không thể khởi động bot: ${e.message}`);
    botInstance = null;
  }

  return botInstance;
}

async function restart() {
  if (botInstance) {
    try { botInstance.stop('restart'); } catch (_) {}
    botInstance = null;
    logger.log('[BotManager] Bot cũ đã dừng, đang restart...');
    await new Promise(r => setTimeout(r, 1000));
  }
  await start();
}

function getInstance() { return botInstance; }

module.exports = { start, restart, getInstance };
