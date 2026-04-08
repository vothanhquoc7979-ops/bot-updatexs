/**
 * forum-sse.js — Server-Sent Events server cho forum real-time
 * Chạy tốt trên Railway free tier (không cần WS support)
 */
'use strict';

/** @type {Map<string, import('express').Response>} */
const clients = new Map();

let clientIdCounter = 0;

/**
 * Đăng ký 1 client SSE — gửi ngay số client hiện tại
 * @param {import('express').Response} res
 */
function addClient(res) {
  const id = ++clientIdCounter;
  clients.set(id, res);

  // Header SSE bắt buộc
  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',       // disable Nginx buffering
    'Access-Control-Allow-Origin': '*',
  });

  res.flushHeaders();

  // Gửi comment keep-alive để connection không bị timeout
  res.write(':ok\n\n');

  logger.log(`[ForumSSE] Client #${id} connected — ${clients.size} online`);

  return id;
}

/**
 * Xóa client khi disconnect
 * @param {number} id
 */
function removeClient(id) {
  if (clients.has(id)) {
    clients.delete(id);
    logger.log(`[ForumSSE] Client #${id} disconnected — ${clients.size} online`);
  }
}

/**
 * Gửi dữ liệu đến tất cả client đang kết nối
 * @param {string} eventName  — tên event (VD: 'forum_message')
 * @param {object} payload   — dữ liệu kèm theo
 */
function push(eventName, payload) {
  if (clients.size === 0) return;

  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  let sent = 0;

  for (const [, res] of clients) {
    try {
      res.write(data);
      sent++;
    } catch (_) {}
  }

  logger.log(`[ForumSSE] Pushed "${eventName}" → ${sent} client(s)`);
}

/**
 * Số client đang kết nối
 */
function getClientCount() {
  return clients.size;
}

// Lazy-load logger để tránh circular require
let _logger;
function getLogger() {
  if (!_logger) _logger = require('./logger');
  return _logger;
}
const logger = { log: (...a) => getLogger().log(...a) };

module.exports = { addClient, removeClient, push, getClientCount };
