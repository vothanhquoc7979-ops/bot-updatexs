/**
 * session-store.js — Lưu trạng thái hội thoại Telegram per-user
 * TTL 45 phút, auto-cleanup mỗi 10 phút
 */
'use strict';

const SESSIONS = new Map();      // userId (string) → session object
const TTL_MS   = 45 * 60 * 1000; // 45 phút

function _key(userId) { return String(userId); }

function getSession(userId) {
  const s = SESSIONS.get(_key(userId));
  if (!s) return null;
  if (Date.now() > s._expiresAt) { SESSIONS.delete(_key(userId)); return null; }
  return s;
}

function setSession(userId, data) {
  SESSIONS.set(_key(userId), { ...data, _expiresAt: Date.now() + TTL_MS });
}

function updateSession(userId, patch) {
  const cur = getSession(userId);
  if (!cur) return false;
  setSession(userId, { ...cur, ...patch });
  return true;
}

function clearSession(userId) {
  SESSIONS.delete(_key(userId));
}

function getSessionByPreviewId(previewId) {
  for (const [, s] of SESSIONS) {
    if (s.previewId === previewId) return s;
  }
  return null;
}

// Cleanup expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, s] of SESSIONS) { if (now > s._expiresAt) SESSIONS.delete(k); }
}, 10 * 60 * 1000);

module.exports = { getSession, setSession, updateSession, clearSession, getSessionByPreviewId };
