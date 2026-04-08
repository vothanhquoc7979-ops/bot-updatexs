/**
 * forum-ws.js — WebSocket server cho forum real-time chat
 * Cung cấp: broadcast(message), kết nối WS tại /forum-ws
 */
'use strict';

const { WebSocketServer } = require('ws');

/** @type {WebSocketServer|null} */
let wss = null;

/** @type {Set<WebSocket>} */
const clients = new Set();

/**
 * Khởi tạo WebSocket server gắn vào HTTP server có sẵn
 * @param {import('http').Server} server
 */
function init(server) {
  if (wss) return; // đã khởi tạo rồi

  wss = new WebSocketServer({ server, path: '/forum-ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    logger.log(`[ForumWS] Client connected — ${clients.size} online`);

    ws.on('close', () => {
      clients.delete(ws);
      logger.log(`[ForumWS] Client disconnected — ${clients.size} online`);
    });

    ws.on('error', (err) => {
      logger.log(`[ForumWS] WS error: ${err.message}`);
      clients.delete(ws);
    });

    // Ping để giữ connection sống
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });

  // Heartbeat: ping mỗi 30s, xóa dead connection
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { clients.delete(ws); return ws.terminate(); }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  logger.log('[ForumWS] WebSocket server đã khởi động tại /forum-ws');
}

/**
 * Gửi message đến tất cả client đang kết nối
 * @param {object} payload — dữ liệu cần gửi
 */
function broadcast(payload) {
  if (!wss || clients.size === 0) return;

  const data = JSON.stringify(payload);
  let sent = 0;

  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
      sent++;
    }
  });

  logger.log(`[ForumWS] Broadcast "${payload.type}" → ${sent} client(s)`);
}

/**
 * Trả về số client đang kết nối
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

module.exports = { init, broadcast, getClientCount };
