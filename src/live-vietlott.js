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
    lotto535_13h: { days: [0, 1, 2, 3, 4, 5, 6], start: "13:05", end: "13:35" },
    lotto535_21h: { days: [0, 1, 2, 3, 4, 5, 6], start: "21:05", end: "21:35" },
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

const liveState = {};

async function pollLiveKetquaPlus(game, onLog) {
    const path = `/api/public/live/vietlott?product=${game}`;
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

        const d = result.data;
        let drawNumber = d.drawCode || d.drawNum || '';
        if (drawNumber && !String(drawNumber).startsWith('#')) drawNumber = '#' + String(drawNumber).padStart(5, '0');

        const padSpecial = n => (n === null || n === undefined || n === '') ? '?' : String(n).padStart(2, '0');
        let powerBall = d.specialNum !== undefined ? padSpecial(d.specialNum) : null;
        
        let jackpot1 = d.jackpot1 || d.jackpot || '';
        if (jackpot1) jackpot1 = String(jackpot1).replace(/\D/g, '');
        let jackpot2 = d.jackpot2 || '';
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
            // Không có thay đổi so với lần trước (bóng chưa rớt cái mới), tiết kiệm Request PHP MySQL
            if (result.isDone) { // Nếu done thì dừng timer
                 onLog(`[LIVE] ${game.toUpperCase()} đã xổ xong!`);
                 clearInterval(liveState[game].timer);
                 liveState[game].timer = null;
                 liveState[game].isDoneForToday = true;
            }
            return; 
        }
        
        liveState[game].lastHash = currentHash;
        onLog(`[LIVE] ${game.toUpperCase()} Cập nhật banh mới (Dữ liệu đổi): ${formattedObj.numbers}`);

        // Gửi qua PHP
        const cfg = storage.load();
        if (cfg.php_server_url && cfg.php_push_secret) {
            const pushUrl = cfg.php_server_url + '/api/crawl-save.php';
            await fetch(pushUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Bot-Secret': cfg.php_push_secret
                },
                body: JSON.stringify(formattedObj)
            });
        }

        if (result.isDone) {
            onLog(`[LIVE] ${game.toUpperCase()} đã xổ xong! Tắt polling cho hôm nay.`);
            clearInterval(liveState[game].timer);
            liveState[game].timer = null;
            liveState[game].isDoneForToday = true;
        }

    } catch (e) {
        onLog(`[LIVE ERROR] ${game}: ${e.message}`);
    }
}

function startLiveVietlottDaemon(onLog) {
    onLog("[LIVE] Daemon Ketqua.Plus Vietlott Live đã khởi chạy ngầm (Polled 3s/lần).");
    setInterval(() => {
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
                    onLog(`[LIVE] 🔴 Bắt đầu cao tốc Polling cho ${game.toUpperCase()}...`);
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
