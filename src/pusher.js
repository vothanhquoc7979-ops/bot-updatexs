/**
 * pusher.js — Push data mới sang tất cả PHP hosting qua HTTP POST song song
 *
 * Logic xác định draw_date đúng:
 *   MN/MT xổ lúc 16:00 → trước 16:00 = dữ liệu hôm qua, sau 16:00 = hôm nay
 *   MB    xổ lúc 18:30 → trước 18:30 = dữ liệu hôm qua, sau 18:30 = hôm nay
 */
'use strict';

const { SCHEDULE } = require('./config');
const { getSites } = require('./storage');

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

// ─── Push đến 1 site ───────────────────────────────────────
async function pushToOneSite(domain, secret, endpoint, body) {
  const url = domain.replace(/\/+$/, '') + endpoint;
  try {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 8000);
    const res  = await fetch(url, {
      method:  'POST',
      signal:  ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
      body,
    });
    clearTimeout(t);
    if (!res.ok) {
      const txt = await res.text();
      console.error('[Pusher] HTTP ' + res.status + ' ← ' + url + ': ' + txt.slice(0, 200));
    }
    return res.ok;
  } catch (e) {
    console.error('[Pusher] Lỗi → ' + url + ': ' + e.message);
    return false;
  }
}

// ─── Push data đến TẤT CẢ sites song song ──────────────────
async function pushToWeb(region, results) {
  const sites = getSites();
  if (!sites.length) {
    console.warn('[Pusher] Chưa cấu hình site nào, bỏ qua push.');
    return false;
  }

  const drawDate = resolveDrawDate(region);
  const body     = JSON.stringify({ region, date: drawDate, results });

  const settled = await Promise.allSettled(
    sites.map(({ domain, secret }) => {
      console.log('[Pusher] → ' + domain + '/api/live-push.php');
      return pushToOneSite(domain, secret, '/api/live-push.php', body);
    })
  );

  const ok  = settled.filter(r => r.status === 'fulfilled' && r.value).length;
  const all = settled.length;
  console.log('[Pusher] Xong: ' + ok + '/' + all + ' sites OK');
  return ok > 0;
}

module.exports = { pushToWeb, resolveDrawDate, pushToOneSite };
