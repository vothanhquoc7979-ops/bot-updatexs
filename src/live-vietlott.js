'use strict';
const crypto = require('crypto');
const storage = require('./storage');

function nowVN() {
    const now = new Date();
    return now.toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

function getDayOfWeekVN() {
    // 0 = CN, 1 = T2...
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const vnTime = new Date(utc + (3600000 * 7));
    return vnTime.getDay();
}

const LIVE_SCHEDULE = {
    mega645:      { days: [0, 3, 5], start: "18:05", end: "18:35" },
    power655:     { days: [2, 4, 6], start: "18:05", end: "18:35" },
    max3d:        { days: [1, 3, 5], start: "18:05", end: "18:35" },
    max3dpro:     { days: [2, 4, 6], start: "18:05", end: "18:35" },
    max4d:        { days: [2, 4, 6], start: "18:05", end: "18:35" },
    lotto535_13h: { days: [0, 1, 2, 3, 4, 5, 6], start: "13:00", end: "13:35" },
    lotto535_21h: { days: [0, 1, 2, 3, 4, 5, 6], start: "21:00", end: "21:35" },
};

function isLiveTime(game) {
    const sch = LIVE_SCHEDULE[game];
    if (!sch) return false;
    const day = getDayOfWeekVN();
    if (!sch.days.includes(day)) return false;
    const t = nowVN();
    return (t >= sch.start && t <= sch.end);
}

function generateSignature(method, path) {
    const secret = "xs365-api-sign-key-2026";
    const ts = Date.now().toString();
    const raw = `${ts}:${method}:${path}`;
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    return { sig, ts };
}

function formatLiveNumbers(gameType, d) {
    const pad = n => (n === null || n === undefined || n === '') ? '?' : String(n).padStart(2, '0');
    let nums = d.numbers || {};
    let numbers = '';

    if (gameType === 'mega645' || gameType === 'power655' || gameType.startsWith('lotto535')) {
        let arr = Array.isArray(nums) ? nums : [];
        if (arr.length === 0) arr = new Array(6).fill('?');
        numbers = arr.map(pad).join(',');
    } else if (gameType === 'max3d') {
        const sp = (nums.special && nums.special.length > 0 ? nums.special : new Array(2).fill('?')).map(pad).join(',');
        const f1 = (nums.first && nums.first.length > 0 ? nums.first : new Array(4).fill('?')).map(pad).join(',');
        const f2 = (nums.second && nums.second.length > 0 ? nums.second : new Array(6).fill('?')).map(pad).join(',');
        const f3 = (nums.third && nums.third.length > 0 ? nums.third : new Array(8).fill('?')).map(pad).join(',');
        numbers = [sp, f1, f2, f3].join('|');
    } else if (gameType === 'max3dpro') {
        const sp = (nums.special && nums.special.length > 0 ? nums.special : new Array(2).fill('?')).map(pad).join(',');
        const sps = (nums.special_sub && nums.special_sub.length > 0 ? nums.special_sub : new Array(2).fill('?')).map(pad).join(',');
        const f1 = (nums.first && nums.first.length > 0 ? nums.first : new Array(4).fill('?')).map(pad).join(',');
        const f2 = (nums.second && nums.second.length > 0 ? nums.second : new Array(6).fill('?')).map(pad).join(',');
        const f3 = (nums.third && nums.third.length > 0 ? nums.third : new Array(8).fill('?')).map(pad).join(',');
        numbers = [sp, sps, f1, f2, f3].join('|');
    } else if (gameType === 'max4d') {
        const g1 = pad(nums.g1 || '?');
        const g2 = (nums.g2 && nums.g2.length > 0 ? nums.g2 : new Array(2).fill('?')).map(pad).join(',');
        const g3 = (nums.g3 && nums.g3.length > 0 ? nums.g3 : new Array(3).fill('?')).map(pad).join(',');
        numbers = [g1, g2, g3].join('|');
    }
    return numbers;
}

/**
 * Kiểm tra data có đầy đủ không trước khi coi là "xổ xong".
 * Chỉ set isDoneForToday=true khi BOTH: API isDone=true và data này trả về true.
 */
  function isDataComplete(game, formattedObj) {
    const nums = formattedObj.numbers || '';
    // Còn placeholder '?' trong số → chưa đủ
    if (!nums || nums.includes('?')) return false;

    if (game === 'power655') {
        // Cần ít nhất jackpot1 (pool tích lũy, luôn > 0)
        // Jackpot2 có thể không có nếu kỳ này không ai thắng
        return !!(formattedObj.jackpot);
    }
    if (game === 'mega645') {
        // 6 bóng
        return nums.split(',').filter(Boolean).length >= 6;
    }
    if (game === 'max3d') {
        // Format: special|first|second|third (4 tiers)
        const parts = nums.split('|');
        return parts.length >= 4 && parts.every(p => p.trim() && !p.includes('?'));
    }
    if (game === 'max3dpro') {
        // Format: special|special_sub|first|second|third (5 tiers)
        const parts = nums.split('|');
        return parts.length >= 5 && parts.every(p => p.trim() && !p.includes('?'));
    }
    if (game.startsWith('lotto535')) {
        return nums.split(',').filter(Boolean).length >= 5;
    }
    return true;
}


const liveState = {};

// ── Lấy jackpot từ static JSON API (GitHub) khi live API không có ──────────
async function tryFetchJackpotStatic(game, dateStr) {
    try {
        const [y, m, d] = dateStr.split('-');
        const url = `https://raw.githubusercontent.com/vothanhquoc7979-ops/kho-dulieu-xoso/main/data/${y}/${m}/${d}.json`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return null;
        const json = await res.json();
        const gData = json?.vietlott?.[game];
        if (!gData) return null;
        let jp1 = gData.jackpot1 ?? gData.jackpot ?? null;
        let jp2 = gData.jackpot2 ?? null;
        if (jp1 !== null) jp1 = String(jp1).replace(/\D/g, '');
        if (jp2 !== null) jp2 = String(jp2).replace(/\D/g, '');
        if (!jp1) return null; // không có jackpot trong static API
        return { jackpot: jp1, jackpot2: jp2 || '' };
    } catch (_) {
        return null;
    }
}

async function pollLiveKetquaPlus(game, onLog) {
    let apiProduct = game;
    if (game.startsWith('lotto535')) {
        apiProduct = 'lotto535';
    }
    const path = `/api/public/live/vietlott?product=${apiProduct}`;
    const url = `https://ketqua.plus${path}`;
    const { sig, ts } = generateSignature('GET', path);

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'x-sig': sig,
                'x-ts': ts,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'referer': 'https://ketqua.plus/',
                'accept': 'application/json'
            }
        });

        if (!res.ok) return;
        const result = await res.json();
        
        // Không có dữ liệu xổ, hoặc đã xổ xong kết thúc thì có thể bỏ qua nếu isDone = true
        if (!result.data) return; 

        const d = result.data || {};
        let drawNumber = result.drawCode || d.drawCode || d.drawNum || '';
        if (drawNumber && !String(drawNumber).startsWith('#')) drawNumber = '#' + String(drawNumber).padStart(5, '0');

        const padSpecial = n => (n === null || n === undefined || n === '') ? '?' : String(n).padStart(2, '0');
        let powerBall = d.specialNum !== undefined ? padSpecial(d.specialNum) : null;
        
        // Đọc jackpot từ cả data level và root level
        let jackpot1 = d.jackpot1 || d.jackpot || result.jackpot1 || result.jackpot || '';
        if (jackpot1) jackpot1 = String(jackpot1).replace(/\D/g, '');
        let jackpot2 = d.jackpot2 || result.jackpot2 || '';
        if (jackpot2) jackpot2 = String(jackpot2).replace(/\D/g, '');

        let drawDateStr = result.date || '';
        if (drawDateStr && drawDateStr.includes('-') && drawDateStr.split('-')[0].length === 2) {
            const parts = drawDateStr.split('-');
            drawDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY to YYYY-MM-DD
        }
        if (!drawDateStr) drawDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

        const formattedObj = {
            type: 'vietlott',
            game_type: game,
            draw_date: drawDateStr,
            draw_number: drawNumber,
            numbers: formatLiveNumbers(game, d),
            power_ball: powerBall,
            jackpot: jackpot1,
            jackpot2: jackpot2,
            prizes: d.winnersData || d.prizes || []
        };

        const currentHash = JSON.stringify(formattedObj);
        if (liveState[game].lastHash === currentHash) {
            // Hash không đổi — kiểm tra có thực sự done không
            if (result.isDone) {
                if (isDataComplete(game, formattedObj)) {
                    onLog(`[LIVE] ${game.toUpperCase()} đã xổ xong hoàn chỉnh! Tắt polling.`);
                    clearInterval(liveState[game].timer);
                    liveState[game].timer = null;
                    liveState[game].isDoneForToday = true;
                } else {
                    // API báo isDone nhưng số/jackpot chưa đầy → tiếp tục poll
                    onLog(`[LIVE] ${game.toUpperCase()} API isDone nhưng data chưa đầy đủ, tiếp tục poll...`);
                }
            }
            return;
        }

        liveState[game].lastHash = currentHash;
        onLog(`[LIVE] ${game.toUpperCase()} Cập nhật banh mới (Dữ liệu đổi): ${formattedObj.numbers}`);

        // Gửi đến TẤT CẢ sites song song
        const { pushToOneSite } = require('./pusher');
        const { getSites }      = require('./storage');
        const sites = getSites();
        if (sites.length > 0) {
            await Promise.allSettled(
                sites.map(({ domain, secret }) =>
                    pushToOneSite(domain, secret, '/api/crawl-save.php', JSON.stringify(formattedObj))
                )
            );
        }

        if (result.isDone) {
            if (isDataComplete(game, formattedObj)) {
                onLog(`[LIVE] ${game.toUpperCase()} đã xổ xong hoàn chỉnh! Tắt polling cho hôm nay.`);
                clearInterval(liveState[game].timer);
                liveState[game].timer = null;
                liveState[game].isDoneForToday = true;
            } else if (game === 'power655' || game === 'mega645') {
                // isDone nhưng chưa có jackpot → thử lấy từ static API
                onLog(`[LIVE] ${game.toUpperCase()} isDone nhưng chưa có jackpot → thử static API...`);
                const jpData = await tryFetchJackpotStatic(game, formattedObj.draw_date);
                if (jpData) {
                    formattedObj.jackpot  = jpData.jackpot;
                    formattedObj.jackpot2 = jpData.jackpot2;
                    onLog(`[LIVE] ${game.toUpperCase()} Lấy jackpot từ static API: JP1=${jpData.jackpot} JP2=${jpData.jackpot2}`);
                    // Push data cập nhật jackpot lên tất cả sites
                    const { pushToOneSite } = require('./pusher');
                    const { getSites } = require('./storage');
                    const sites = getSites();
                    if (sites.length > 0) {
                        await Promise.allSettled(
                            sites.map(({ domain, secret }) =>
                                pushToOneSite(domain, secret, '/api/crawl-save.php', JSON.stringify(formattedObj))
                            )
                        );
                    }
                    if (isDataComplete(game, formattedObj)) {
                        onLog(`[LIVE] ${game.toUpperCase()} Jackpot đã đầy đủ! Tắt polling.`);
                        clearInterval(liveState[game].timer);
                        liveState[game].timer = null;
                        liveState[game].isDoneForToday = true;
                    }
                } else {
                    onLog(`[LIVE] ${game.toUpperCase()} Static API chưa có jackpot, tiếp tục poll...`);
                }
            } else {
                onLog(`[LIVE] ${game.toUpperCase()} API isDone nhưng jackpot/tiers chưa đủ, tiếp tục poll...`);
            }
        }

    } catch (e) {
        onLog(`[LIVE ERROR] ${game}: ${e.message}`);
    }
}

function startLiveVietlottDaemon(onLog) {
    onLog("[LIVE] Daemon Ketqua.Plus Vietlott Live đã khởi chạy ngầm (Polled 3s/lần).");
    setInterval(() => {
        // Kiểm tra xem nút gạt trên giao diện Bot Dashboard (thẻ Config) có đang bật Auto Schedule không
        const autoScheduleEnabled = storage.load().auto_schedule;
        if (autoScheduleEnabled === false) return; // Nếu admin gạt tắt thì cũng ngủ luôn

        Object.keys(LIVE_SCHEDULE).forEach(game => {
            if (!liveState[game]) {
                liveState[game] = { timer: null, lastHash: null, isDoneForToday: false, resetDate: null };
            }
            
            // Reset ngày mới để mở khóa polling
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
            if (liveState[game].resetDate !== today) {
                liveState[game].resetDate = today;
                liveState[game].isDoneForToday = false;
                liveState[game].lastHash = null;
            }

            if (isLiveTime(game) && !liveState[game].isDoneForToday) {
                if (!liveState[game].timer) {
                    onLog(`[Scheduler] 🕒 Đã đến giờ xổ Vietlott ${game.toUpperCase()} → tự động kích hoạt bot Trực tiếp!`);
                    // Gọi lần đầu tiên
                    pollLiveKetquaPlus(game, onLog);
                    // Lặp định kỳ mỗi 3.5 giây
                    liveState[game].timer = setInterval(() => {
                        pollLiveKetquaPlus(game, onLog);
                    }, 3500); 
                }
            } else {
                if (liveState[game].timer) {
                    clearInterval(liveState[game].timer);
                    liveState[game].timer = null;
                    onLog(`[LIVE] ⏹ Dừng polling ${game.toUpperCase()}.`);
                }
            }
        });
    }, 30000); // Check mỗi 30 giây xem đã tới khung giờ live chưa
}

module.exports = { startLiveVietlottDaemon };
