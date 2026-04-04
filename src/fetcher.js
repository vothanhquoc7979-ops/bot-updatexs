/**
 * fetcher.js — Gọi API kqxs.tube và parse kết quả
 *
 * Format API (đã phân tích):
 *
 * MB:
 *   MB|timestamp|flag|1:G1|2:G2a-G2b|3:...|4:...|5:...|6:...|MaDb:...|7:...|DB:dacbiet|
 *   flag = 1 → đã xổ xong
 *
 * MN/MT:
 *   TINH1-TINH2|timestamp~TINH1|flag1|flag2|1:G1|2:G2|3:...|4:...|5:G5|6:...|7:G7|8:G8|DB:dacbiet|~TINH2|...
 *   flag2 = 1 → tỉnh đó đã xổ xong
 */
'use strict';

const { API, PROVINCE_MAP } = require('./config');

// ─── HTTP fetch với timeout ─────────────────────────────────
async function httpGet(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Parse chuỗi giải thưởng "G1:12345-67890" → "12345,67890" ─
function parseNumbers(str) {
  if (!str) return null;
  return str.split('-').join(',');
}

// ─── Parse Miền Bắc ────────────────────────────────────────
function parseMB(raw) {
  // MB|timestamp|doneFlag|1:G1|2:G2a-G2b|3:...|4:...|5:...|6:...|MaDb:...|7:...|DB:dacbiet|
  const parts = raw.split('|');
  // parts[0] = 'MB', parts[1] = timestamp, parts[2] = doneFlag
  const doneFlag = parts[2] === '1';

  const prizes = {};
  for (let i = 3; i < parts.length; i++) {
    const seg = parts[i];
    if (!seg || seg === '') continue;
    const colon = seg.indexOf(':');
    if (colon < 0) continue;
    const key = seg.substring(0, colon).trim().toUpperCase();
    const val = seg.substring(colon + 1).trim();

    switch (key) {
      case 'DB':  prizes.prize_db = val; break;
      case '1':   prizes.prize_1  = parseNumbers(val); break;
      case '2':   prizes.prize_2  = parseNumbers(val); break;
      case '3':   prizes.prize_3  = parseNumbers(val); break;
      case '4':   prizes.prize_4  = parseNumbers(val); break;
      case '5':   prizes.prize_5  = parseNumbers(val); break;
      case '6':   prizes.prize_6  = parseNumbers(val); break;
      case '7':   prizes.prize_7  = parseNumbers(val); break;
      // MaDb (mã đặc biệt) → bỏ qua
    }
  }

  return [{
    province: 'Hà Nội',
    region:   'mb',
    done:     doneFlag,
    prizes,
  }];
}

// ─── Parse Miền Nam / Miền Trung ────────────────────────────
function parseMNMT(raw, region) {
  // Format: TINH1-TINH2|timestamp~TINH1|flag1|flag2|1:G1|...|DB:xxx|~TINH2|...
  // Tách phần header (tên tỉnh + timestamp) và từng section tỉnh
  const firstTilde = raw.indexOf('~');
  if (firstTilde < 0) return [];

  const sections = raw.substring(firstTilde + 1).split('~');
  const results = [];

  for (const section of sections) {
    if (!section.trim()) continue;
    const parts = section.split('|');
    if (parts.length < 3) continue;

    const provinceCode = parts[0].trim();
    // flag1 = parts[1], flag2 = parts[2] (1 = xổ xong)
    const done = parts[2] === '1';

    const provinceName = PROVINCE_MAP[provinceCode] || provinceCode;

    const prizes = {};
    for (let i = 3; i < parts.length; i++) {
      const seg = parts[i];
      if (!seg || seg === '') continue;
      const colon = seg.indexOf(':');
      if (colon < 0) continue;
      const key = seg.substring(0, colon).trim().toUpperCase();
      const val = seg.substring(colon + 1).trim();

      switch (key) {
        case 'DB': prizes.prize_db = val; break;
        case '1':  prizes.prize_1  = parseNumbers(val); break;
        case '2':  prizes.prize_2  = parseNumbers(val); break;
        case '3':  prizes.prize_3  = parseNumbers(val); break;
        case '4':  prizes.prize_4  = parseNumbers(val); break;
        case '5':  prizes.prize_5  = parseNumbers(val); break;
        case '6':  prizes.prize_6  = parseNumbers(val); break;
        case '7':  prizes.prize_7  = parseNumbers(val); break;
        case '8':  prizes.prize_8  = parseNumbers(val); break;
      }
    }

    if (Object.keys(prizes).length === 0) continue;

    results.push({
      province: provinceName,
      region,
      done,
      prizes,
    });
  }

  return results;
}

// ─── Public: fetch và parse 1 region ───────────────────────
async function fetchRegion(region) {
  let url = API[region];
  if (!url) throw new Error(`Unknown region: ${region}`);
  
  // Thêm tham số timestamp để báo Cập Nhật Mới theo format API mới
  url = `${url}?t=${Date.now()}`;

  const raw = await httpGet(url);
  if (!raw || raw.trim() === '') return null;

  const text = raw.trim();

  if (region === 'mb') {
    return parseMB(text);
  } else {
    return parseMNMT(text, region);
  }
}

// ─── Kiểm tra xem region đã xổ xong chưa ─────────────────
function isRegionComplete(results) {
  if (!results || results.length === 0) return false;
  return results.every(r => r.done === true);
}

module.exports = { fetchRegion, isRegionComplete };
