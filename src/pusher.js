/**
 * pusher.js — Push data mới sang PHP hosting qua HTTP POST
 *
 * Logic xác định draw_date đúng:
 *   MN/MT xổ lúc 16:00 → trước 16:00 = dữ liệu hôm qua, sau 16:00 = hôm nay
 *   MB    xổ lúc 18:30 → trước 18:30 = dữ liệu hôm qua, sau 18:30 = hôm nay
 */
'use strict';

const { SCHEDULE } = require('./config');

// ─── Xác định draw_date đúng theo region + giờ hiện tại ────
function resolveDrawDate(region) {
  const tz = 'Asia/Ho_Chi_Minh';

  // Lấy giờ phút hiện tại theo VN (format HH:MM)
  const now = new Date();
  const hhmm = now.toLocaleTimeString('vi-VN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }); // vd: "15:45" hoặc "18:55"

  // Lấy ngày hôm nay và hôm qua theo giờ VN
  const todayStr     = now.toLocaleDateString('sv-SE', { timeZone: tz });    // "2026-04-04"
  const yesterdayStr = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('sv-SE', { timeZone: tz });
  })();

  // Giờ bắt đầu xổ của region
  const startTime = SCHEDULE[region]?.start || '16:00';

  // Nếu bây giờ chưa đến giờ xổ → dữ liệu fetch về là của hôm qua
  if (hhmm < startTime) {
    console.log(`[DrawDate] ${region.toUpperCase()} | Hiện tại ${hhmm} < ${startTime} → dữ liệu ngày ${yesterdayStr} (hôm qua)`);
    return yesterdayStr;
  }

  console.log(`[DrawDate] ${region.toUpperCase()} | Hiện tại ${hhmm} >= ${startTime} → dữ liệu ngày ${todayStr} (hôm nay)`);
  return todayStr;
}

// ─── Push data sang PHP hosting ────────────────────────────
async function pushToWeb(region, results) {
  const PHP_HOST   = process.env.PHP_HOST        || require('./storage').get('php_host')        || '';
  const PHP_SECRET = process.env.PHP_PUSH_SECRET || require('./storage').get('php_push_secret') || '';

  if (!PHP_HOST || !PHP_SECRET) {
    console.warn('[Pusher] PHP_HOST hoặc PHP_PUSH_SECRET chưa cấu hình, bỏ qua push.');
    return false;
  }

  // Xác định ngày đúng dựa vào region + giờ hiện tại
  const drawDate = resolveDrawDate(region);

  const url = `${PHP_HOST.replace(/\/$/, '')}/api/live-push.php`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': PHP_SECRET,
      },
      body: JSON.stringify({
        region,
        date:    drawDate,   // ← Ngày đã được xác thực đúng
        results,
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Pusher] HTTP ${res.status}: ${body.substring(0, 200)}`);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Pusher] Lỗi push:', e.message);
    return false;
  }
}

module.exports = { pushToWeb, resolveDrawDate };
