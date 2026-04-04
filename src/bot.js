/**
 * bot.js — Telegram Bot (Telegraf) xử lý lệnh từ user
 */
'use strict';

const { Telegraf } = require('telegraf');
const { start, stop, stopAll, getStatus, getCurrentData } = require('./scheduler');
const { REGION_NAMES } = require('./config');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// ─── Logger gửi message vào Telegram ─────────────────────
function tgLog(msg) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    bot.telegram.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {});
  }
  console.log(msg);
}

// ─── Format kết quả thành text đẹp ───────────────────────
function formatResults(results) {
  if (!results || results.length === 0) return 'Chưa có dữ liệu.';

  return results.map(r => {
    const p = r.prizes;
    const status = r.done ? '✅' : '🔄';
    const lines = [
      `${status} <b>${r.province}</b>`,
      p.prize_db ? `🎯 ĐB: <code>${p.prize_db}</code>` : '🎯 ĐB: --',
      p.prize_1  ? `  G1: ${p.prize_1}` : '',
      p.prize_2  ? `  G2: ${p.prize_2}` : '',
      p.prize_3  ? `  G3: ${p.prize_3}` : '',
      p.prize_4  ? `  G4: ${p.prize_4}` : '',
      p.prize_5  ? `  G5: ${p.prize_5}` : '',
      p.prize_6  ? `  G6: ${p.prize_6}` : '',
      p.prize_7  ? `  G7: ${p.prize_7}` : '',
      p.prize_8  ? `  G8: ${p.prize_8}` : '',
    ].filter(l => l !== '');
    return lines.join('\n');
  }).join('\n\n');
}

// ─── Commands ─────────────────────────────────────────────

bot.command('start', ctx => {
  ctx.reply(
    '🎰 <b>KQXS Live Bot</b>\n\n' +
    'Các lệnh:\n' +
    '/chay mb — Chạy Miền Bắc\n' +
    '/chay mn — Chạy Miền Nam\n' +
    '/chay mt — Chạy Miền Trung\n' +
    '/chay all — Chạy tất cả theo lịch\n' +
    '/dung — Dừng tất cả\n' +
    '/dung mb|mn|mt — Dừng 1 vùng\n' +
    '/xem mb|mn|mt — Xem KQ hiện tại\n' +
    '/status — Xem trạng thái\n' +
    '/lichxo — Lịch xổ hôm nay',
    { parse_mode: 'HTML' }
  );
});

bot.command('chay', ctx => {
  const arg = ctx.message.text.split(' ')[1]?.toLowerCase() || '';

  if (arg === 'all') {
    ['mn', 'mt', 'mb'].forEach(r => start(r, tgLog, true));
    ctx.reply('🚀 Đã bắt đầu poll cả 3 miền!');
    return;
  }

  if (!['mb', 'mn', 'mt'].includes(arg)) {
    ctx.reply('❌ Dùng: /chay mb | /chay mn | /chay mt | /chay all');
    return;
  }

  start(arg, tgLog, true);
  ctx.reply(`🚀 Bắt đầu poll ${REGION_NAMES[arg]}...`);
});

bot.command('dung', ctx => {
  const arg = ctx.message.text.split(' ')[1]?.toLowerCase() || '';

  if (!arg || arg === 'all') {
    stopAll(tgLog);
    ctx.reply('⏹ Đã dừng tất cả.');
    return;
  }

  if (!['mb', 'mn', 'mt'].includes(arg)) {
    ctx.reply('❌ Dùng: /dung | /dung mb | /dung mn | /dung mt');
    return;
  }

  stop(arg, tgLog);
  ctx.reply(`⏹ Đã dừng ${REGION_NAMES[arg]}`);
});

bot.command('xem', ctx => {
  const arg = ctx.message.text.split(' ')[1]?.toLowerCase() || '';

  if (!['mb', 'mn', 'mt'].includes(arg)) {
    ctx.reply('❌ Dùng: /xem mb | /xem mn | /xem mt');
    return;
  }

  const data = getCurrentData(arg);
  if (!data) {
    ctx.reply(`ℹ️ ${REGION_NAMES[arg]}: chưa có dữ liệu. Dùng /chay ${arg} trước.`);
    return;
  }

  ctx.reply(
    `📊 <b>KQ ${REGION_NAMES[arg]}</b>\n\n` + formatResults(data),
    { parse_mode: 'HTML' }
  );
});

bot.command('status', ctx => {
  ctx.reply('📊 <b>Trạng thái:</b>\n\n' + getStatus(), { parse_mode: 'HTML' });
});

bot.command('lichxo', ctx => {
  const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  ctx.reply(
    `📅 <b>Lịch xổ hôm nay (${today})</b>\n\n` +
    '🟢 Miền Nam : 16:00 – 17:30\n' +
    '🔵 Miền Trung: 16:00 – 17:30\n' +
    '🔴 Miền Bắc : 18:30 – 19:15\n\n' +
    'Bot sẽ tự chạy theo lịch nếu bạn bật /chay all',
    { parse_mode: 'HTML' }
  );
});

// ─── Error handling ────────────────────────────────────────
bot.catch((err) => {
  console.error('[Bot] Lỗi:', err.message);
});

module.exports = { bot, tgLog };
