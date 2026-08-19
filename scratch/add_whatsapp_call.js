const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';

let content = fs.readFileSync(path, 'utf8');

const target = `      emitToAdmins("adminNotification", { notification });
      emitToAdmins("adminRoomUpdated", { room: platformAdmin.summarizeRoom(roomId, room) });
    } else if (approvedOnly && room.meta?.status === "pending") {`;

const replacement = `      emitToAdmins("adminNotification", { notification });
      emitToAdmins("adminRoomUpdated", { room: platformAdmin.summarizeRoom(roomId, room) });

      // 🔔 WhatsApp Admin Alert
      sendWhatsAppNotification(
        \`🔔 *CHEPRABAI ALERT*\\n\\n🏠 New room created!\\n👤 By: \${normalizedName}\\n🔑 Room: \${roomId}\\n🕐 Time: \${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}\`
      );
    } else if (approvedOnly && room.meta?.status === "pending") {`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("✅ WhatsApp notification call added after room creation!");
} else {
  console.log("❌ Target block not found.");
}
