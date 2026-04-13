/**
 * crawler-3mien.js — Crawl XSMN, XSMT, XSMB từ Github API
 *
 * Refactored to fetch from shared JSON API
 */
'use strict';
const { fetchJsonApi } = require('./api-client');

const PRIZE_MAP = {
  'DB': 'prize_db', 'G1': 'prize_1', 'G2': 'prize_2', 'G3': 'prize_3',
  'G4': 'prize_4', 'G5': 'prize_5', 'G6': 'prize_6', 'G7': 'prize_7', 'G8': 'prize_8',
};

async function crawlRss(region, onLog) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  onLog(`📡 [${region.toUpperCase()}] Chuyển hướng crawl RSS sang JSON API cho ngày ${today}...`);
  const data = await crawlByDate(region, today, onLog);
  return data ? data.length : 0;
}

async function crawlByDate(region, dateStr, onLog) {
  const json = await fetchJsonApi(dateStr);
  if (!json || !json.xs) {
    onLog(`⚠️ [${region.toUpperCase()}] Không lấy được JSON ngày ${dateStr}`);
    return [];
  }

  const regionKeyMap = { mb: 'bac', mn: 'nam', mt: 'trung' };
  const dataKey = regionKeyMap[region];
  const items = json.xs[dataKey] || [];
  
  if (items.length === 0) return [];

  const results = [];
  for (const item of items) {
    let province = item.province;
    // Chuẩn hóa tên tỉnh nếu MB
    if (region === 'mb') province = 'Hà Nội';

    const obj = { province, region, draw_date: dateStr };
    if (item.prizes) {
      for (const p of item.prizes) {
        const pKey = PRIZE_MAP[p.prizeKey];
        if (pKey && p.numbers && p.numbers.length > 0) {
          obj[pKey] = p.numbers.join(',');
        }
      }
    }
    
    if (obj.prize_db) {
       results.push(obj);
       onLog(`✅ [${region.toUpperCase()}] ${dateStr} [${obj.province}] ĐB=${obj.prize_db}`);
    }
  }
  return results;
}

// ─── Get date range ──────────────────────────────────────
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

// ─── Main ────────────────────────────────────────────────
/**
 * @param {Object} opts
 * @param {string[]} opts.regions — ['mb','mn','mt']
 * @param {string}   opts.from
 * @param {string}   opts.to
 * @param {Object}   opts.db     — mysql2 pool (dùng khi KHÔNG có phpProxy)
 * @param {string}   opts.phpProxyUrl — URL endpoint crawl-save.php (dùng thay db)
 * @param {string}   opts.phpPushSecret — secret để xác thực với PHP
 * @param {Function} opts.onLog
 * @returns {Promise<{saved:number, errors:number, logs:string[]}>}
 */
async function crawl({ regions, from, to, db, phpProxyUrl, phpPushSecret, onLog }) {
  const dates = getDateRange(from, to);
  let saved = 0;
  let errors = 0;

  const useProxy = !!(phpProxyUrl && phpPushSecret);

  if (useProxy) {
    // ── Mode: gọi PHP proxy (Hostinger ghi DB) ─────────────
    for (const dateStr of dates) {
      for (const region of regions) {
        try {
          const records = await crawlByDate(region, dateStr, onLog);
          if (records.length === 0) {
            onLog(`⚠️ [${region.toUpperCase()}] ${dateStr} — không có dữ liệu`);
            continue;
          }

          // Gửi batch theo từng ngày+miền
          const payload = {
            type: '3mien',
            region,
            draw_date: dateStr,
            results: records.map(r => ({
              province:  r.province,
              prize_db:  r.prize_db  || '',
              prize_1:   r.prize_1   || '',
              prize_2:   r.prize_2   || '',
              prize_3:   r.prize_3   || '',
              prize_4:   r.prize_4   || '',
              prize_5:   r.prize_5   || '',
              prize_6:   r.prize_6   || '',
              prize_7:   r.prize_7   || '',
              prize_8:   r.prize_8   || '',
            })),
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
            saved += json.saved || records.length;
            onLog(`✅ [${region.toUpperCase()}] ${dateStr} — PHP lưu ${json.saved} tỉnh`);
          } else {
            errors++;
            onLog(`❌ [${region.toUpperCase()}] ${dateStr} — PHP lỗi: ${json.error || '?'}`);
          }
        } catch (e) {
          errors++;
          onLog(`❌ [${region.toUpperCase()}] ${dateStr} — HTTP/Fetch lỗi: ${e.message}`);
        }
      }
    }
  } else {
    // ── Mode: ghi trực tiếp MySQL (db pool) ─────────────────
    for (const dateStr of dates) {
      for (const region of regions) {
        try {
          const records = await crawlByDate(region, dateStr, onLog);
          for (const r of records) {
            const [result] = await db.execute(
              `INSERT IGNORE INTO lottery_results
                 (region, province, draw_date, prize_db, prize_1, prize_2, prize_3, prize_4, prize_5, prize_6, prize_7, prize_8)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [r.region, r.province, r.draw_date, r.prize_db || null,
               r.prize_1 || null, r.prize_2 || null, r.prize_3 || null,
               r.prize_4 || null, r.prize_5 || null, r.prize_6 || null,
               r.prize_7 || null, r.prize_8 || null]
            );
            if (result.affectedRows > 0) saved++;
          }
        } catch (e) {
          errors++;
          onLog(`❌ [${region.toUpperCase()}] Lỗi ngày ${dateStr}: ${e.message}`);
        }
      }
    }
  }

  return { saved, errors };
}

module.exports = { crawl, crawlByDate, crawlRss };
