'use strict';
const cheerio = require('cheerio');
const crypto = require('crypto');

// ─── HTTP helper ──────────────────────────────────────────
async function httpGet(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch (_) {
    clearTimeout(timer);
    return null;
  }
}

// ─── Ketqua.plus SSR parser cho xổ số tĩnh (Mega, Power, Max) ─────
async function fetchKetquaPlus(gameType, dateStr, urlSlug) {
  const url = `https://ketqua.plus/${urlSlug}`;
  
  const html = await httpGet(url);
  if (!html) return null;

  const match = html.match(/window\.__SSR_DATA__\s*=\s*(.*?)(?:;?<\/script>)/s);
  if (!match) return null;

  let json;
  try {
    json = JSON.parse(match[1]);
  } catch (e) { return null; }

  const draws = json?.vietlott_list?.draws || [];
  const draw = draws.find(dObj => (dObj.drawDate || '').startsWith(dateStr));
  if (!draw) return null;

  let numbers = '';
  const nums = draw.numbers || {};
  const pad = n => String(n).padStart(2, '0');

  if (gameType === 'mega645' || gameType === 'power655') {
    if (Array.isArray(nums)) numbers = nums.map(pad).join(',');
  } else if (gameType === 'max3d') {
    const sp = (nums.special || []).join(',');
    const f1 = (nums.first || []).join(',');
    const f2 = (nums.second || []).join(',');
    const f3 = (nums.third || []).join(',');
    numbers = [sp, f1, f2, f3].join('|');
  } else if (gameType === 'max3dpro') {
    const sp = (nums.special || []).join(',');
    const sps = (nums.special_sub || []).join(',');
    const f1 = (nums.first || []).join(',');
    const f2 = (nums.second || []).join(',');
    const f3 = (nums.third || []).join(',');
    numbers = [sp, sps, f1, f2, f3].join('|');
  } else if (gameType === 'max4d') {
    const g1 = nums.g1 || '';
    const g2 = (nums.g2 || []).join(',');
    const g3 = (nums.g3 || []).join(',');
    numbers = [g1, g2, g3].join('|');
  }

  let drawNumber = draw.drawCode || draw.drawNum || '';
  if (drawNumber) drawNumber = '#' + String(drawNumber).padStart(5, '0');

  let jackpot1 = typeof draw.jackpot1 !== 'undefined' && draw.jackpot1 !== null ? String(draw.jackpot1).replace(/\D/g, '') : null;
  let jackpot2 = typeof draw.jackpot2 !== 'undefined' && draw.jackpot2 !== null ? String(draw.jackpot2).replace(/\D/g, '') : null;

  return {
    game_type: gameType,
    draw_date: dateStr,
    draw_number: drawNumber,
    numbers: numbers.replace(/\|+$/, '').replace(/(^\|+|\|+$)/g, ''), // clean trailing/leading pipes
    power_ball: draw.specialNum ? pad(draw.specialNum) : null,
    jackpot: jackpot1,
    jackpot2: jackpot2,
    prizes: null
  };
}

async function fetchMega(dateStr)     { return await fetchKetquaPlus('mega645', dateStr, 'xo-so-mega-645'); }
async function fetchPower(dateStr)    { return await fetchKetquaPlus('power655', dateStr, 'xo-so-power-655'); }
async function fetchMax3D(dateStr)    { return await fetchKetquaPlus('max3d', dateStr, 'xo-so-max-3d'); }
async function fetchMax3DPro(dateStr) { return await fetchKetquaPlus('max3dpro', dateStr, 'xo-so-max-3d-pro'); }
async function fetchMax4D(dateStr)    { return await fetchKetquaPlus('max4d', dateStr, 'xo-so-max-4d'); }

// ─── Ketqua.plus Keno API ──────────────────────────────
async function fetchKeno(dateStr) {
  const ts = Date.now().toString();
  const path = '/api/public/vietlott/keno?page=1&limit=100';
  const method = 'GET';
  // Ketqua.plus signature generation reverse-engineered from their React app SSR module
  const stringToSign = `${ts}:${method}:${path}`; 
  const sig = crypto.createHmac('sha256', 'xs365-api-sign-key-2026').update(stringToSign).digest('hex');

  const controller = new AbortController();
  // using api.xs365.vn because the ketqua.plus falls back to Nextjs HTML.
  const url = 'https://api.xs365.vn' + path;
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-Ts': ts,
        'X-Sig': sig,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    clearTimeout(timer);
    
    if (!res.ok) {
      // Fallback API if xs365.vn block our endpoint
      const url2 = 'https://api.ketquaviet.net' + path;
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 15000);
      try {
          const res2 = await fetch(url2, {
              signal: controller2.signal,
              headers: { 'X-Ts': ts, 'X-Sig': sig, 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
          });
          clearTimeout(timer2);
          if (!res2.ok) return null;
          const json2 = await res2.json();
          // parse logic down
          return parseKenoJsonArray(json2, dateStr);
      } catch(e2) {
          clearTimeout(timer2);
          return await fetchKenoXosothantai(dateStr); // Last resort fallback to keep Keno alive
      }
    }
    
    const json = await res.json();
    return parseKenoJsonArray(json, dateStr);

  } catch (e) {
    clearTimeout(timer);
    // Connection refuse fallback to xosothantai
    return await fetchKenoXosothantai(dateStr);
  }
}

function parseKenoJsonArray(json, dateStr) {
  const draws = json.data || json.draws || json.vietlott_list?.draws || [];
  const matched = draws.filter(d => (d.drawDate || '').startsWith(dateStr));
  if (matched.length === 0) return null;

  return matched.map(draw => {
    let numbers = '';
    const nums = draw.numbers || [];
    if (Array.isArray(nums)) numbers = nums.map(n => String(n).padStart(2, '0')).join(',');

    let drawCode = draw.drawCode || draw.drawNum || '';
    if (drawCode) drawCode = '#' + String(drawCode).padStart(5, '0');

    return {
      game_type: 'keno',
      draw_date: dateStr,
      draw_number: drawCode,
      numbers,
      power_ball: null,
      jackpot: null,
      jackpot2: null,
      prizes: null
    };
  });
}

// Xosothantai fallback
async function fetchKenoXosothantai(dateStr) {
  const url = 'https://xosothantai.mobi/xs-keno.html';
  const html = await httpGet(url, 20000);
  if (!html) return null;

  const [y, m, d] = dateStr.split('-');
  const targetDate = `${d}/${m}/${y}`;
  const results = [];

  const kenoSetRegex = /(?:\bprize\b|\bkeno\b|\bket\s*qua\b)[^<]*((?:\s*\d{1,2}){10,20})/gi;
  const sets = [];
  let m2;
  while ((m2 = kenoSetRegex.exec(html)) !== null) {
    const parts = m2[1].trim().split(/\s+/).filter(p => p.length >= 1 && parseInt(p) <= 80);
    if (parts.length >= 10) sets.push(parts.slice(0, 20).join(','));
  }

  let counter = 0;
  for (const numbers of sets) {
    counter++;
    const code = String(counter).padStart(4, '0');
    results.push({
      game_type: 'keno',
      draw_date: dateStr,
      draw_number: code,
      numbers,
      power_ball: null,
      jackpot: null,
      jackpot2: null,
      prizes: null,
    });
  }

  return results.length > 0 ? results : null;
}

// ─── Điều phối theo game type ──────────────────────────────
async function crawlGame(gameType, dateStr) {
  switch (gameType) {
    case 'mega':     return [await fetchMega(dateStr)].filter(Boolean);
    case 'power':    return [await fetchPower(dateStr)].filter(Boolean);
    case 'max3d':    return [await fetchMax3D(dateStr)].filter(Boolean);
    case 'max3dpro': return [await fetchMax3DPro(dateStr)].filter(Boolean);
    case 'max4d':    return [await fetchMax4D(dateStr)].filter(Boolean);
    case 'keno':     return await fetchKeno(dateStr) || [];
    default:         return [];
  }
}

// ─── Lấy tất cả ngày cần crawl ─────────────────────────────
function getDateRange(from, to) {
  const dates = [];
  let cur = new Date(from + 'T00:00:00+07:00');
  const end  = new Date(to   + 'T00:00:00+07:00');
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Main: crawl tất cả game trong khoảng ngày ─────────────
async function crawl({ games, from, to, db, phpProxyUrl, phpPushSecret, onLog, force = false }) {
  const dates = getDateRange(from, to);
  const logs = [];
  let saved = 0;
  let errors = 0;

  const GAME_MAP = {
    mega:     'mega645',
    power:    'power655',
    max3d:    'max3d',
    max3dpro: 'max3dpro',
  };

  const useProxy = !!(phpProxyUrl && phpPushSecret);

  const SCHEDULE = {
    mega:     [0, 3, 5],     // CN, T4, T6
    power:    [2, 4, 6],     // T3, T5, T7
    max3d:    [1, 3, 5],     // T2, T4, T6
    max3dpro: [2, 4, 6],     // T3, T5, T7
  };

  for (const dateStr of dates) {
    const dObj = new Date(dateStr);
    const dayOfWeek = dObj.getDay();
    const thuStr = dayOfWeek === 0 ? 'CN' : 'T' + (dayOfWeek + 1);

    for (const game of games) {
      if (game === 'lotto13h' || game === 'lotto21h') continue;

      try {
        if (SCHEDULE[game] && !SCHEDULE[game].includes(dayOfWeek)) {
          onLog(`[${game.toUpperCase()}] ⏭  Bỏ qua ${dateStr} (${thuStr} không quay)`);
          continue;
        }

        onLog(`[${game.toUpperCase()}] 🔍 Đang crawl ngày ${dateStr} từ Ketqua.plus...`);
        const records = await crawlGame(game, dateStr);

        if (!records || records.length === 0) {
          onLog(`[${game.toUpperCase()}] ⏭   Không có kết quả ngày ${dateStr} (chưa xổ hoặc ngày nghỉ)`);
          continue;
        }

        for (const r of records) {
          if (!r) continue;
          const gameType = GAME_MAP[game] || game;

          if (useProxy) {
            // ── Mode: gọi PHP proxy ───────────────────────────
            try {
              const payload = {
                type:        'vietlott',
                game_type:   gameType,
                draw_date:   r.draw_date,
                draw_number: r.draw_number || '',
                numbers:     r.numbers,
                power_ball:  r.power_ball || '',
                jackpot:     r.jackpot    || '',
                jackpot2:    r.jackpot2   || '',
                prizes:      r.prizes     || [],
              };

              const res = await fetch(phpProxyUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Bot-Secret': phpPushSecret,
                },
                body: JSON.stringify(payload),
              });

              const text = await res.text();
              let json;
              try {
                json = JSON.parse(text);
              } catch (err) {
                throw new Error(`Invalid JSON from PHP: ${text.substring(0, 100)}...`);
              }

              if (json.ok) {
                saved++;
                onLog(`[${game.toUpperCase()}] ✅ PHP lưu ${r.draw_date} | ${r.draw_number || '?'}`);
              } else {
                errors++;
                onLog(`[${game.toUpperCase()}] ❌ PHP lỗi: ${json.error || '(không có chi tiết)'}`);
              }
            } catch (e) {
              errors++;
              onLog(`[${game.toUpperCase()}] ❌ HTTP lỗi ${r.draw_date}: ${e.message}`);
            }
          } else {
            // ── Mode: ghi trực tiếp MySQL ─────────────────────
            if (force) {
              await db.execute(
                `DELETE FROM vietlott_results WHERE game_type = ? AND draw_date = ?`,
                [gameType, r.draw_date]
              );
            }

            const [result] = await db.execute(
              `INSERT IGNORE INTO vietlott_results
                 (game_type, draw_date, draw_number, numbers, power_ball, jackpot, jackpot2)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [gameType, r.draw_date, r.draw_number, r.numbers, r.power_ball, r.jackpot, r.jackpot2]
            );

            if (result && result.affectedRows > 0) {
              saved++;
              onLog(`[${game.toUpperCase()}] ✅ ${r.draw_date} | ${r.draw_number || '?'} | ${String(r.numbers).slice(0, 20)}... | JP: ${r.jackpot || '-'}`);
            } else {
              onLog(`[${game.toUpperCase()}] ⏭  ${r.draw_date} đã có, bỏ qua`);
            }
          }
        }
      } catch (e) {
        errors++;
        onLog(`[${game.toUpperCase()}] ❌ Lỗi ngày ${dateStr}: ${e.message}`);
      }
    }
  }

  return { saved, errors, logs };
}

module.exports = { crawl, crawlGame, fetchMega, fetchPower, fetchMax3D, fetchMax3DPro, fetchMax4D, fetchKeno };
