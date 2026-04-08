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
  telegram_chat_id: '',
  php_host: '',
  php_push_secret: '',
  php_server_url: '',   // VD: https://pateanlien.online/api/crawl-save.php
  auto_schedule: true,
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

module.exports = { load, save, get };
