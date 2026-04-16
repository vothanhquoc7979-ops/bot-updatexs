/**
 * storage.js — Lưu và đọc config từ file config.json
 * Railway filesystem là ephemeral nhưng ổn cho config ít thay đổi
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

const DEFAULTS = {
  telegram_bot_token: '',
  telegram_chat_id:   '',
  php_host:           '',   // legacy
  php_push_secret:    '',   // legacy
  php_server_url:     '',   // legacy
  auto_schedule:      true,
  gemini_api_key:     '',   // legacy (kept for backward compat)
  groq_keys: [],  // [{ name:'API-1', key:'gsk_...', exhausted:false }]
  groq_default_model: 'llama-3.3-70b-versatile', // model mặc định cho SEO rewriter
  groq_api_base:      'https://api.groq.com/openai/v1', // Groq hoặc OpenRouter
  sites: [],      // [{ domain:'https://site.com', secret:'xxx' }]
};

function load() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return { ...DEFAULTS };
}

function save(data) {
  const merged = { ...load(), ...data };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

function get(key) {
  // 1. Đọc từ config.json
  const cfg = load();
  if (cfg[key]) return cfg[key];
  // 2. Fallback: biến môi trường (Railway env vars)
  const envKey = key.toUpperCase();
  return process.env[envKey] || process.env[`TELEGRAM_BOT_TOKEN`]
    || (key === 'telegram_bot_token' ? process.env.TELEGRAM_BOT_TOKEN : '')
    || cfg[key] || '';
}

/**
 * Trả về danh sách sites đã cấu hình.
 * Ưu tiên mảng sites[] mới; fallback về php_host / php_server_url cũ.
 * Mỗi phần tử: { domain: 'https://site.com', secret: '...' }
 */
function getSites() {
  const cfg = load();

  // Dùng mảng mới nếu có
  if (Array.isArray(cfg.sites) && cfg.sites.length > 0) {
    return cfg.sites
      .filter(s => s.domain && s.secret)
      .map(s => ({ domain: s.domain.replace(/\/+$/, ''), secret: s.secret }));
  }

  // Fallback legacy: php_host hoặc php_server_url
  const legacyDomain =
    cfg.php_host ||
    (cfg.php_server_url ? cfg.php_server_url.replace(/\/api\/.*$/, '') : '');
  const legacySecret = cfg.php_push_secret;

  if (legacyDomain && legacySecret) {
    return [{ domain: legacyDomain.replace(/\/+$/, ''), secret: legacySecret }];
  }
  return [];
}


/**
 * Lấy Groq API key còn khả dụng (chưa exhausted).
 * Trả về { name, key } hoặc null nếu không còn key nào.
 */
function getActiveGroqKey() {
  const cfg = load();
  const keys = Array.isArray(cfg.groq_keys) ? cfg.groq_keys : [];
  return keys.find(k => k.key && !k.exhausted) || null;
}

/**
 * Đánh dấu key theo tên là exhausted (hết token).
 */
function markGroqKeyExhausted(name) {
  const cfg = load();
  const keys = Array.isArray(cfg.groq_keys) ? cfg.groq_keys : [];
  const idx = keys.findIndex(k => k.name === name);
  if (idx >= 0) {
    keys[idx].exhausted = true;
    save({ groq_keys: keys });
    console.log(`[Groq] Key "${name}" đã hết token → đánh dấu exhausted.`);
  }
}

module.exports = { load, save, get, getSites, getActiveGroqKey, markGroqKeyExhausted };
