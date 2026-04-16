/**
 * scheduler.js — Quản lý vòng lặp poll và auto-schedule theo giờ xổ
 */
'use strict';

const { fetchRegion, isRegionComplete } = require('./fetcher');
const { pushToWeb, resolveDrawDate }     = require('./pusher');
const { SCHEDULE, POLL_INTERVAL_ACTIVE, POLL_INTERVAL_IDLE, REGION_NAMES,
        PROVINCE_SCHEDULE, VIETLOTT_SCHEDULE, VIETLOTT_NAMES } = require('./config');
const { crawl } = require('./crawler-vietlott');

// State: region/game → { timer, lastData, running, manual, doneForToday }
const state = {};
const vietlottState = {
  mega: { doneForToday: false, timer: null },
  power: { doneForToday: false, timer: null },
  max3d: { doneForToday: false, timer: null },
  max3dpro: { doneForToday: false, timer: null },
};

// ─── Callback thông báo khi một miền xong ──────────────────────
let notifyFn = null;
function setNotifyFn(fn) { notifyFn = fn; }

// ─── Giờ an toàn tối đa: bot PHẢI tự dừng sau mốc này dù manual hay auto ──
// 2h buffer sau giờ bắt đầu xổ (MN 16:00 → 18:00, MT 17:00 → 18:30, MB 18:00 → 20:00)
const SAFE_STOP = {
  mn: '18:00',
  mt: '18:30',
  mb: '20:00',
};

// ─── Lấy giờ phút hiện tại theo VN ────────────────────────
function nowVN() {
  const now = new Date();
  const hhmm = now.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return hhmm; // "16:35"
}

// Đã qua giờ an toàn tối đa chưa?
function isPastSafeStop(region) {
  const safeTime = SAFE_STOP[region];
  if (!safeTime) return false;
  return nowVN() >= safeTime;
}

function isInSchedule(region) {
  if (vietlottState[region]) {
    // Thời gian xổ Vietlott chung: 18:00 - 18:30. Ta auto-run bot từ 18:15 đến 18:45
    const now = nowVN();
    return now >= '18:15' && now <= '18:45';
  }
  const sch = SCHEDULE[region];
  if (!sch) return false;
  const now = nowVN();
  return now >= sch.start && now <= sch.end;
}

// ─── So sánh 2 lần fetch để xem có số mới không ────────────
function hasNewData(oldResults, newResults) {
  if (!oldResults) return true; // Lần đầu luôn là mới
  if (!newResults) return false;

  const oldStr = JSON.stringify(oldResults);
  const newStr = JSON.stringify(newResults);
  return oldStr !== newStr;
}

// ─── Một lần poll ─────────────────────────────────────────
async function pollOnce(region, onLog) {
  // ── Kiểm tra giờ an toàn: đã qua mốc tối đa → dừng hẳn ─────────────────
  if (isPastSafeStop(region)) {
    onLog(`[${region.toUpperCase()}] ⏹ Đã qua giờ an toàn (${SAFE_STOP[region]}), tự dừng.`);
    stop(region, onLog);
    return;
  }

  try {
    const results = await fetchRegion(region);
    if (!results) {
      onLog(`[${region.toUpperCase()}] API không trả về data`);
      return;
    }

    const drawDate = resolveDrawDate(region);
    const apiDateRaw = results[0]?.apiDate;
    if (apiDateRaw) {
      const dp = apiDateRaw.split('-');
      if (dp.length >= 3) {
         const apiDateStr = `${dp[2]}-${dp[1]}-${dp[0]}`;
         if (apiDateStr !== drawDate) {
            // API kqxs.tube chưa reset ngày mới → bỏ qua
            onLog(`[${region.toUpperCase()}] ⏳ Đang chờ kqxs.tube up ngày mới (hiện tại: ${apiDateStr}, cần: ${drawDate})`);
            return;
         }
      }
    }

    const old = state[region]?.lastData;
    if (hasNewData(old, results)) {
      state[region].lastData = results;

      const doneCount = results.filter(r => r.done).length;
      const total     = results.length;
      onLog(`[${region.toUpperCase()}] 📅 Draw date: ${drawDate} | Cập nhật mới! ${doneCount}/${total} tỉnh xong — push sang web...`);

      const ok = await pushToWeb(region, results, onLog);
      onLog(ok
        ? `[${region.toUpperCase()}] ✅ Push OK → ${drawDate}`
        : `[${region.toUpperCase()}] ⚠️ Push thất bại`
      );

      // Kiểm tra xổ xong hoàn toàn
      if (isRegionComplete(results)) {
        const notice = buildCompletionNotice(region, results);
        onLog(`[${region.toUpperCase()}] 🏁 ${REGION_NAMES[region]} đã xổ xong ngày ${drawDate}!`);
        if (notifyFn) notifyFn(notice);
        stop(region, onLog);
      }
    } else {
      onLog(`[${region.toUpperCase()}] Không có số mới (${resolveDrawDate(region)})`);
    }
  } catch (e) {
    onLog(`[${region.toUpperCase()}] ❌ Lỗi poll: ${e.message}`);
  }
}

// ─── Bắt đầu poll region ──────────────────────────────────
function start(region, onLog, manual = false) {
  if (state[region]?.running) {
    onLog(`[${region.toUpperCase()}] Đang chạy rồi`);
    return;
  }

  const interval = manual ? POLL_INTERVAL_IDLE : POLL_INTERVAL_ACTIVE;
  onLog(`[${region.toUpperCase()}] 🚀 Bắt đầu poll mỗi ${interval / 1000}s`);

  state[region] = {
    running:  true,
    manual,
    lastData: null,
  };

  // Chạy ngay lần đầu
  pollOnce(region, onLog);

  // Sau đó loop
  state[region].timer = setInterval(() => pollOnce(region, onLog), interval);
}

// ─── Dừng poll region ─────────────────────────────────────
function stop(region, onLog) {
  if (!state[region]?.running) {
    onLog?.(`[${region.toUpperCase()}] Không có gì đang chạy`);
    return;
  }
  clearInterval(state[region].timer);
  state[region].running = false;
  onLog?.(`[${region.toUpperCase()}] ⏹ Đã dừng`);
}


// ─── Dừng tất cả ──────────────────────────────────────────
function stopAll(onLog) {
  ['mb', 'mn', 'mt'].forEach(r => stop(r, onLog));
  ['mega', 'power', 'max3d', 'max3dpro'].forEach(r => {
    if (vietlottState[r].timer) clearInterval(vietlottState[r].timer);
  });
}

// ─── Build thông báo Telegram khi 1 miền hoàn thành ───────
function buildCompletionNotice(doneRegion, results) {
  const tz     = 'Asia/Ho_Chi_Minh';
  const now    = new Date();
  const dowIdx = new Date(now.toLocaleDateString('sv-SE', { timeZone: tz })).getDay();

  // Lấy template từ storage (nếu admin đã tùy chỉnh)
  const storage = require('./storage');
  const cfg     = storage.load();
  const tpl     = cfg.bot_messages || {};

  const T = {
    completion_header: tpl.completion_header || '✅ <b>Xổ Số {region_done}</b> đã cập nhật trực tiếp và đầy đủ Full số thành công!',
    pending_header   : tpl.pending_header    || '⏳ <b>Các hàng còn đợi:</b>',
    vietlott_header  : tpl.vietlott_header   || '🎰 <b>Vietlott</b> (18:00 - 18:30)',
    all_done         : tpl.all_done          || '🏆 Tất cả cuộc xổ hôm nay đã hoàn thành!',
  };

  // --- Phần đã xong ---
  const doneProvinces = results.map(r => `  • ${r.province}`).join('\n');
  let msg  = T.completion_header.replace('{region_done}', REGION_NAMES[doneRegion]) + '\n';
  msg     += doneProvinces + '\n';

  // --- Các miền còn chờ ---
  const pendingRegions = [];
  for (const r of ['mn', 'mt', 'mb']) {
    if (r === doneRegion) continue;
    const todayProvinces = (PROVINCE_SCHEDULE[r] || {})[dowIdx] || [];
    if (todayProvinces.length === 0) continue;
    pendingRegions.push({ region: r, provinces: todayProvinces, running: !!state[r]?.running });
  }
  const pendingVietlott = [];
  for (const [game, days] of Object.entries(VIETLOTT_SCHEDULE)) {
    if (!days.includes(dowIdx)) continue;
    if (vietlottState[game]?.doneForToday) continue;
    pendingVietlott.push(VIETLOTT_NAMES[game] || game);
  }

  if (pendingRegions.length > 0 || pendingVietlott.length > 0) {
    msg += '\n' + T.pending_header + '\n';
    for (const pr of pendingRegions) {
      const icon = pr.running ? '🔴' : '⏳';
      msg += `\n${icon} <b>Xổ Số ${REGION_NAMES[pr.region]}</b>\n`;
      msg += pr.provinces.map(p => `  • ${p}`).join('\n') + '\n';
    }
    if (pendingVietlott.length > 0) {
      msg += '\n' + T.vietlott_header + '\n';
      msg += pendingVietlott.map(g => `  • ${g}`).join('\n') + '\n';
    }
  } else {
    msg += '\n' + T.all_done;
  }
  return msg.trim();
}

// ─── Status hiện tại ──────────────────────────────────────
function getStatus() {
  const lines = [];
  for (const region of ['mb', 'mn', 'mt']) {
    const s = state[region];
    if (s?.running) {
      const doneCount = s.lastData ? s.lastData.filter(r => r.done).length : 0;
      const total     = s.lastData ? s.lastData.length : 0;
      lines.push(`🔴 ${REGION_NAMES[region]}: đang poll — ${doneCount}/${total} tỉnh xong`);
    } else {
      lines.push(`⚫ ${REGION_NAMES[region]}: dừng`);
    }
  }
  for (const game of ['mega', 'power', 'max3d', 'max3dpro']) {
    if (vietlottState[game].timer) lines.push(`🔴 Vietlott ${game.toUpperCase()}: đang poll liên tục`);
    else lines.push(`⚫ Vietlott ${game.toUpperCase()}: dừng (xong hôm nay: ${vietlottState[game].doneForToday})`);
  }
  return lines.join('\n');
}

// ─── Auto-schedule: check mỗi 1 phút ─────────────────────
function startAutoSchedule(onLog) {
  onLog('[Scheduler] Auto-schedule: Sẽ tự động get số khi đến giờ quay (nếu config bật)');
  setInterval(() => {
    // Luôn load cấu hình mới nhất
    const storage = require('./storage');
    const autoScheduleEnabled = storage.load().auto_schedule;
    
    // Nếu bị tắt trên dashboard thì bỏ qua
    if (autoScheduleEnabled === false) return;

    // ── Force stop nếu đang chạy mà đã qua giờ an toàn ─────────────────────
    for (const region of ['mn', 'mt', 'mb']) {
      if (state[region]?.running && isPastSafeStop(region)) {
        onLog(`[Scheduler] ⏹ Force stop ${REGION_NAMES[region]} — đã qua ${SAFE_STOP[region]}`);
        stop(region, onLog);
      }
    }

    for (const region of ['mn', 'mt', 'mb']) {
      const inSchedule = isInSchedule(region);
      const running    = state[region]?.running;

      if (inSchedule && !running) {
        onLog(`[Scheduler] 🕒 Đã đến giờ xổ ${REGION_NAMES[region]} → tự động kích hoạt bot!`);
        start(region, onLog, false);
      }
    }

    // Auto-schedule Vietlott
    const nowHHMM = nowVN();
    if (nowHHMM === '00:00' || nowHHMM === '00:01') {
      // Reset trạng thái ngày mới
      Object.keys(vietlottState).forEach(g => vietlottState[g].doneForToday = false);
    }

    for (const game of ['mega', 'power', 'max3d', 'max3dpro']) {
      const inSch = isInSchedule(game);
      const s = vietlottState[game];

      if (inSch && !s.doneForToday && !s.timer) {
        onLog(`[Scheduler] 🕒 Kích hoạt auto-crawl Vietlott ${game.toUpperCase()}...`);
        s.timer = setInterval(async () => {
          if (!isInSchedule(game)) {
             clearInterval(s.timer);
             s.timer = null;
             return;
          }
          const cfg   = storage.load();
          const today = new Date().toISOString().split('T')[0];

          // Resolve PHP proxy URL: ưu tiên legacy fields, fallback về sites[0]
          const sites       = storage.getSites();
          const phpProxyUrl = cfg.php_server_url
                           || (sites.length > 0 ? sites[0].domain.replace(/\/+$/, '') + '/api/crawl-save.php' : '');
          const phpPushSecret = (cfg.php_push_secret || '').trim()
                             || (sites.length > 0 ? sites[0].secret : '');

          if (!phpProxyUrl || !phpPushSecret) return; // chưa cấu hình → bỏ qua

          try {
            const res = await crawl({
              games: [game],
              from: today,
              to: today,
              phpProxyUrl,
              phpPushSecret,
              onLog
            });
            if (res.saved > 0) {
              onLog(`[Scheduler] 🏁 Vietlott ${game.toUpperCase()} đã lấy thành công hôm nay!`);
              s.doneForToday = true;
              clearInterval(s.timer);
              s.timer = null;
            }
          } catch(e) {}
        }, 60000); // Poll mỗi 60 giây nha
      }
    }
  }, 60 * 1000); // check mỗi 1 phút
}

// ─── Lấy kết quả hiện tại ─────────────────────────────────
function getCurrentData(region) {
  return state[region]?.lastData || null;
}

module.exports = { start, stop, stopAll, getStatus, startAutoSchedule, getCurrentData, setNotifyFn };
