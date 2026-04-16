/**
 * content-publisher.js — Lấy danh mục, gen content per-site, publish lên PHP
 */
'use strict';

const storage = require('./storage');

// ── Danh mục cố định (khớp với post-edit.php admin) ─────────────────────────
const STATIC_CATEGORIES = [
  { id: 'tin-tuc',        name: 'Tin Tức Xổ Số' },
  { id: 'du-doan-xsmb',   name: 'Dự Đoán XSMB' },
  { id: 'du-doan-xsmn',   name: 'Dự Đoán XSMN' },
  { id: 'du-doan-xsmt',   name: 'Dự Đoán XSMT' },
  { id: 'so-mo',          name: 'Sổ Mơ / Giải Mã'  },
  { id: 'soi-cau',        name: 'Soi Cầu Lô Đề'    },
  { id: 'thong-ke',       name: 'Thống Kê'          },
  { id: 'kinh-nghiem',    name: 'Kinh Nghiệm'       },
];

const CATEGORY_PREFIXES = {
  'so-mo'        : '/so-mo/bai-viet/',
  'du-doan-xsmb' : '/du-doan/bai-viet/',
  'du-doan-xsmn' : '/du-doan/bai-viet/',
  'du-doan-xsmt' : '/du-doan/bai-viet/',
  'soi-cau'      : '/du-doan/bai-viet/',
};
function getArticlePrefix(cat) {
  return CATEGORY_PREFIXES[cat] || '/tin-tuc/bai-viet/';
}

// ── Lấy danh mục từ site (thử API, fallback về static list) ─────────────────
async function fetchCategories(site) {
  try {
    const url  = `${site.domain.replace(/\/$/, '')}/api/bot/categories.php`;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 6000);
    const res  = await fetch(url, {
      signal : ctrl.signal,
      headers: { 'X-Bot-Secret': site.secret },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        return data.categories; // [{ id, name }]
      }
    }
  } catch (_) {}
  return STATIC_CATEGORIES; // fallback
}

// ── Extract ảnh từ HTML đã parse (cheerio) ───────────────────────────────────
function extractImages(html) {
  const urls = [];
  const re   = /(<img[^>]+src=["'])([^"']+)(["'])/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[2].trim();
    if (src.startsWith('http') && !src.includes('pixel') && !src.includes('tracker')) {
      urls.push(src);
    }
  }
  return [...new Set(urls)]; // dedup
}

// ── Tải ảnh dưới dạng base64 ────────────────────────────────────────────────
async function fetchImageBase64(url) {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res   = await fetch(url, {
      signal : ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': url },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!ct.startsWith('image/')) return null;
    const buf    = Buffer.from(await res.arrayBuffer());
    const ext    = ct.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    return { base64: buf.toString('base64'), contentType: ct, ext, url };
  } catch (_) { return null; }
}

// ── Validate từng URL ảnh trước khi publish ───────────────────────────
// HEAD request → kiểm tra status 200 + Content-Type là image/*
// Chằn link chết / 403 / HTML error pages trước khi gửi sang PHP
async function validateImageUrls(urls) {
  if (!urls || urls.length === 0) return [];
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(url, {
          method : 'HEAD',
          signal : ctrl.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)', 'Accept': 'image/*' },
        });
        clearTimeout(timer);
        const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
        if (res.ok && ct.startsWith('image/')) return url;
        // Một số server không hỗ trợ HEAD → thử GET range nhỏ
        if (res.status === 405 || res.status === 501) {
          const ctrl2  = new AbortController();
          const timer2 = setTimeout(() => ctrl2.abort(), 8000);
          const res2   = await fetch(url, {
            signal : ctrl2.signal,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-255' },
          });
          clearTimeout(timer2);
          const ct2 = (res2.headers.get('content-type') || '').split(';')[0].trim();
          return (res2.ok || res2.status === 206) && ct2.startsWith('image/') ? url : null;
        }
        return null;
      } catch (_) {
        clearTimeout(timer);
        return null;
      }
    })
  );
  const valid = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
  if (valid.length < urls.length) {
    console.log(`[validateImageUrls] Loại ${urls.length - valid.length}/${urls.length} ảnh lỗi`);
  }
  return valid;
}

// ── Slugify tiêu đề tiếng Việt ───────────────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ── Extract H1 title từ HTML ─────────────────────────────────────────────────
function extractTitle(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, '').trim();
}

// ── Extract đoạn đầu (excerpt) từ HTML ──────────────────────────────────────
function extractExcerpt(html) {
  const m = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, '').trim().slice(0, 200);
}

// ── Publish bài lên 1 site qua PHP API ──────────────────────────────────────
async function publishToSite(site, article) {
  // article = { title, slug, html, excerpt, seoTitle, metaDescription, focusKeyword, keywords, categoryId, image, sourceUrl }
  const url = `${site.domain.replace(/\/$/, '')}/api/bot/publish.php`;
  const body = {
      title            : article.title,
      slug             : article.slug,
      content          : article.html,
      excerpt          : article.excerpt,
      category         : article.categoryId,
      seo_title        : article.seoTitle        || article.title,
      meta_description : article.metaDescription || article.excerpt,
      focus_keyword    : article.focusKeyword    || '',
      keywords         : article.keywords        || '',
      thumbnail_base64 : article.image?.base64   || null,
      thumbnail_ext    : article.image?.ext       || null,
      thumbnail_url    : article.image?.url       || null,
      source_url       : article.sourceUrl,
      is_published     : 1,
  };

  // Validate từng image URL trước khi gửi sang PHP
  // Loai bỏ link chết / 403 / không phải ảnh → tải trọn vẹn trên server
  const rawImages    = (article.pageImages || []).slice(1, 6);
  body.source_images = rawImages.length > 0
    ? await validateImageUrls(rawImages)
    : [];

  const res = await fetch(url, {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bot-Secret' : site.secret,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Lỗi server');
  return data; // { ok, id, url }
}

module.exports = {
  STATIC_CATEGORIES,
  getArticlePrefix,
  fetchCategories,
  extractImages,
  fetchImageBase64,
  validateImageUrls,
  slugify,
  extractTitle,
  extractExcerpt,
  publishToSite,
};
