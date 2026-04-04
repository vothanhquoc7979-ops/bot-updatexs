/**
 * logger.js — Circular log buffer để hiển thị trên Web UI
 */
'use strict';

const MAX_LOGS = 200;
const logs = [];

function log(msg) {
  const entry = {
    ts:  new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    msg: String(msg),
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
  console.log(`[${entry.ts}] ${entry.msg}`);
}

function getLogs(lastN = 100) {
  return logs.slice(-lastN);
}

function clear() {
  logs.length = 0;
}

module.exports = { log, getLogs, clear };
