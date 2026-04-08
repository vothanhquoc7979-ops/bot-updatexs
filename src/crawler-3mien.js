/**
 * crawler-3mien.js — Crawl XSMN, XSMT, XSMB từ xskt.com.vn
 *
 * Logic y hệt crawler/crawl.php PHP,
 * port sang Node.js để chạy trong Bot UI.
 *
 * 2 chế độ:
 *  - crawlRss()   : nhanh, dùng RSS feed — chỉ crawl hôm nay
 *  - crawlByDate(): chậm, parse HTML xskt.com.vn — crawl theo khoảng ngày
 */
'use strict';

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

// ─── Parse HTML XSMB (xskt.com.vn/xsmb/ngay-dd-mm-yyyy.html) ──
function parseHtmlMb(html, dateStr) {
  const prizeMap = [
    { labels: ['đặc biệt', 'đb', 'db'], col: 'prize_db' },
    { labels: ['nhất', 'giải nhất'],     col: 'prize_1' },
    { labels: ['nhì', 'giải nhì'],        col: 'prize_2' },
    { labels: ['ba', 'giải ba'],          col: 'prize_3' },
    { labels: ['tư', 'giải tư'],          col: 'prize_4' },
    { labels: ['năm', 'giải năm'],        col: 'prize_5' },
    { labels: ['sáu', 'giải sáu'],        col: 'prize_6' },
    { labels: ['bảy', 'giải bảy'],        col: 'prize_7' },
  ];

  const prizes = {};

  // Tìm tất cả table row
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const tr = match[1];
    const cells = tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
    if (cells.length < 2) continue;

    const cellTexts = cells.map(c =>
      c.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    );
    const label = cellTexts[0].toLowerCase();
    const nums  = cellTexts.slice(1).join(',').replace(/[^0-9,]/g, '').replace(/,+/g, ',').replace(/^,|,$/g, '');

    for (const { labels, col } of prizeMap) {
      if (labels.some(l => label.includes(l)) && nums) {
        prizes[col] = nums;
        break;
      }
    }
  }

  if (!prizes.prize_db) return null;
  return { province: 'Hà Nội', region: 'mb', draw_date: dateStr, ...prizes };
}

// ─── Parse HTML XSMN / XSMT ──────────────────────────────
function parseHtmlMnMt(html, dateStr, region) {
  // Tìm các block tỉnh: class chứa "xs-tinh", "xstinh", "box-kqxs"
  const blockRegex = /<(?:div|section|article)[^>]*class="[^"]*(?:xs.?tinh|xstinh|box.?kqxs)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/gi;
  const results = [];
  let blockMatch;

  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];

    // Tên tỉnh: trong h2, h3 hoặc thẻ class chứa "tinh-name"
    const nameMatch = block.match(/<(?:h[23]|span|div)[^>]*class="[^"]*(?:tinh.?name|name.?tinh)[^"]*"[^>]*>([\s\S]*?)<\/(?:h[23]|span|div)>/i)
      || block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    const province = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    if (!province) continue;

    const prizes = {};

    // Parse bảng trong block
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(block)) !== null) {
      const tr = rowMatch[1];
      const cells = tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      if (cells.length < 2) continue;

      const cellTexts = cells.map(c =>
        c.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      );
      const label = cellTexts[0].toLowerCase();
      const nums  = cellTexts.slice(1).join(',').replace(/[^0-9,]/g, '').replace(/,+/g, ',').replace(/^,|,$/g, '');

      const maps = [
        { labels: ['đặc', 'đb'], col: 'prize_db' },
        { labels: ['nhất'],       col: 'prize_1' },
        { labels: ['nhì'],         col: 'prize_2' },
        { labels: ['ba'],          col: 'prize_3' },
        { labels: ['tư'],          col: 'prize_4' },
        { labels: ['năm'],         col: 'prize_5' },
        { labels: ['sáu'],         col: 'prize_6' },
        { labels: ['bảy'],         col: 'prize_7' },
        { labels: ['tám'],         col: 'prize_8' },
      ];

      for (const { labels, col } of maps) {
        if (labels.some(l => label.includes(l)) && nums) {
          prizes[col] = nums;
          break;
        }
      }
    }

    if (prizes.prize_db) {
      results.push({ province, region, draw_date: dateStr, ...prizes });
    }
  }

  return results;
}

// ─── Crawl theo ngày (HTML — lịch sử) ─────────────────────
async function crawlByDate(region, dateStr, onLog) {
  const [y, m, d] = dateStr.split('-');
  const slugs = { mb: 'xsmb', mn: 'xsmn', mt: 'xsmt' };
  const slug = slugs[region];
  if (!slug) return [];

  const url = `https://xskt.com.vn/${slug}/ngay-${d}-${m}-${y}.html`;
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

          const json = await res.json();
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
