const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Update sendWhatsAppNotification implementation
const oldNotificationFunc = `async function sendWhatsAppNotification(message) {
  const phone = process.env.ADMIN_WHATSAPP_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!phone || !apiKey) return; // Silently skip if not configured`;

const newNotificationFunc = `async function sendWhatsAppNotification(message) {
  try {
    if (!platformAdmin) await initPlatformAdmin();
    const settings = await platformAdmin.getSettings();
    const phone = settings.adminWhatsAppPhone || process.env.ADMIN_WHATSAPP_PHONE;
    const apiKey = settings.callmebotApiKey || process.env.CALLMEBOT_API_KEY;
    if (!phone || !apiKey) return; // Silently skip if not configured`;

if (content.includes(oldNotificationFunc)) {
  content = content.replace(oldNotificationFunc, newNotificationFunc);
  console.log("SUCCESS: sendWhatsAppNotification updated to read settings!");
} else {
  console.log("ERROR: sendWhatsAppNotification signature block not found.");
}

// 2. Update PATCH settings endpoint
const oldPatchSettings = `app.patch("/api/admin/settings", adminAuth, async (req, res) => {
  try {
    if (!platformAdmin) await initPlatformAdmin();
    const { requireRoomApproval } = req.body || {};
    const patch = {};
    if (typeof requireRoomApproval === "boolean") patch.requireRoomApproval = requireRoomApproval;
    const settings = await platformAdmin.setSettings(patch);`;

const newPatchSettings = `app.patch("/api/admin/settings", adminAuth, async (req, res) => {
  try {
    if (!platformAdmin) await initPlatformAdmin();
    const { requireRoomApproval, adminWhatsAppPhone, callmebotApiKey } = req.body || {};
    const patch = {};
    if (typeof requireRoomApproval === "boolean") patch.requireRoomApproval = requireRoomApproval;
    if (typeof adminWhatsAppPhone === "string") patch.adminWhatsAppPhone = adminWhatsAppPhone.trim();
    if (typeof callmebotApiKey === "string") patch.callmebotApiKey = callmebotApiKey.trim();
    const settings = await platformAdmin.setSettings(patch);`;

if (content.includes(oldPatchSettings)) {
  content = content.replace(oldPatchSettings, newPatchSettings);
  console.log("SUCCESS: PATCH settings updated to parse and save WhatsApp fields!");
} else {
  console.log("ERROR: PATCH settings block not found in server.js");
}

fs.writeFileSync(path, content, 'utf8');
console.log("SUCCESS: server.js patches applied successfully!");
