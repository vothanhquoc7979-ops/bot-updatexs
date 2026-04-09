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

  const now = new Date();
  const hhmm = now.toLocaleTimeString('vi-VN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const todayStr     = now.toLocaleDateString('sv-SE', { timeZone: tz });
  const yesterdayStr = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('sv-SE', { timeZone: tz });
  })();

  const startTime = SCHEDULE[region]?.start || '16:00';

  if (hhmm < startTime) {
    console.log('[DrawDate] ' + region.toUpperCase() + ' | Hien tai ' + hhmm + ' < ' + startTime + ' → du lieu ngay ' + yesterdayStr + ' (hom qua)');
    return yesterdayStr;
  }

  console.log('[DrawDate] ' + region.toUpperCase() + ' | Hien tai ' + hhmm + ' >= ' + startTime + ' → du lieu ngay ' + todayStr + ' (hom nay)');
  return todayStr;
}

// ─── Push data sang PHP hosting ────────────────────────────
async function pushToWeb(region, results) {
  const phpProxyUrl = require('./storage').get('php_server_url') || process.env.PHP_PROXY_URL || '';
  const PHP_SECRET  = require('./storage').get('php_push_secret') || process.env.BOT_PUSH_SECRET || '';

  if (!phpProxyUrl) {
    console.warn('[Pusher] PHP_PROXY_URL chưa cấu hình, bỏ qua push.');
    return false;
  }
  if (!PHP_SECRET) {
    console.warn('[Pusher] BOT_PUSH_SECRET chưa cấu hình, bỏ qua push.');
    return false;
  }

  const drawDate = resolveDrawDate(region);
  const url = phpProxyUrl.replace('/crawl-save.php', '/live-push.php');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const body = JSON.stringify({ region, date: drawDate, results });

    const res = await fetch(url, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': PHP_SECRET,
      },
      body,
    });

    clearTimeout(timer);

    const bodyTxt = await res.text();
    if (!res.ok) {
      console.error('[Pusher] HTTP ' + res.status + ' tu ' + url + ': ' + bodyTxt.substring(0, 300));
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Pusher] Loi ket noi den ' + url + ': ' + e.message);
    return false;
  }
}

module.exports = { pushToWeb, resolveDrawDate };
