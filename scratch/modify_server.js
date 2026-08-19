const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';

let content = fs.readFileSync(path, 'utf8');

const target = `            uploads.push({
              id: m.id,
              roomId,
              uploadedBy: m.userName,
              name: file.name,
              url: file.url,
              type: file.type,
              size: file.size || null,
              iv: file.iv || null,
              encrypted: Boolean(file.iv),
              timestamp: m.ts,
              source: typeof file.url === "string" && file.url.includes("cloudinary") ? "cloudinary" : "realtime"
            });`;

const replacement = `            uploads.push({
              id: m.id,
              roomId,
              uploadedBy: m.userName,
              name: file.name,
              url: file.url,
              type: file.type,
              size: file.size || null,
              iv: file.iv || null,
              encrypted: Boolean(file.iv),
              timestamp: m.ts,
              source: typeof file.url === "string" && file.url.includes("cloudinary") ? "cloudinary" : "realtime",
              roomPassword: room.meta?.roomPassword || null
            });`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("SUCCESS: server.js updated successfully.");
} else {
  console.log("ERROR: Target string not found. Already updated or code changed.");
}
