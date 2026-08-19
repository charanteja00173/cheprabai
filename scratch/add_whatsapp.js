const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Add the WhatsApp notification function after the require statements
const insertAfter = 'const stream = require("stream");';
const whatsappFunction = `const stream = require("stream");

/* ================= WHATSAPP ADMIN NOTIFICATIONS (CallMeBot) ================= */
async function sendWhatsAppNotification(message) {
  const phone = process.env.ADMIN_WHATSAPP_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!phone || !apiKey) return; // Silently skip if not configured
  try {
    const encodedMsg = encodeURIComponent(message);
    const url = \`https://api.callmebot.com/whatsapp.php?phone=\${phone}&text=\${encodedMsg}&apikey=\${apiKey}\`;
    const https = require("https");
    const http_ = require("http");
    const client = url.startsWith("https") ? https : http_;
    await new Promise((resolve, reject) => {
      client.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            console.log("[WhatsApp] Notification sent successfully");
          } else {
            console.warn("[WhatsApp] Response:", res.statusCode, data);
          }
          resolve();
        });
      }).on("error", (err) => {
        console.warn("[WhatsApp] Failed to send:", err.message);
        resolve(); // Don't crash on notification failure
      });
    });
  } catch (err) {
    console.warn("[WhatsApp] Error:", err.message);
  }
}`;

if (content.includes(insertAfter) && !content.includes('sendWhatsAppNotification')) {
  content = content.replace(insertAfter, whatsappFunction);
  console.log("✅ Added sendWhatsAppNotification function");
} else if (content.includes('sendWhatsAppNotification')) {
  console.log("⏭️ sendWhatsAppNotification already exists, skipping function insert");
} else {
  console.log("❌ Could not find insertion point for WhatsApp function");
}

// 2. Add the WhatsApp call after room creation notification
const notificationTarget = `      emitToAdmins("adminNotification", { notification });
      emitToAdmins("adminRoomUpdated", { room: platformAdmin.summarizeRoom(roomId, room) });`;

const notificationReplacement = `      emitToAdmins("adminNotification", { notification });
      emitToAdmins("adminRoomUpdated", { room: platformAdmin.summarizeRoom(roomId, room) });

      // Send WhatsApp notification to admin
      sendWhatsAppNotification(
        \`🔔 *CHEPRABAI ALERT*\\n\\n🏠 New room created!\\n👤 By: \${normalizedName}\\n🔑 Room: \${roomId}\\n🕐 Time: \${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}\`
      );`;

if (content.includes(notificationTarget) && !content.includes('sendWhatsAppNotification(')) {
  content = content.replace(notificationTarget, notificationReplacement);
  console.log("✅ Added WhatsApp notification call after room creation");
} else if (content.includes('sendWhatsAppNotification(')) {
  console.log("⏭️ WhatsApp call already exists");
} else {
  console.log("❌ Could not find room creation notification target");
}

fs.writeFileSync(path, content, 'utf8');
console.log("✅ server.js updated successfully!");
