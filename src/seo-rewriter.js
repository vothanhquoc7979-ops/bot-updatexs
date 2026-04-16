/**
 * seo-rewriter.js — Module viết lại content chuẩn SEO bằng Groq/OpenRouter API
 * Dùng cho lệnh /link trong Telegram bot
 */
'use strict';

const storage = require('./storage');

// ── Danh sách model hỗ trợ ──────────────────────────────────────────────────
const AVAILABLE_MODELS = [
  { id: 'llama-3.1-8b-instant',        label: '⚡ Llama 3.1 8B',          note: 'Nhanh • Groq native' },
  { id: 'llama-3.3-70b-versatile',     label: '🧠 Llama 3.3 70B',         note: 'Thông minh • Groq native' },
  { id: 'openai/gpt-oss-120b',         label: '🔥 GPT OSS 120B',          note: 'Mạnh nhất • OpenRouter' },
  { id: 'openai/gpt-oss-20b',          label: '🟡 GPT OSS 20B',           note: 'Cân bằng • OpenRouter' },
  { id: 'moonshotai/kimi-k2-instruct', label: '🌙 Kimi K2 Instruct',      note: 'Sáng tạo • OpenRouter' },
];

// ── Fetch HTML từ URL ────────────────────────────────────────────────────────
async function fetchPageContent(url) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal : ctrl.signal,
      headers: {
        'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept'         : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Cache-Control'  : 'no-cache',
      },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const html = await res.text();
    return parseHtml(html, url);
  } catch (e) {
    clearTimeout(timer);
    throw new Error(`Không lấy được trang: ${e.message}`);
  }
}

function parseHtml(html, url) {
  // Title
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title  = titleM ? titleM[1].trim().replace(/\s+/g, ' ') : '';

  // Meta description (og hoặc name)
  const descM = html.match(/<meta[^>]+(?:property=["']og:description["']|name=["']description["'])[^>]+content=["']([^"']{10,500})["']/i)
             || html.match(/<meta[^>]+content=["']([^"']{10,500})["'][^>]+(?:property=["']og:description["']|name=["']description["'])/i);
  const description = descM ? descM[1].trim() : '';

  // Xoá script/style/nav/footer/header/aside/comments
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Ưu tiên lấy <article> hoặc <main>
  const artM = body.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
            || body.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
            || body.match(/<div[^>]*class=["'][^"']*(?:content|entry|post|article|single)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (artM) body = artM[0];

  // Strip HTML tags và decode entities
  let text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (text.length > 5000) text = text.slice(0, 5000) + '...';

  // Extract image URLs from original HTML
  const images = [];
  const imgRe  = /(<img[^>]+src=["'])([^"']{10,500})(["'])/gi;
  let imgM;
  while ((imgM = imgRe.exec(html)) !== null) {
    const src = imgM[2].trim();
    if (src.startsWith('http') && !src.includes('pixel') && !src.includes('icon') && !src.includes('logo')) {
      images.push(src);
    }
  }
  const uniqueImages = [...new Set(images)].slice(0, 5);

  return { title, description, text, url, images: uniqueImages };
}

// ── Gọi Groq / OpenRouter API ───────────────────────────────────────────────
async function callAI(apiKey, model, systemPrompt, userPrompt, apiBase) {
  const base = (apiBase || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    max_tokens : 4096,
    temperature: 0.72,
  });

  const res = await fetch(`${base}/chat/completions`, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer' : 'https://xoso-bot.railway.app',
      'X-Title'      : 'KQXS SEO Bot',
    },
    body,
  });

  if (!res.ok) {
    const err         = await res.json().catch(() => ({}));
    const msg         = err?.error?.message || `HTTP ${res.status}`;
    const isExhausted = res.status === 429 || msg.includes('rate_limit') || msg.includes('quota');
    const e           = new Error(`[API] ${msg}`);
    e.exhausted       = isExhausted;
    throw e;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ── Build prompt SEO (trả về JSON) ───────────────────────────────────────────
function buildSeoPrompt(pageData) {
  const { title, description, text, url } = pageData;

  const system = `Bạn là chuyên gia SEO Content Writer Việt Nam với 10+ năm kinh nghiệm.
Nhiệm vụ: viết lại bài theo chuẩn SEO on-page Google 2024 và trả về JSON thuần túy.
KHÔNG được thêm bất kỳ văn bản, giải thích hay markdown nào ngoài JSON.`;

  const user = `Viết lại bài viết sau theo chuẩn SEO và trả về JSON có các trường sau:

━━ NỘI DUNG GỐC ━━
Tiêu đề: ${title}
Mô tả: ${description}
Nội dung:
${text}
URL nguồn: ${url}
━━ HẾT NỘI DUNG GỐC ━━

━━ YÊU CẦU ━━

Trả về JSON với CÁC TRƯỜNG BẮT BUỘC (KHÔNG được bỏ trường nào):

{
  "seo_title": "...",
  "meta_description": "...",
  "focus_keyword": "...",
  "keywords": "...",
  "html": "..."
}

QUY TẮC TỪNG TRƯỜNG:

🔷 seo_title (SEO Title):
   - Dài 50-60 ký tự (TỐI ĐA 60)
   - Chứa từ khóa chính ở đầu
   - Hấp dẫn, kích thích click
   - Ví dụ: "Dự Đoán XSMB Hôm Nay 16/4 - Soi Cầu Chuẩn Xác Nhất"

🔷 meta_description (Meta Description):
   - Dài 140-155 ký tự (TỐI ĐA 160)
   - Tóm tắt bài, chứa từ khóa chính và từ khóa phụ
   - Có CTA (call to action) ở cuối
   - Ví dụ: "Dự đoán XSMB hôm nay chính xác nhất từ chuyên gia. Soi cầu lô đề miền Bắc chuẩn, cập nhật liên tục. Xem ngay!"

🔷 focus_keyword (Từ khóa trọng tâm):
   - 1 cụm từ khóa chính (3-5 từ)
   - Ví dụ: "dự đoán xsmb hôm nay"

🔷 keywords (Từ khóa bổ sung):
   - 5-8 từ khóa liên quan, cách nhau bằng dấu phẩy
   - Ví dụ: "soi cầu xsmb, kết quả xsmb, lô đề miền bắc, dự đoán lô đề, xổ số hôm nay"

🔷 html (Nội dung bài viết HTML):
   - 1 thẻ <h1> → tiêu đề ngắn 6-10 từ, chứa focus_keyword
   - 3-5 thẻ <h2> → chia phần nội dung chính (mỗi H2 ít nhất 2 đoạn <p>)
   - Mỗi <h2> có 1-2 thẻ <h3> khi cần đi sâu chi tiết
   - Mỗi đoạn <p> dài 80-150 từ, tự nhiên, hấp dẫn
   - Intro: 100-130 từ, có từ khóa chính, mô tả rõ bài về gì
   - 3-5 anchor text nội bộ: <a href="/slug">anchor text tự nhiên</a>
   - Kết bài có CTA rõ ràng, hướng dẫn hành động
   - TỐI THIỂU 1500 từ (bắt buộc — nếu thiếu sẽ bị từ chối)
   - CHỈ dùng thẻ: <p> <h1> <h2> <h3> <a> <strong> <ul> <ol> <li>
   - KHÔNG dùng: <div> <span> <section> <article> markdown (#, **)

⚠️ QUAN TRỌNG: Chỉ trả về JSON thuần, BẮT ĐẦU bằng { và KẾT THÚC bằng }.
KHÔNG có \`\`\`json, KHÔNG có giải thích, KHÔNG có text ngoài JSON.
Giá trị "html" phải là chuỗi JSON hợp lệ (escape dấu nháy kép bên trong bằng \\").`;

  return { system, user };
}

// ── Parse response từ AI (JSON hoặc raw HTML fallback) ───────────────────────
function parseAIResponse(rawText) {
  if (!rawText) return { html: '', seo_title: '', meta_description: '', focus_keyword: '', keywords: '' };

  // Strip markdown code blocks nếu có
  let cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Tìm JSON object
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd   = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
      return {
        html            : (parsed.html             || '').trim(),
        seo_title       : (parsed.seo_title        || '').trim(),
        meta_description: (parsed.meta_description || parsed.meta_desc || '').trim(),
        focus_keyword   : (parsed.focus_keyword    || parsed.keyword   || '').trim(),
        keywords        : (parsed.keywords         || '').trim(),
      };
    } catch (_) {
      // JSON parse thất bại — thử extract html block thủ công
      const htmlMatch = cleaned.match(/"html"\s*:\s*"([\s\S]*?)"\s*[,}]/);
      if (htmlMatch) {
        return {
          html            : htmlMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          seo_title       : '',
          meta_description: '',
          focus_keyword   : '',
          keywords        : '',
        };
      }
    }
  }

  // Fallback: treat entire response as HTML
  console.warn('[SEO-Rewriter] AI không trả về JSON hợp lệ — dùng raw HTML làm nội dung');
  return {
    html            : cleaned,
    seo_title       : '',
    meta_description: '',
    focus_keyword   : '',
    keywords        : '',
  };
}

// ── Hàm chính: Viết lại SEO ─────────────────────────────────────────────────
async function rewriteArticleSEO(pageData, overrideModel) {
  const cfg       = storage.load();
  const keys      = Array.isArray(cfg.groq_keys) ? cfg.groq_keys : [];
  const available = keys.filter(k => k.key && !k.exhausted);

  if (available.length === 0) {
    throw new Error('Không có API key khả dụng. Hãy thêm Groq hoặc OpenRouter key trong Dashboard!');
  }

  const model   = overrideModel || cfg.groq_default_model || 'llama-3.3-70b-versatile';
  const apiBase = cfg.groq_api_base || 'https://api.groq.com/openai/v1';
  const { system, user } = buildSeoPrompt(pageData);

  let lastError = null;
  for (const keyObj of available) {
    try {
      const rawText = await callAI(keyObj.key, model, system, user, apiBase);
      const parsed  = parseAIResponse(rawText);
      return { ...parsed, model, keyName: keyObj.name };
    } catch (e) {
      lastError = e;
      if (e.exhausted) {
        storage.markGroqKeyExhausted(keyObj.name);
        console.log(`[SEO-Rewriter] Key "${keyObj.name}" hết quota → thử key tiếp...`);
        continue;
      }
      throw e;
    }
  }

  throw lastError || new Error('Tất cả API keys đã hết token');
}

module.exports = { fetchPageContent, rewriteArticleSEO, AVAILABLE_MODELS };
