require('dotenv').config({ path: __dirname + '/../.env' });
const storage = require('./storage');
const personas = require('./bot-personas.js');

function formatNumbersInText(text) {
    const colors = ['#e74c3c', '#d35400', '#2980b9', '#8e44ad', '#c0392b', '#27ae60', '#ff0000', '#0000ff', '#16a085', '#d63031', '#0984e3'];
    const sizes = ['18px', '20px', '22px', '24px', '26px'];
    
    return text.replace(/\b(\d{2,3})\b/g, (match) => {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        return `<b><span style="color: ${color}; font-size: ${size}">${match}</span></b>`;
    });
}

function processTemplate(tpl) {
    return tpl
      .replace(/{num1}/g, () => Math.floor(Math.random() * 10))
      .replace(/{num2}/g, () => Math.floor(Math.random() * 100).toString().padStart(2, '0'))
      .replace(/{num2_diff}/g, () => Math.floor(Math.random() * 100).toString().padStart(2, '0'))
      .replace(/{num3}/g, () => Math.floor(Math.random() * 1000).toString().padStart(3, '0'));
}

async function fetchChatHistory(historyUrl) {
    try {
        const res = await fetch(historyUrl);
        if (!res.ok) return [];
        const json = await res.json();
        if (json.success && json.messages) {
            return json.messages.slice(-3).map(m => `[${m.name}]: ${m.message.replace(/<[^>]+>/g, '')}`);
        }
    } catch(e) {}
    return [];
}

// ── Groq AI (thay Gemini) — auto-rotate keys ──────────────────────────────
// Forum bot dùng model nhẹ để tốc độ + tiết kiệm token.
// Model mạnh hơn (OpenRouter) được dùng trong /link SEO rewriter.
const GROQ_MODELS_FORUM = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];

async function callGroqOnce(apiKey, model, prompt) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
            model:      model,
            messages:   [{ role: 'user', content: prompt }],
            max_tokens: 80,
            temperature: 0.85,
        }),
    });
    if (res.status === 429) throw Object.assign(new Error('rate_limit_exceeded'), { exhausted: true });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = (err.error && err.error.code) || '';
        if (code === 'rate_limit_exceeded' || code === 'insufficient_quota') {
            throw Object.assign(new Error(code), { exhausted: true });
        }
        throw new Error('Groq API lỗi ' + res.status);
    }
    const data = await res.json();
    return data.choices[0].message.content.trim();
}

async function generateGroqMessage(personaType, historyContext) {
    const typeDict = {
        'lao_lang':   'Một ông lão giàu kinh nghiệm, hay nói đạo lý, khuyên răn người trẻ, chốt kèo an toàn.',
        'dan_choi':   'Một thanh niên liều mạng, khát nước, hay xúi all in, thích khoe tiếng to.',
        'den_dui':    'Một kẻ cực kỳ đen đủi, than khóc ỉ ôi, cầu cứu người khác vì xa bờ.',
        'chuyen_gia': 'Một kỹ sư/người thống kê, dùng từ ngữ chuyên môn (tỷ lệ, đồ thị, phương sai, nhịp)',
        'dan_que':    'Một nông dân mộc mạc, dùng đại từ thôn quê (mấy thím, mí chế, tui), bắt số qua yếu tố đời thường tâm linh.',
    };
    const role = typeDict[personaType] || 'Dân chơi xổ số';
    let prompt = `Bạn đang nhắn tin trên diễn đàn xổ số lô đề. Tính cách: ${role}\n`;
    if (historyContext && historyContext.length > 0) {
        prompt += `Tin nhắn gần đây:\n${historyContext.join('\n')}\n`;
        prompt += `Viết 1 câu trả lời ngắn (10-25 chữ) mang đúng tính cách, mộc mạc tự nhiên.\n`;
    } else {
        prompt += `Viết 1 bình luận ngắn (10-25 chữ) thể hiện rõ tính cách. Ngôn ngữ mạng bình dân.\n`;
    }
    prompt += `KHÔNG NGOẶC KÉP. CHỈ IN TIN NHẮN THÔI.`;

    // Forum bot luôn dùng model nhẹ (fast + tiết kiệm token); model mạnh dành cho /link
    const model = Math.random() < 0.7 ? GROQ_MODELS_FORUM[0] : GROQ_MODELS_FORUM[1];

    // Auto-rotate: thử từng key, nếu exhausted thì đánh dấu và chuyển sang key tiếp
    const cfg = storage.load();
    const keys = Array.isArray(cfg.groq_keys) ? cfg.groq_keys : [];
    const available = keys.filter(k => k.key && !k.exhausted);

    if (available.length === 0) throw new Error('Không có Groq API key khả dụng');

    for (const keyObj of available) {
        try {
            const text = await callGroqOnce(keyObj.key, model, prompt);
            console.log(`[Groq/${keyObj.name}/${model}] OK`);
            return text;
        } catch (e) {
            if (e.exhausted) {
                storage.markGroqKeyExhausted(keyObj.name);
                console.log(`[Groq] "${keyObj.name}" hết token → thử key tiếp theo...`);
                continue;
            }
            throw e;
        }
    }
    throw new Error('Tất cả Groq API keys đã hết token');
}

async function postForumMessage() {
    // Lấy PHP URL từ sites[] hoặc legacy config
    const sites = storage.getSites();
    const phpProxyUrl = sites.length > 0
        ? sites[0].domain + '/api/crawl-save.php'
        : (storage.get('php_server_url') || process.env.PHP_PROXY_URL || '');

    if (!phpProxyUrl) {
        console.log('[AutoForumBot] Chưa cấu hình PHP Server URL. Đợi 1 phút...');
        setTimeout(postForumMessage, 60000);
        return;
    }

    const targetUrl  = phpProxyUrl.replace('crawl-save.php', 'forum-bot-save.php');
    const historyUrl = phpProxyUrl.replace('api/crawl-save.php', 'forum/api.php?action=fetch');

    // Pick a random bot: bot_001 → bot_100
    const botIdx   = Math.floor(Math.random() * 100);
    const botNoStr = (botIdx + 1).toString().padStart(3, '0');
    const pTypes   = ['lao_lang', 'dan_choi', 'den_dui', 'chuyen_gia', 'dan_que'];
    const myType   = pTypes[botIdx % 5];
    const botEmail = `bot_${botNoStr}_${myType}@xoso-bot.local`;

    // Decide: 20% AI (Groq), 80% Template
    let message = '';
    let usedAI  = false;

    const cfg  = storage.load();
    const hasGroqKeys = Array.isArray(cfg.groq_keys) && cfg.groq_keys.some(k => k.key && !k.exhausted);

    if (hasGroqKeys && Math.random() < 0.20) {
        try {
            console.log(`[AutoForumBot/Groq] ${myType} đang tạo tin nhắn AI...`);
            const hCtx = await fetchChatHistory(historyUrl);
            message = await generateGroqMessage(myType, hCtx);
            usedAI  = true;
        } catch(e) {
            console.log(`[AutoForumBot] Lỗi Groq (${e.message}) → Dùng template.`);
        }
    }

    if (!usedAI) {
        const randRatio = Math.random();
        let bucket = 'A_D';
        if (randRatio < 0.40)      bucket = 'A_D';
        else if (randRatio < 0.60) bucket = 'B';
        else if (randRatio < 0.80) bucket = 'C';
        else                       bucket = 'E';

        let pool = personas[myType] && personas[myType][bucket];
        if (!pool || pool.length === 0) pool = ['Hôm nay buồn trôi theo dòng sông...'];

        const rawTpl = pool[Math.floor(Math.random() * pool.length)];
        message = processTemplate(rawTpl);
    }

    // Clean & highlight numbers
    message = message.replace(/^"|"$/g, '');
    message = formatNumbersInText(message);

    // Push lên tất cả sites
    const secret = sites.length > 0 ? sites[0].secret : (storage.get('php_push_secret') || process.env.BOT_PUSH_SECRET || '');
    try {
        const res  = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
            body: JSON.stringify({ bot_email: botEmail, message }),
        });
        const json = await res.json();
        if (json.ok) {
            console.log(`\n💬 [${json.msg.name}] chém (${myType}${usedAI ? '/AI' : ''}): "${message}"`);
        } else {
            console.log(`[AutoForumBot] Server từ chối: ${json.error}`);
        }
    } catch(e) {
        console.log(`[AutoForumBot] Mất kết nối: ${e.message}`);
    }

    // Random delay 30s – 5 phút
    const nextSec = Math.floor(Math.random() * (300 - 30) + 30);
    console.log(`[AutoForumBot] Bot tiếp theo sau ${nextSec}s...`);
    setTimeout(postForumMessage, nextSec * 1000);
}

// ── Start ──
console.log('=========================================');
console.log('🚀 KHỞI ĐỘNG CỖ MÁY DIỄN ĐÀN PRO 100 BOTS');
console.log('=========================================');
postForumMessage();
