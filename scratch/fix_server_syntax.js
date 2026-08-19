const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';

let content = fs.readFileSync(path, 'utf8');

const target = `async function sendWhatsAppNotification(message) {
  try {
    if (!platformAdmin) await initPlatformAdmin();
    const settings = await platformAdmin.getSettings();
    const phone = settings.adminWhatsAppPhone || process.env.ADMIN_WHATSAPP_PHONE;
    const apiKey = settings.callmebotApiKey || process.env.CALLMEBOT_API_KEY;
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

const replacement = `async function sendWhatsAppNotification(message) {
  try {
    if (!platformAdmin) await initPlatformAdmin();
    const settings = await platformAdmin.getSettings();
    const phone = settings.adminWhatsAppPhone || process.env.ADMIN_WHATSAPP_PHONE;
    const apiKey = settings.callmebotApiKey || process.env.CALLMEBOT_API_KEY;
    if (!phone || !apiKey) return; // Silently skip if not configured

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

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("SUCCESS: WhatsApp function syntax corrected successfully!");
} else {
  console.log("ERROR: Target block not found in server.js");
}
