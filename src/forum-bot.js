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
            // Lấy 3 tin mới nhất
            return json.messages.slice(-3).map(m => `[${m.name}]: ${m.message.replace(/<[^>]+>/g, '')}`);
        }
    } catch(e) {}
    return [];
}

async function generateGeminiMessage(apiKey, personaType, historyContext) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    // Ánh xạ tính cách cho Prompt
    const typeDict = {
        'lao_lang': 'Một ông lão giàu kinh nghiệm, hay nói đạo lý, khuyên răn người trẻ, chốt kèo an toàn.',
        'dan_choi': 'Một thanh niên liều mạng, khát nước, hay xúi all in, thích khoe tiếng to.',
        'den_dui': 'Một kẻ cực kỳ đen đủi, than khóc ỉ ôi, cầu cứu người khác vì xa bờ.',
        'chuyen_gia': 'Một kỹ sư/người thống kê, dùng từ ngữ chuyên môn (tỷ lệ, đồ thị, phương sai, nhịp)',
        'dan_que': 'Một nông dân mộc mạc, dùng đại từ thôn quê (mấy thím, mí chế, tui), bắt số qua yếu tố đời thường tâm linh.'
    };
    
    const role = typeDict[personaType] || 'Dân chơi xổ số';
    let prompt = `Bạn đang nhắn tin trên diễn đàn xổ số lô đề. Dĩ vãng của bạn: ${role}.\n`;
    
    if (historyContext && historyContext.length > 0) {
        prompt += `Dưới đây là một số tin nhắn gần đây của người khác để bạn có thể a dua, hùa theo hoặc bình luận:\n${historyContext.join('\n')}\n`;
        prompt += `Hãy viết 1 câu trả lời ngắn (10-25 chữ) mang đúng tính cách của bạn, có thể réo tên hoặc hùa theo câu nói của người trên một cách mộc mạc tự nhiên.\n`;
    } else {
        prompt += `Hãy viết 1 bình luận ngắn (10-25 chữ) thể hiện rõ ràng tính cách trên. Có thể than thở, thả số hoặc a dua. Ngôn ngữ mạng bình dân.\n`;
    }
    prompt += `KHÔNG CẦN NGOẶC KÉP. CHỈ IN RA TIN NHẮN TRỰC TIẾP. Rất hạn chế đưa ra số Bạch thủ trần trụi trừ khi bạn là Dân Chơi.`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!res.ok) throw new Error("API Gemini phản hồi lỗi");
    const data = await res.json();
    return data.candidates[0].content.parts[0].text.trim();
}

async function postForumMessage() {
    const phpProxyUrl = storage.get('php_server_url') || process.env.PHP_PROXY_URL;
    if (!phpProxyUrl) {
      console.log("[AutoForumBot] Chưa cấu hình PHP Server URL (proxy). Đợi 1 phút kiểm tra lại...");
      setTimeout(postForumMessage, 60000);
      return;
    }
    
    // Gateway push chat & Get history
    const targetUrl = phpProxyUrl.includes('api/crawl-save.php') 
        ? phpProxyUrl.replace('api/crawl-save.php', 'api/forum-bot-save.php') 
        : phpProxyUrl.replace('/crawl-save.php', '/forum-bot-save.php');
        
    const historyUrl = phpProxyUrl.includes('api/crawl-save.php') 
        ? phpProxyUrl.replace('api/crawl-save.php', 'forum/api.php?action=fetch') 
        : phpProxyUrl.replace('/crawl-save.php', '') + '/../forum/api.php?action=fetch';
    
    // 1. Pick a random bot: bot_001 -> bot_100
    const botIdx = Math.floor(Math.random() * 100);
    const botNoStr = (botIdx + 1).toString().padStart(3, '0');
    
    const pTypes = ['lao_lang', 'dan_choi', 'den_dui', 'chuyen_gia', 'dan_que'];
    const myType = pTypes[botIdx % 5];
    const botEmail = `bot_${botNoStr}_${myType}@xoso-bot.local`;
    
    // 2. Decide Chat Mechanism (15% AI vs 85% Template)
    let message = '';
    const geminiKey = storage.get('gemini_api_key');
    let usedAI = false;
    
    if (geminiKey && Math.random() < 0.15) {
        try {
            console.log(`[AutoForumBot/AI] ${myType} đang nhặt tin nhắn trên diễn đàn để rep...`);
            const hCtx = await fetchChatHistory(historyUrl);
            message = await generateGeminiMessage(geminiKey, myType, hCtx);
            usedAI = true;
        } catch(e) {
            console.log(`[AutoForumBot] Lỗi AI (${e.message}) => Trở về kịch bản Offline.`);
        }
    }
    
    if (!usedAI) {
        // Áp dụng Tỷ lệ tĩnh: 40% Emotion, 20% Analysis, 20% Hints, 20% Numbers
        const randRatio = Math.random();
        let bucket = 'A_D';
        if (randRatio < 0.40)      bucket = 'A_D';
        else if (randRatio < 0.60) bucket = 'B';
        else if (randRatio < 0.80) bucket = 'C';
        else                       bucket = 'E';
        
        let pool = personas[myType] && personas[myType][bucket];
        if (!pool || pool.length === 0) pool = ["Hôm nay buồn trôi theo dòng sông..."];
        
        const rawTpl = pool[Math.floor(Math.random() * pool.length)];
        message = processTemplate(rawTpl);
    }
    
    // Clean string & Auto Highlight Numbers
    message = message.replace(/^"|"$/g, '');
    message = formatNumbersInText(message);
    
    // 3. Đẩy lên server PHP
    try {
      const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             'X-Bot-Secret': storage.get('php_push_secret') || process.env.BOT_PUSH_SECRET || ''
          },
          body: JSON.stringify({ bot_email: botEmail, message })
      });
      const json = await res.json();
      if (json.ok) {
         console.log(`\n💬 [${json.msg.name}] vừa chém (${myType}): "${message}"`);
      } else {
         console.log(`[AutoForumBot] Server từ chối ghim: ${json.error}`);
      }
    } catch(e) {
      console.log(`[AutoForumBot] Mất kết nối tới Server: ${e.message}`);
    }
    
    // 4. Random delay (30s - 5 phút = 30 -> 300s)
    const nextSeconds = Math.floor(Math.random() * (300 - 30) + 30);
    console.log(`[AutoForumBot] Đã hẹn giờ cho bot tiếp theo lót gạch sau ${nextSeconds} giây...`);
    setTimeout(postForumMessage, nextSeconds * 1000);
}

// Start Cycle
console.log("=========================================");
console.log("🚀 KHỞI ĐỘNG CỖ MÁY DIỄN ĐÀN PRO 100 BOTS");
console.log("=========================================");
postForumMessage();
