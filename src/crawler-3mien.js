/**
 * crawler-3mien.js — Crawl XSMN, XSMT, XSMB từ ketquaxoso3.com
 *
 * Logic y hệt crawler/crawl_history.php PHP,
 * port sang Node.js để chạy trong Bot UI.
 *
 * 2 chế độ:
 *  - crawlRss()   : nhanh, dùng RSS feed — chỉ crawl hôm nay
 *  - crawlByDate(): chậm, parse HTML ketquaxoso3.com — crawl theo khoảng ngày
 */
'use strict';
const cheerio = require('cheerio');

// ─── HTTP helper ──────────────────────────────────────────
async function httpGet(url, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

// ─── Parse Miền Bắc description từ RSS ───────────────────
function parseMbDesc(desc) {
  const prizes = {};
  const lines = desc.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    const dbMatch = line.match(/^ĐB:\s*(.+)/iu);
    if (dbMatch) { prizes.prize_db = dbMatch[1].trim(); continue; }
    const prizeMatch = line.match(/^([1-7]):\s*(.+)/);
    if (prizeMatch) {
      const idx = parseInt(prizeMatch[1]);
      prizes[`prize_${idx}`] = prizeMatch[2].trim().split(/\s*-\s*/).join(',');
    }
  }
  return prizes;
}

// ─── Parse MN / MT description từ RSS ─────────────────────
function parseMnMtDesc(desc, region) {
  const results = [];
  // Split by [Province Name] markers
  const parts = desc.split(/\[([^\]]+)\]/);
  for (let i = 1; i < parts.length; i += 2) {
    const province = parts[i].trim();
    const block    = (parts[i + 1] || '').trim();
    if (!province || !block) continue;

    const prizes = {};
    const lines = block.split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const dbMatch = line.match(/^ĐB:\s*(.+)/iu);
      if (dbMatch) { prizes.prize_db = dbMatch[1].trim(); continue; }

      const prizeMatch = line.match(/^([1-6]):\s*(.+)/);
      if (prizeMatch) {
        const idx = parseInt(prizeMatch[1]);
        prizes[`prize_${idx}`] = prizeMatch[2].trim().split(/\s*-\s*/).join(',');
        continue;
      }

      const g7Match = line.match(/^7:\s*(.+)/);
      if (g7Match) {
        const rest = g7Match[1].trim();
        const colonIdx = rest.indexOf(':');
        if (colonIdx !== -1) {
          prizes.prize_7 = rest.substring(0, colonIdx).trim();
          prizes.prize_8 = rest.substring(colonIdx + 1).trim();
        } else {
          prizes.prize_7 = rest;
        }
        continue;
      }

      const g8Match = line.match(/^8:\s*(.+)/);
      if (g8Match) { prizes.prize_8 = g8Match[1].trim(); }
    }

    if (prizes.prize_db) {
      results.push({ province, region, ...prizes });
    }
  }
  return results;
}

// ─── Extract date từ RSS title ─────────────────────────────
function extractDateFromTitle(title) {
  const m = title.match(/NGÀY\s+(\d{1,2})\/(\d{1,2})/ui);
  if (!m) return null;
  const d  = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  const y  = new Date().getFullYear();
  return `${y}-${mo}-${d}`;
}

// ─── Crawl RSS (nhanh — hôm nay) ──────────────────────────
async function crawlRss(region, onLog) {
  const RSS = {
    mb: 'https://xskt.com.vn/rss-feed/mien-bac-xsmb.rss',
    mn: 'https://xskt.com.vn/rss-feed/mien-nam-xsmn.rss',
    mt: 'https://xskt.com.vn/rss-feed/mien-trung-xsmt.rss',
  };

  const url = RSS[region];
  if (!url) return 0;

  onLog(`📡 [${region.toUpperCase()}] Đang tải RSS...`);
  const xml = await httpGet(url);
  if (!xml || xml.length < 100) {
    onLog(`❌ [${region.toUpperCase()}] Không tải được RSS!`);
    return 0;
  }

  // Parse XML với regex (đơn giản, không cần parser nặng)
  const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
  if (items.length === 0) {
    onLog(`⚠️ [${region.toUpperCase()}] Không tìm thấy item nào trong RSS`);
    return 0;
  }

  let saved = 0;
  const seen = new Set();

  for (const item of items) {
    const title = (item.match(/<title>([\s\S]*?)<\/title>/i) || ['', ''])[1]
      .replace(/<!\[CDATA\[|\]\]>/gi, '').trim();
    const desc  = (item.match(/<description>([\s\S]*?)<\/description>/i) || ['', ''])[1]
      .replace(/<!\[CDATA\[|\]\]>/gi, '').trim();

    const date = extractDateFromTitle(title);
    if (!date) continue;
    if (seen.has(date + region)) continue;
    seen.add(date + region);

    const key = `${region}|${date}`;
    if (region === 'mb') {
      const prizes = parseMbDesc(desc);
      if (!prizes.prize_db) continue;
      onLog(`✅ [${region.toUpperCase()}] ${date} ĐB=${prizes.prize_db}`);
      saved++;
    } else {
      const rows = parseMnMtDesc(desc, region);
      for (const r of rows) {
        onLog(`✅ [${region.toUpperCase()}] ${date} [${r.province}] ĐB=${r.prize_db}`);
        saved++;
      }
    }
  }

  return saved;
}

// ─── Parse HTML XSMB (ketquaxoso3.com/xsmb/ngay-d-m-yyyy) ──
function parseHtmlMb(html, dateStr) {
  const $ = cheerio.load(html);
  const table = $('table.result').first();
  if (!table.length) return null;

  const prizeMap = {
    'giải đb': 'prize_db', 'đb': 'prize_db',
    'giải nhất': 'prize_1', 'g1': 'prize_1',
    'giải nhì': 'prize_2', 'g2': 'prize_2',
    'giải ba': 'prize_3', 'g3': 'prize_3',
    'giải tư': 'prize_4', 'g4': 'prize_4',
    'giải năm': 'prize_5', 'g5': 'prize_5',
    'giải sáu': 'prize_6', 'g6': 'prize_6',
    'giải bảy': 'prize_7', 'g7': 'prize_7',
  };

  const prizes = {};
  table.find('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 2) return;

    let label = ($(tds[0]).attr('title') || $(tds[0]).text()).trim().toLowerCase();
    
    let prizeKey = null;
    for (const [k, v] of Object.entries(prizeMap)) {
      if (label === k || label.includes(k)) { prizeKey = v; break; }
    }
    if (!prizeKey) return;

    const numCell = $(tds[1]);
    let textPieces = [];
    numCell.contents().each((_, el) => {
      let t = $(el).text().trim();
      if (t) textPieces.push(t);
    });

    let rawText = textPieces.join(' ');
    let nums = rawText.replace(/[^0-9 ]/g, ' ').replace(/\s+/g, ',').trim();
    if (nums.startsWith(',')) nums = nums.slice(1);
    if (nums.endsWith(',')) nums = nums.slice(0, -1);

    const expectedDigits = {
      'prize_db': 5, 'prize_1': 5, 'prize_2': 5,
      'prize_3': 5, 'prize_4': 4, 'prize_5': 4,
      'prize_6': 3, 'prize_7': 2,
    };

    if (nums && expectedDigits[prizeKey]) {
      const d = expectedDigits[prizeKey];
      let parts = nums.split(',');
      let fixed = [];
      for (let part of parts) {
        if (part.length > d && part.length % d === 0) {
          for (let i = 0; i < part.length; i += d) {
            fixed.push(part.substring(i, i + d));
          }
        } else {
          fixed.push(part);
        }
      }
      nums = fixed.join(',');
    }

    if (nums) prizes[prizeKey] = nums;
  });

  if (!prizes.prize_db) return null;
  return { province: 'Hà Nội', region: 'mb', draw_date: dateStr, ...prizes };
}

// ─── Parse HTML XSMN / XSMT ──────────────────────────────
function parseHtmlMnMt(html, dateStr, region) {
  const $ = cheerio.load(html);
  const tables = $('table[class*="tbl-xsmn"], table[class*="tbl-xsmt"]');
  const results = [];

  tables.each((_, table) => {
    const rows = $(table).find('tr');
    if (rows.length === 0) return;

    const firstRow = $(rows[0]);
    let headerCells = firstRow.find('td');
    if (headerCells.length === 0) headerCells = firstRow.find('th');

    const provinces = [];
    for (let ci = 1; ci < headerCells.length; ci++) {
      provinces.push($(headerCells[ci]).text().trim());
    }
    if (provinces.length === 0) return;

    const prizesPerProvince = Array(provinces.length).fill().map(() => ({}));

    const titleMap = {
      'đb': 'prize_db', 'giải đb': 'prize_db',
      'g.1': 'prize_1', 'giải nhất': 'prize_1',
      'g.2': 'prize_2', 'giải nhì': 'prize_2',
      'g.3': 'prize_3', 'giải ba': 'prize_3',
      'g.4': 'prize_4', 'giải tư': 'prize_4',
      'g.5': 'prize_5', 'giải năm': 'prize_5',
      'g.6': 'prize_6', 'giải sáu': 'prize_6',
      'g.7': 'prize_7', 'giải bảy': 'prize_7',
      'g.8': 'prize_8', 'giải tám': 'prize_8',
    };

    for (let ri = 1; ri < rows.length; ri++) {
      const cells = $(rows[ri]).find('td');
      if (cells.length < 2) continue;

      let label = ($(cells[0]).attr('title') || $(cells[0]).text()).trim().toLowerCase();
      let prizeKey = null;
      for (const [k, v] of Object.entries(titleMap)) {
        if (label === k || label.includes(k)) { prizeKey = v; break; }
      }
      if (!prizeKey) continue;

      for (let ci = 1; ci < cells.length; ci++) {
        let pi = ci - 1;
        if (pi >= provinces.length) break;

        let cell = $(cells[ci]);
        let innerHtml = '';
        cell.contents().each((_, node) => {
           if (node.type === 'text') {
             let t = $(node).text().trim();
             if (t) innerHtml += t + ' ';
           } else if (node.name === 'br') {
             innerHtml += ' ';
           } else {
             let t = $(node).text().trim();
             if (t) innerHtml += t + ' ';
           }
        });

        let nums = innerHtml.replace(/[^0-9 ]/g, ' ').trim();
        let parts = nums.split(' ').filter(n => /^\\d{2,}$/.test(n.trim())).map(n => n.trim());
        if (parts.length > 0) {
          prizesPerProvince[pi][prizeKey] = parts.join(',');
        }
      }
    }

    provinces.forEach((province, pi) => {
      const prizes = prizesPerProvince[pi];
      if (prizes.prize_db && province) {
        results.push({ province, region, draw_date: dateStr, ...prizes });
      }
    });
  });

  return results;
}

// ─── Crawl theo ngày (HTML — lịch sử) ─────────────────────
async function crawlByDate(region, dateStr, onLog) {
  const [y, mm, dd] = dateStr.split('-');
  const d = parseInt(dd, 10);
  const m = parseInt(mm, 10);
  
  const slugs = { mb: 'xsmb', mn: 'xsmn', mt: 'xsmt' };
  const slug = slugs[region];
  if (!slug) return [];

  const url = `https://ketquaxoso3.com/${slug}/ngay-${d}-${m}-${y}`;
  const html = await httpGet(url);
  if (!html || html.length < 500) {
    onLog(`⚠️ [${region.toUpperCase()}] Không lấy được HTML ngày ${dateStr}`);
    return [];
  }

  await new Promise(r => setTimeout(r, 1000)); // polite delay

  if (region === 'mb') {
    const result = parseHtmlMb(html, dateStr);
    if (result) {
      onLog(`✅ [MB] ${dateStr} [${result.province}] ĐB=${result.prize_db}`);
      return [result];
    }
  } else {
    const results = parseHtmlMnMt(html, dateStr, region);
    for (const r of results) {
      onLog(`✅ [${region.toUpperCase()}] ${dateStr} [${r.province}] ĐB=${r.prize_db}`);
    }
    return results;
  }
  return [];
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
