const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/lib/platformAdmin.js';

let content = fs.readFileSync(path, 'utf8');

const target = `const DEFAULT_SETTINGS = {
  requireRoomApproval: false,
};`;

const replacement = `const DEFAULT_SETTINGS = {
  requireRoomApproval: false,
  adminWhatsAppPhone: "",
  callmebotApiKey: "",
};`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("SUCCESS: platformAdmin DEFAULT_SETTINGS updated with WhatsApp fields!");
} else {
  console.log("ERROR: Target block not found in platformAdmin.js");
}
