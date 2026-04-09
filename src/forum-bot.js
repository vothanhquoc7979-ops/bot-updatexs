require('dotenv').config({ path: __dirname + '/../.env' });
const storage = require('./storage');

const LOTTERY_TEMPLATES = [
  "Nay mình kết bạch thủ lô {num2} anh em nhé!",
  "Cầu miền Nam báo về {num2} tỷ lệ cực cao, ae tham khảo.",
  "Có ai đang xa bờ không, chiều nay ôm {num2} gỡ gạc nha 🙏",
  "{num2} - {num2} bao lô 2 miền hôm nay quá đẹp.",
  "Qua tèo nặng con {num2_diff}, nay đánh x2 con {num2} xem có gỡ được không.",
  "Keno hôm nay chạy cầu chẵn lẻ dị thật...",
  "Hội lô đề nay vắng quá nhỉ, chốt số {num3} cho sôi động nào!",
  "Trời thương thì chiều nay giải đặc biệt về đuôi {num2} =)))",
  "Xin phép lượm lúa con {num2} chiều nay nha các sếp.",
  "Có vẻ chạm {num1} chiều nay sáng cửa.",
  "Hôm nay đánh con gì cũng thấy phiêu, chắc theo con {num2} của bác ở trên vậy.",
  "Lô gan {num2} sắp nổ chưa bà con?",
  "Hôm nay thứ mấy mà mấy ông kêu gọi đánh {num2} nhiều thế?",
  "Chốt {num2} lót {num2_diff} ăn chắc mặc bền.",
  "Xin anh em con bạch thủ miền Bắc giải xui ạ, dạo này đen quá.",
  "Tuần trước ra {num2} rồi, tuần này khả năng rơi lại cực cao.",
  "Tài xỉu Keno bẻ cầu gắt quá, mất toi củ rưỡi vào con {num2}.",
  "Trưởng bản chốt số {num3} chiều nay, anh em cùng theo 1 thuyền nhé.",
  "Cứ {num2} mà nã, không ra thì mai đánh bù.",
  "Tuyệt vời quá, vừa bú con {num2} hôm qua xong nay lại nhìn thấy nó đẹp."
];

function getRandomTemplate() {
    const tpl = LOTTERY_TEMPLATES[Math.floor(Math.random() * LOTTERY_TEMPLATES.length)];
    return tpl
      .replace(/{num1}/g, () => Math.floor(Math.random() * 10))
      .replace(/{num2}/g, () => Math.floor(Math.random() * 100).toString().padStart(2, '0'))
      .replace(/{num2_diff}/g, () => Math.floor(Math.random() * 100).toString().padStart(2, '0'))
      .replace(/{num3}/g, () => Math.floor(Math.random() * 1000).toString().padStart(3, '0'));
}

function formatNumbersInText(text) {
    const colors = ['#e74c3c', '#d35400', '#2980b9', '#8e44ad', '#c0392b', '#27ae60', '#ff0000', '#0000ff', '#16a085', '#d63031', '#0984e3'];
    const sizes = ['18px', '20px', '22px', '24px', '26px'];
    
    // Tìm các số từ 2 đến 3 chữ số đứng độc lập và highlight nó lên
    return text.replace(/\b(\d{2,3})\b/g, (match) => {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        return `<b><span style="color: ${color}; font-size: ${size}">${match}</span></b>`;
    });
}

async function generateGeminiMessage(apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const prompt = "Hãy đóng vai một dân chơi xổ số, lô đề hoặc keno ở Việt Nam (đang nhắn tin trên diễn đàn vào buổi trưa/chiều). Viết 1 bình luận ngắn (khoảng 10-25 chữ). Có thể chia sẻ số, than thở thua lỗ, hoặc hô hào anh em bắt cầu. Ngôn ngữ mạng, bình dân miền quê hoặc từ lóng (xa bờ, bạch thủ, bao lô, lót, lô gan, nổ, tịt ngòi). KHÔNG CẦN NGOẶC KÉP. CHỈ IN RA TIN NHẮN.";
    
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
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
    // Gateway lưu tin nhắn Diễn đàn
    const targetUrl = phpProxyUrl.replace('/crawl-save.php', '/forum-bot-save.php');
    
    // 1. Pick a random bot: bot_001 -> bot_040
    const botNo = Math.floor(Math.random() * 40) + 1;
    const botEmail = `bot_${botNo.toString().padStart(3, '0')}@xoso-bot.local`;
    
    // 2. Sinh nội dung lai (Hybrid)
    let message = '';
    const geminiKey = storage.get('gemini_api_key');
    
    if (geminiKey && Math.random() < 0.15) { // 15% dùng AI, 85% dùng mẫu tự động
       console.log("[AutoForumBot] Đang suy nghĩ tin nhắn bằng Gemini AI...");
       try {
           message = await generateGeminiMessage(geminiKey);
       } catch(e) {
           console.log(`[AutoForumBot] Lỗi AI (${e.message}) => Chuyển sang Template`);
           message = getRandomTemplate();
       }
    } else {
       message = getRandomTemplate();
    }
    
    // Xóa dấu nháy đôi thừa nếu AI tự gen ra
    message = message.replace(/^"|"$/g, '');
    
    // Auto bắt số (2-3 chữ số) để Bôi đậm, Phóng to ngẫu nhiên & Tô MÀU!
    message = formatNumbersInText(message);
    
    // 3. Đẩy lên server
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
         console.log(`\n💬 [${json.msg.name}] vừa chốt: "${message}"`);
      } else {
         console.log(`[AutoForumBot] API Reject: ${json.error}`);
      }
    } catch(e) {
      console.log(`[AutoForumBot] Mất kết nối tới Server: ${e.message}`);
    }
    
    // 4. Hẹn giờ nhắn tin tiếp theo (Ngẫu nhiên liên tục từ 20 giây đến 150 giây)
    const nextSeconds = Math.floor(Math.random() * (150 - 20) + 20);
    console.log(`[AutoForumBot] Đã đặt lịch nhả số tiếp theo sau ${nextSeconds} giây...`);
    setTimeout(postForumMessage, nextSeconds * 1000);
}

// Bắt đầu vòng lặp
console.log("=========================================");
console.log("🚀 KHỞI ĐỘNG HỆ SINH THÁI DIỄN ĐÀN ẢO (HYBRID)");
console.log("=========================================");
postForumMessage();
