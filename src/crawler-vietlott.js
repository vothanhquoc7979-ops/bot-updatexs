/**
 * crawler-vietlott.js — Crawl Vietlott từ kqxs.vn / xskt.com.vn / xosothantai.mobi
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

// ─── Parse Mega 6/45 ────────────────────────────────────────
/**
 * Nguồn: kqxs.vn/xo-so-mega645?date=dd-mm-yyyy
 * HTML chứa: 05 08 23 26 38 41, Jackpot, draw_number
 */
async function fetchMega(dateStr) {
  // dateStr = 'YYYY-MM-DD' → chuyển sang 'DD-MM-YYYY'
  const [y, m, d] = dateStr.split('-');
  const url = `https://www.kqxs.vn/xo-so-mega645?date=${d}-${m}-${y}`;

  const html = await httpGet(url);
  if (!html) return null;

  // 1) Số kỳ quay: #01494
  const drawNumMatch = html.match(/Kỳ\s*quay[^<]*#?(\d+)/i)
    || html.match(/(\d{5,})(?:\s*#|&num;)/)
    || html.match(/#(\d+)/i);
  const drawNumber = drawNumMatch ? '#' + drawNumMatch[1].replace(/\D/g, '').slice(-5) : null;

  // 2) 6 số kết quả: tìm 6 số trong cụm có 6 số 2 chữ số
  // Pattern: số 2 chữ số liền nhau, cách nhau khoảng trắng hoặc <li>
  const numMatch = html.match(/(?:result|numbers|kq)[^>]*>([\d\s<>,\/a-z]+(?:0?[1-9]\d?\s*){5,6})/i)
    || html.match(/(\d{2}(?:\s*[,\/]\s*|\s+)\d{2}(?:\s*[,\/]\s*|\s+)\d{2}(?:\s*[,\/]\s*|\s+)\d{2}(?:\s*[,\/]\s*|\s+)\d{2}(?:\s*[,\/]\s*|\s+)\d{2})/i)
    || html.match(/\b(\d{2}\s+\d{2}\s+\d{2}\s+\d{2}\s+\d{2}\s+\d{2})\b/);

  let numbers = null;
  if (numMatch) {
    const raw = numMatch[1].replace(/[,\/]/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = raw.split(/\s+/).filter(p => p.length === 2);
    if (parts.length === 6) {
      numbers = parts.sort((a, b) => parseInt(a) - parseInt(b)).join(',');
    }
  }

  // Fallback: tìm 6 số riêng lẻ gần nhau trong text
  if (!numbers) {
    const singleNums = [];
    const regex = /\b(\d{2})\b/g;
    let match;
    while ((match = regex.exec(html)) !== null && singleNums.length < 20) {
      const n = parseInt(match[1]);
      if (n >= 1 && n <= 45) singleNums.push(match[1]);
    }
    // Lấy 6 số đầu tiên trong khoảng 1-45
    const filtered = singleNums.filter(n => parseInt(n) >= 1 && parseInt(n) <= 45);
    if (filtered.length >= 6) {
      numbers = filtered.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b)).join(',');
    }
  }

  // 3) Jackpot: "72.718.091.500"
  const jackpotMatch = html.match(/(?:jackpot|giải\s*đặc\s*biệt)[^0-9]*([\d\.]+)/i)
    || html.match(/([\d]{1,3}\.[\d]{3}\.[\d]{3}\.[\d]{3})/);
  const jackpot = jackpotMatch ? jackpotMatch[1].trim() : null;

  if (!numbers) return null;

  return {
    game_type: 'mega645',
    draw_date: dateStr,
    draw_number: drawNumber,
    numbers,
    power_ball: null,
    jackpot,
    jackpot2: null,
    prizes: null,
  };
}

// ─── Parse Power 6/55 ─────────────────────────────────────
/**
 * Nguồn: kqxs.vn/xo-so-power655?date=dd-mm-yyyy
 * HTML chứa: 6 số + số đặc biệt (power ball) + 2 jackpot
 */
async function fetchPower(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const url = `https://www.kqxs.vn/xo-so-power655?date=${d}-${m}-${y}`;

  const html = await httpGet(url);
  if (!html) return null;

  // 1) Số kỳ quay
  const drawNumMatch = html.match(/#(\d+)/i) || html.match(/(\d{5,})/);
  const drawNumber = drawNumMatch ? '#' + drawNumMatch[1].replace(/\D/g, '').slice(-5) : null;

  // 2) 7 số (6 số chính + power ball) — tìm chuỗi có 6-7 số 2 chữ số
  const numMatch = html.match(
    /\b(\d{2}\s+\d{2}\s+\d{2}\s+\d{2}\s+\d{2}\s+\d{2}(?:\s+\d{2})?)\b/
  );
  let numbers = null;
  let power_ball = null;

  if (numMatch) {
    const parts = numMatch[1].trim().split(/\s+/);
    if (parts.length >= 6) {
      numbers = parts.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b)).join(',');
      if (parts.length >= 7) power_ball = parts[6];
    }
  }

  // Fallback: tìm 7 số trong khoảng 1-55
  if (!numbers) {
    const allNums = [];
    const regex = /\b(\d{1,2})\b/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const n = parseInt(match[1]);
      if (n >= 1 && n <= 55) allNums.push(match[1].padStart(2, '0'));
    }
    if (allNums.length >= 6) {
      numbers = allNums.slice(0, 6).sort((a, b) => parseInt(a) - parseInt(b)).join(',');
      if (allNums.length >= 7) power_ball = allNums[6];
    }
  }

  // 3) Jackpot 1 và Jackpot 2
  const jpMatches = html.match(/([\d]{1,3}\.[\d]{3}\.[\d]{3}\.[\d]{3})/g) || [];
  const jackpot = jpMatches[0] || null;
  const jackpot2 = jpMatches[1] || null;

  if (!numbers) return null;

  return {
    game_type: 'power655',
    draw_date: dateStr,
    draw_number: drawNumber,
    numbers,
    power_ball,
    jackpot,
    jackpot2,
    prizes: null,
  };
}

// ─── Parse Max 3D ─────────────────────────────────────────
/**
 * Nguồn: xskt.com.vn/xsmax3d/ngay-dd-mm-yyyy.html
 * HTML: Giải ĐB → "865 063", Giải Nhất → "433 485", v.v.
 * Tất cả giải lưu dạng string, nhiều cặp cách nhau "|"
 */
async function fetchMax3D(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const url = `https://xskt.com.vn/xsmax3d/ngay-${d}-${m}-${y}.html`;

  const html = await httpGet(url);
  if (!html) return null;

  // Tìm số kỳ
  const drawNumMatch = html.match(/#(\d+)/i);
  const drawNumber = drawNumMatch ? '#' + drawNumMatch[1].replace(/\D/g, '').slice(-5) : null;

  // Parse giải: tìm bảng kết quả
  // Pattern: số 3 chữ số trong bảng kết quả Max 3D
  // Giải đặc biệt, nhất, nhì, ba, tư
  function extractNumbers(html, label) {
    const regex = new RegExp(
      label + '[^\\d]*(\\d{3})(?:\\s+(\\d{3}))?(?:\\s+(\\d{3}))?',
      'i'
    );
    const m = html.match(regex);
    if (!m) return null;
    return [m[1], m[2], m[3]].filter(Boolean).join(',');
  }

  // Tìm tất cả số 3 chữ số gần nhau trong bảng kết quả
  const threeDigitNums = [];
  const re = /\b(\d{3})\b/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    threeDigitNums.push(match[1]);
  }

  // Giải ĐB (3 số đầu tiên 3 chữ số trong bảng)
  const prize_db = threeDigitNums[0] ? threeDigitNums[0] : null;

  // Build numbers string: tất cả số cách nhau "|"
  const numbers = threeDigitNums.slice(0, 20).join('|');

  if (!prize_db) return null;

  return {
    game_type: 'max3d',
    draw_date: dateStr,
    draw_number: drawNumber,
    numbers,
    power_ball: null,
    jackpot: null,
    jackpot2: null,
    prizes: null,
  };
}

// ─── Parse Max 3D Pro ─────────────────────────────────────
/**
 * Nguồn: xskt.com.vn/xsmax3dpro/ngay-dd-mm-yyyy.html
 */
async function fetchMax3DPro(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const url = `https://xskt.com.vn/xsmax3dpro/ngay-${d}-${m}-${y}.html`;

  const html = await httpGet(url);
  if (!html) return null;

  const drawNumMatch = html.match(/#(\d+)/i);
  const drawNumber = drawNumMatch ? '#' + drawNumMatch[1].replace(/\D/g, '').slice(-5) : null;

  const threeDigitNums = [];
  const re = /\b(\d{3})\b/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    threeDigitNums.push(match[1]);
  }

  const prize_db = threeDigitNums[0] ? threeDigitNums[0] : null;
  const numbers = threeDigitNums.slice(0, 20).join('|');

  if (!prize_db) return null;

  return {
    game_type: 'max3dpro',
    draw_date: dateStr,
    draw_number: drawNumber,
    numbers,
    power_ball: null,
    jackpot: null,
    jackpot2: null,
    prizes: null,
  };
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

  // Fallback: tìm bất kỳ chuỗi nào có 10-20 số trong khoảng 1-80
  if (sets.length === 0) {
    const allNums = [];
    const re = /\b(\d{1,2})\b/g;
    while ((match = re.exec(html)) !== null) {
      const n = parseInt(match[1]);
      if (n >= 1 && n <= 80) allNums.push(n);
    }
    // Nhóm thành từng bộ 20
    for (let i = 0; i + 20 <= allNums.length; i += 20) {
      const set = allNums.slice(i, i + 20).map(n => String(n).padStart(2, '0')).join(',');
      sets.push(set);
    }
  }

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

  for (const dateStr of dates) {
    for (const game of games) {
      try {
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

            const json = await res.json();
            if (json.ok) {
              saved++;
              onLog(`[${game.toUpperCase()}] ✅ PHP lưu ${r.draw_date} | ${r.draw_number || '?'}`);
            } else {
              errors++;
              onLog(`[${game.toUpperCase()}] ❌ PHP lỗi: ${json.error}`);
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
