/**
 * crawler-vietlott.js — Crawl Vietlott từ ketquaxoso3.com
 *
 * Mỗi hàm fetch trả về object:
 * {
 *   game_type, draw_date, draw_number,
 *   numbers, power_ball,
 *   jackpot, jackpot2,
 *   prizes: { name, count, amount }[]   // full breakdown giải thưởng
 * }
 *
 * Hoặc null nếu không có kết quả (ngày không quay, lỗi network...).
 */

'use strict';
const cheerio = require('cheerio');

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

// ─── Lấy KQXS Vietlott chung từ ketquaxoso3.com ────────────────────────────
async function fetchVietlottGame(gameType, dateStr, urlSlug, maxN, expectedBalls) {
  const [y, m, d] = dateStr.split('-');
  const url = `https://ketquaxoso3.com/${urlSlug}/ngay-${d}-${m}-${y}`;

  const html = await httpGet(url);
  if (!html || html.length < 500) return null;

  const $ = cheerio.load(html);
  const allText = $('body').text().replace(/\s+/g, ' ');

  // 1) Số kỳ quay: "#NNNNN"
  let drawNumber = null;
  $('a').each((_, el) => {
    let txt = $(el).text().trim();
    if (/^#(\d{3,6})/.test(txt)) {
      drawNumber = '#' + txt.match(/^#(\d+)/)[1].padStart(5, '0');
    }
  });
  if (!drawNumber) {
    let match = allText.match(/Kỳ\s*(?:MT|mở\s*thưởng)[^#]*#(\d{3,6})/i);
    if (match) drawNumber = '#' + match[1].padStart(5, '0');
  }

  // 2) Jackpot
  let jackpot = null;
  let jackpot2 = null;

  // Lấy Jackpot qua thẻ bảng thống kê trúng giải (chuẩn xác nhất)
  const tableTrungGiai = $('table.trunggiai');
  if (tableTrungGiai.length > 0) {
    tableTrungGiai.find('tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length >= 4) {
        let label = $(tds[0]).text().toLowerCase().trim();
        let amount = $(tds[3]).text().replace(/[^0-9]/g, '');
        
        if (label === 'j.pot' || label === 'jackpot' || label === 'j.pot 1' || label === 'jackpot 1') {
          if (amount.length > 5) jackpot = amount;
        } else if (label === 'j.pot 2' || label === 'jackpot 2') {
          if (amount.length > 5) jackpot2 = amount;
        }
      }
    });
  }

  // Fallback lấy bằng Regex
  if (!jackpot) {
    let jpMatch = allText.match(/Jackpot[^0-9]*([\d.,]{5,})\s*(?:vn[đd]|đ|\bvnd\b)/i);
    if (!jpMatch) jpMatch = allText.match(/([\d.,]{7,})\s*(?:vn[đd]|đ|\bvnd\b)/i);
    if (jpMatch) jackpot = jpMatch[1].replace(/[^0-9]/g, '');
  }

  // 3) Numbers
  let candidates = [];
  let power_ball = null;

  // Strategy A: Tìm row "Kết quả"
  $('tr').each((_, tr) => {
    if (candidates.length >= expectedBalls) return;
    const tds = $(tr).find('td');
    let firstText = $(tds[0]).text().toLowerCase();
    if (firstText.includes('kết quả') || firstText.includes('ket qua')) {
      let numText = '';
      for (let i = 1; i < tds.length; i++) {
        numText += ' ' + $(tds[i]).text();
      }
      let matches = numText.match(/\b(\d{2})\b/g) || [];
      let valid = matches.map(n => n).filter(n => parseInt(n) >= 1 && parseInt(n) <= maxN);
      if (valid.length >= expectedBalls) {
        candidates = valid.slice(0, expectedBalls + 1);
      }
    }
  });

  // Strategy B: Power 6/55 JP2
  if (gameType === 'power655') {
    $('tr').each((_, tr) => {
      const tds = $(tr).find('td');
      let firstText = $(tds[0]).text().toLowerCase();
      if (firstText.includes('jp2')) {
        let numText = '';
        for (let i = 1; i < tds.length; i++) {
          numText += ' ' + $(tds[i]).text();
        }
        let matches = numText.match(/\b(\d{1,2})\b/g) || [];
        for (let n of matches) {
          let npad = n.padStart(2, '0');
          if (parseInt(n) >= 1 && parseInt(n) <= 55 && !candidates.includes(npad)) {
            power_ball = npad;
            break;
          }
        }
      }
    });

    let j2Match = allText.match(/Jp[oo]t2[^\d]*([\d.,]{5,})/i);
    if (j2Match) jackpot2 = j2Match[1].replace(/[^0-9]/g, '');
  }

  if (candidates.length < expectedBalls) {
    return null;
  }

  let numbers = candidates.slice(0, expectedBalls).join(',');

  return {
    game_type: gameType,
    draw_date: dateStr,
    draw_number: drawNumber,
    numbers,
    power_ball,
    jackpot,
    jackpot2,
    prizes: null,
  };
}

async function fetchMega(dateStr) {
  return await fetchVietlottGame('mega645', dateStr, 'xsmega645', 45, 6);
}

async function fetchPower(dateStr) {
  return await fetchVietlottGame('power655', dateStr, 'xspower655', 55, 6);
}

// ─── Parse Max 3D / Max 3D Pro ────────────────────────────────────
async function fetchVietlottMax(gameType, dateStr, urlSlug) {
  const [y, m, d] = dateStr.split('-');
  const url = `https://ketquaxoso3.com/${urlSlug}/ngay-${d}-${m}-${y}`;

  const html = await httpGet(url);
  if (!html || html.length < 500) return null;

  const $ = cheerio.load(html);
  const allText = $('body').text().replace(/\s+/g, ' ');

  let drawNumber = null;
  $('a').each((_, el) => {
    let txt = $(el).text().trim();
    if (/^#(\d{3,6})/.test(txt)) {
      drawNumber = '#' + txt.match(/^#(\d+)/)[1].padStart(5, '0');
    }
  });
  if (!drawNumber) {
    let match = allText.match(/Kỳ\s*(?:MT|mở\s*thưởng)[^#]*#(\d{3,6})/i);
    if (match) drawNumber = '#' + match[1].padStart(5, '0');
  }

  // Khác với Mega/Power, ở đây ta cần lấy hết table td và scan text theo pattern (3 chữ số)
  let threeDigits = [];
  $('td').each((_, td) => {
    let txt = $(td).text().trim();
    if (/^(\d{3})$/.test(txt)) {
      let n = parseInt(txt);
      if (n >= 0 && n <= 999 && !(n >= 2020 && n <= 2030)) {
        threeDigits.push(txt.padStart(3, '0'));
      }
    }
  });

  if (threeDigits.length < 2) {
    let m = allText.match(/(?<![0-9\/\-])(\d{3})(?![0-9])/g) || [];
    for (let txt of m) {
      let n = parseInt(txt);
      if (n >= 0 && n <= 999 && !(n >= 2020 && n <= 2030)) {
        threeDigits.push(txt.padStart(3, '0'));
      }
    }
    threeDigits = [...new Set(threeDigits)].slice(0, 40);
  }

  if (threeDigits.length < 2) return null;

  let maxPairs = 10;
  let nums = threeDigits.slice(0, maxPairs * 2);
  let pairs = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pairs.push(nums[i] + ',' + nums[i + 1]);
  }

  if (pairs.length === 0) return null;

  return {
    game_type: gameType,
    draw_date: dateStr,
    draw_number: drawNumber,
    numbers: pairs.join('|'),
    power_ball: null,
    jackpot: null,
    jackpot2: null,
    prizes: null,
  };
}

async function fetchMax3D(dateStr) {
  return await fetchVietlottMax('max3d', dateStr, 'xsmax3d');
}

async function fetchMax3DPro(dateStr) {
  return await fetchVietlottMax('max3dpro', dateStr, 'xsmax3dpro');
}

// ─── Parse Keno ──────────────────────────────────────────
/**
 * Nguồn: xosothantai.mobi/xs-keno.html
 * Keno quay nhiều kỳ mỗi ngày (mỗi 5 phút 1 kỳ)
 * Lấy tất cả kỳ của ngày dateStr (YYYY-MM-DD)
 * Lưu: mỗi kỳ 1 dòng, mã kỳ dạng HHMM
 */
async function fetchKeno(dateStr) {
  const url = 'https://xosothantai.mobi/xs-keno.html';
  const html = await httpGet(url, 20000);
  if (!html) return null;

  // Parse ngày
  const [y, m, d] = dateStr.split('-');
  const targetDate = `${d}/${m}/${y}`;

  // Tìm tất cả kỳ trong ngày
  // Pattern: thẻ chứa kỳ quay với số 20 số
  // Mỗi kỳ: 20 số (1-80)
  const results = [];

  // Lấy tất cả các bộ số (20 số/kỳ) trong HTML
  const kenoSetRegex = /(?:\bprize\b|\bkeno\b|\bket\s*qua\b)[^<]*((?:\s*\d{1,2}){10,20})/gi;
  const sets = [];
  let m2;
  while ((m2 = kenoSetRegex.exec(html)) !== null) {
    const parts = m2[1].trim().split(/\s+/).filter(p => p.length >= 1 && parseInt(p) <= 80);
    if (parts.length >= 10) sets.push(parts.slice(0, 20).join(','));
  }

  // Xóa fallback do fallback tự động bắt số linh tinh trên web vào ngày ko có giải 
  // (tránh tạo hàng trăm giải giả làm nghẽn Server / ModSecurity)

  // Mỗi set = 1 kỳ Keno
  const now = new Date();
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

  return results;
}

// ─── Điều phối theo game type ──────────────────────────────
async function crawlGame(gameType, dateStr) {
  switch (gameType) {
    case 'mega':     return [await fetchMega(dateStr)].filter(Boolean);
    case 'power':    return [await fetchPower(dateStr)].filter(Boolean);
    case 'max3d':    return [await fetchMax3D(dateStr)].filter(Boolean);
    case 'max3dpro': return [await fetchMax3DPro(dateStr)].filter(Boolean);
    case 'keno':     return await fetchKeno(dateStr);
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
/**
 * @param {Object} opts
 * @param {string[]} opts.games    — ['mega','power','max3d','max3dpro','keno']
 * @param {string}   opts.from     — 'YYYY-MM-DD'
 * @param {string}   opts.to       — 'YYYY-MM-DD'
 * @param {Object}   opts.db       — mysql2 pool (dùng khi KHÔNG có phpProxy)
 * @param {string}   opts.phpProxyUrl     — URL endpoint crawl-save.php
 * @param {string}   opts.phpPushSecret   — secret để xác thực với PHP
 * @param {Function} opts.onLog    — (msg) => void
 * @param {boolean} opts.force     — xóa rồi cào lại
 * @returns {Promise<{saved: number, errors: number, logs: string[]}>}
 */
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
    keno:     'keno',
  };

  const useProxy = !!(phpProxyUrl && phpPushSecret);

  const SCHEDULE = {
    mega:     [0, 3, 5],     // CN, T4, T6
    power:    [2, 4, 6],     // T3, T5, T7
    max3d:    [1, 3, 5],     // T2, T4, T6
    max3dpro: [2, 4, 6],     // T3, T5, T7
    keno:     [0, 1, 2, 3, 4, 5, 6] // Mọi ngày
  };

  for (const dateStr of dates) {
    const dObj = new Date(dateStr);
    const dayOfWeek = dObj.getDay();
    const thuStr = dayOfWeek === 0 ? 'CN' : 'T' + (dayOfWeek + 1);

    for (const game of games) {
      try {
        if (SCHEDULE[game] && !SCHEDULE[game].includes(dayOfWeek)) {
          onLog(`[${game.toUpperCase()}] ⏭  Bỏ qua ${dateStr} (${thuStr} không quay)`);
          continue;
        }

        onLog(`[${game.toUpperCase()}] 🔍 Đang crawl ngày ${dateStr}...`);
        const records = await crawlGame(game, dateStr);

        if (records.length === 0) {
          onLog(`[${game.toUpperCase()}] ⏭  Không có kết quả ngày ${dateStr} (ngày nghỉ)`);
          continue;
        }

        for (const r of records) {
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
                power_ball: r.power_ball || '',
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

            if (result.affectedRows > 0) {
              saved++;
              onLog(`[${game.toUpperCase()}] ✅ ${r.draw_date} | ${r.draw_number || '?'} | ${r.numbers.slice(0, 20)}... | JP: ${r.jackpot || '-'}`);
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

module.exports = { crawl, crawlGame, fetchMega, fetchPower, fetchMax3D, fetchMax3DPro, fetchKeno };
