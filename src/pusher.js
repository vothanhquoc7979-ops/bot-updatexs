/**
 * pusher.js — Push data mới sang PHP hosting qua HTTP POST
 */
'use strict';

const PHP_HOST   = process.env.PHP_HOST   || '';
const PHP_SECRET = process.env.PHP_PUSH_SECRET || '';

async function pushToWeb(region, results) {
  if (!PHP_HOST || !PHP_SECRET) {
    console.warn('[Pusher] PHP_HOST hoặc PHP_PUSH_SECRET chưa cấu hình, bỏ qua push.');
    return false;
  }

  const url = `${PHP_HOST.replace(/\/$/, '')}/api/live-push.php`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'X-Bot-Secret':  PHP_SECRET,
      },
      body: JSON.stringify({
        region,
        date:    todayVN(),
        results, // array of { province, region, done, prizes }
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

// Ngày hôm nay theo giờ VN (Y-m-d)
function todayVN() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

module.exports = { pushToWeb };
