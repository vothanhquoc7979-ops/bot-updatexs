/**
 * crawler-vietlott.js — Crawl Vietlott từ Github API
 *
 * Refactored to fetch from shared JSON API
 */
'use strict';
const { fetchJsonApi } = require('./api-client');

function formatNumbers(gameType, nums) {
  if (!nums) return '';
  const pad = n => String(n).padStart(2, '0');
  let numbers = '';
  
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
  return numbers.replace(/\|+$/, '').replace(/(^\|+|\|+$)/g, '');
}

async function crawlGame(gameType, dateStr) {
  const json = await fetchJsonApi(dateStr);
  if (!json || !json.vietlott) return [];

  const GAME_MAP = {
    mega:     'mega645',
    power:    'power655',
    max3d:    'max3d',
    max3dpro: 'max3dpro',
    max4d:    'max4d'
  };
  
  const vGameKey = GAME_MAP[gameType] || gameType;
  const draw = json.vietlott[vGameKey];
  if (!draw) return []; // no draw or null

  // API could return array (e.g. lotto 535) or a single object.
  const drawsArr = Array.isArray(draw) ? draw : [draw];
  
  const results = [];
  for (const d of drawsArr) {
    if (!d || !d.numbers) continue;

    let drawNumber = d.drawCode || d.drawNum || '';
    if (drawNumber && !String(drawNumber).startsWith('#')) drawNumber = '#' + String(drawNumber).padStart(5, '0');

    const pad = n => String(n).padStart(2, '0');
    let jackpot1 = typeof d.jackpot1 !== 'undefined' && d.jackpot1 !== null ? String(d.jackpot1).replace(/\D/g, '') : null;
    let jackpot2 = typeof d.jackpot2 !== 'undefined' && d.jackpot2 !== null ? String(d.jackpot2).replace(/\D/g, '') : null;
    // Fallback if jackpot field exists instead of jackpot1
    if (!jackpot1 && d.jackpot) jackpot1 = String(d.jackpot).replace(/\D/g, '');

    results.push({
      game_type: vGameKey,
      draw_date: dateStr,
      draw_number: drawNumber,
      numbers: formatNumbers(vGameKey, d.numbers),
      power_ball: d.specialNum ? pad(d.specialNum) : null,
      jackpot: jackpot1,
      jackpot2: jackpot2,
      prizes: d.winnersData || d.prizes || null
    });
  }

  return results;
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
    max4d:    'max4d'
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

        onLog(`[${game.toUpperCase()}] 🔍 Đang crawl ngày ${dateStr} từ JSON API...`);
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

// Cung cấp dummy functions cho các file export cũ lỡ UI gọi
async function fetchMega(dateStr) { return await crawlGame('mega', dateStr); }
async function fetchPower(dateStr) { return await crawlGame('power', dateStr); }
async function fetchMax3D(dateStr) { return await crawlGame('max3d', dateStr); }
async function fetchMax3DPro(dateStr) { return await crawlGame('max3dpro', dateStr); }
async function fetchMax4D(dateStr) { return await crawlGame('max4d', dateStr); }
async function fetchKeno(dateStr) { return await crawlGame('keno', dateStr); }

module.exports = { crawl, crawlGame, fetchMega, fetchPower, fetchMax3D, fetchMax3DPro, fetchMax4D, fetchKeno };
