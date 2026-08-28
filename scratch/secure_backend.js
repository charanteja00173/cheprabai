const fs = require('fs');
const path = require('path');

const targetPath = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';
let content = fs.readFileSync(targetPath, 'utf8');

console.log("Starting server.js patch execution...");

// 1. Add require("bcryptjs") at the top
const expressRequire = 'const express = require("express");';
const bcryptRequire = 'const bcrypt = require("bcryptjs");\nconst express = require("express");';
if (content.includes(expressRequire) && !content.includes('const bcrypt = require("bcryptjs")')) {
  content = content.replace(expressRequire, bcryptRequire);
  console.log("- Added bcryptjs import statement.");
}

// 2. Patch getAdminPassword, setAdminPassword, and add comparePassword
const oldAdminFuncs = `async function getAdminPassword() {
  if (redisClient) {
    const stored = await redisClient.get("admin:password");
    if (stored) return stored;
  }
  if (runtimeAdminPassword) return runtimeAdminPassword;
  return process.env.ADMIN_PASSWORD || null;
}

async function setAdminPassword(newPassword) {
  runtimeAdminPassword = newPassword;
  if (redisClient) {
    await redisClient.set("admin:password", newPassword);
  }
}`;

const newAdminFuncs = `async function getAdminPassword() {
  if (redisClient) {
    const stored = await redisClient.get("admin:password");
    if (stored) return stored;
  }
  if (runtimeAdminPassword) return runtimeAdminPassword;
  return process.env.ADMIN_PASSWORD || null;
}

async function setAdminPassword(newPassword) {
  const hashed = await bcrypt.hash(newPassword, 12);
  runtimeAdminPassword = hashed;
  if (redisClient) {
    await redisClient.set("admin:password", hashed);
  }
}

async function comparePassword(input, stored) {
  if (!input || !stored) return false;
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return await bcrypt.compare(input, stored);
  }
  return input === stored;
}`;

if (content.includes(oldAdminFuncs)) {
  content = content.replace(oldAdminFuncs, newAdminFuncs);
  console.log("- Patched getAdminPassword/setAdminPassword and added comparePassword.");
} else {
  console.warn("⚠️ getAdminPassword/setAdminPassword block not found or already modified.");
}

// 3. Update admin login endpoint to use comparePassword
const oldLoginBlock = `app.post("/api/admin/login", adminLoginLimiter, async (req, res) => {
  const { password } = req.body;
  const correctPassword = await getAdminPassword();
  if (correctPassword && password === correctPassword) {`;

const newLoginBlock = `app.post("/api/admin/login", adminLoginLimiter, async (req, res) => {
  const { password } = req.body;
  const correctPassword = await getAdminPassword();
  if (correctPassword && await comparePassword(password, correctPassword)) {`;

if (content.includes(oldLoginBlock)) {
  content = content.replace(oldLoginBlock, newLoginBlock);
  console.log("- Updated /api/admin/login to use comparePassword.");
} else {
  console.warn("⚠️ Login endpoint block not found or already modified.");
}

// 4. Update change password endpoint to use comparePassword
const oldChangePwBlock = `app.post("/api/admin/change-password", adminAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters." });
  }
  const correctPassword = await getAdminPassword();
  if (currentPassword !== correctPassword) {`;

const newChangePwBlock = `app.post("/api/admin/change-password", adminAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters." });
  }
  const correctPassword = await getAdminPassword();
  if (!(await comparePassword(currentPassword, correctPassword))) {`;

if (content.includes(oldChangePwBlock)) {
  content = content.replace(oldChangePwBlock, newChangePwBlock);
  console.log("- Updated /api/admin/change-password to use comparePassword.");
} else {
  console.warn("⚠️ Change password endpoint block not found or already modified.");
}

// 5. Harden /api/proxy-file against SSRF using assertPublicUrl
const oldProxyBlock = `app.get("/api/proxy-file", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return res.status(400).json({ error: "Only http/https URLs allowed." });
    }
    const https = parsedUrl.protocol === "https:" ? require("https") : require("http");

    const proxyReq = https.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 15000 }, (proxyRes) => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        return res.redirect(\`/api/proxy-file?url=\${encodeURIComponent(proxyRes.headers.location)}\`);
      }
      res.writeHead(proxyRes.statusCode, {
        "Content-Type": proxyRes.headers["content-type"] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400"
      });
      proxyRes.pipe(res);
    }).on("error", (err) => {
      console.error("Proxy file error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to proxy file" });
    }).on("timeout", () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).json({ error: "Upstream timeout" });
    });
  } catch (err) {
    res.status(400).json({ error: "Invalid URL" });
  }
});`;

const newProxyBlock = `app.get("/api/proxy-file", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  try {
    const parsedUrl = await assertPublicUrl(url);
    const https = parsedUrl.protocol === "https:" ? require("https") : require("http");

    const proxyReq = https.get(parsedUrl.href, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 15000 }, (proxyRes) => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        const redirectTarget = new URL(proxyRes.headers.location, parsedUrl.href).href;
        return res.redirect(\`/api/proxy-file?url=\${encodeURIComponent(redirectTarget)}\`);
      }
      res.writeHead(proxyRes.statusCode, {
        "Content-Type": proxyRes.headers["content-type"] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400"
      });
      proxyRes.pipe(res);
    }).on("error", (err) => {
      console.error("Proxy file error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to proxy file" });
    }).on("timeout", () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).json({ error: "Upstream timeout" });
    });
  } catch (err) {
    const reason = err?.message;
    if (reason === "bad-url" || reason === "bad-proto" || reason === "private-host" || reason === "dns-fail") {
      return res.status(400).json({ error: "This URL can't be proxied for security reasons." });
    }
    res.status(400).json({ error: "Invalid URL" });
  }
});`;

if (content.includes(oldProxyBlock)) {
  content = content.replace(oldProxyBlock, newProxyBlock);
  console.log("- Secured /api/proxy-file with assertPublicUrl validation.");
} else {
  console.warn("⚠️ Proxy file endpoint block not found or already modified.");
}

// 6. Refactor Push Notification Endpoints & Delivery to support Redis
const oldPushSubsLogic = `// endpoint URL → { subscription, roomId, userName } (memory store; swap for Redis at scale)
const pushSubs = new Map();

function summarizeForPush(message) {
  if (!message) return "New message";
  if (message.encryptedPayload) return "🔒 Encrypted message";
  if (message.file?.viewOnce) return "Sent a view-once media";
  if (message.file) return \`📎 \${message.file.name || "Attachment"}\`;
  if (message.gif) return "Sent a GIF";
  const t = String(message.text || "").replace(/\\s+/g, " ").trim();
  return t ? t.slice(0, 120) : "New message";
}

async function deliverPushToRoom(roomId, message, excludeSocketId) {
  if (!vapidPub || !vapidPriv) return;
  const payload = JSON.stringify({
    title: \`\${message?.userName || "New message"}\`,
    body: summarizeForPush(message),
    roomId,
    tag: roomId,
    ts: message?.ts || Date.now()
  });
  for (const [endpoint, entry] of pushSubs) {
    if (entry.roomId !== roomId) continue;
    if (excludeSocketId && entry.senderSocketId === excludeSocketId) continue;
    try {
      await webpush.sendNotification(entry.subscription, payload);
    } catch (err) {
      // 404/410 = subscription expired or uninstalled — prune it
      if (err?.statusCode === 404 || err?.statusCode === 410) pushSubs.delete(endpoint);
    }
  }
}

app.get("/api/push/vapid", (_req, res) => {
  if (!vapidPub) return res.status(503).json({ error: "Push is not configured." });
  res.json({ publicKey: vapidPub });
});

app.post("/api/push/subscribe", express.json({ limit: "64kb" }), (req, res) => {
  const { subscription, roomId, userName, senderSocketId } = req.body || {};
  const endpoint = subscription?.endpoint;
  if (!endpoint || typeof endpoint !== "string" || !roomId) {
    return res.status(400).json({ error: "Invalid subscription." });
  }
  pushSubs.set(endpoint, {
    subscription,
    roomId: String(roomId).slice(0, 64),
    userName: String(userName || "Guest").slice(0, 32),
    senderSocketId: senderSocketId ? String(senderSocketId).slice(0, 64) : null
  });
  res.json({ ok: true });
});

app.post("/api/push/unsubscribe", express.json({ limit: "16kb" }), (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) pushSubs.delete(String(endpoint));
  res.json({ ok: true });
});`;

const newPushSubsLogic = `// endpoint URL → { subscription, roomId, userName } (memory store; swap for Redis at scale)
const pushSubs = new Map();

function summarizeForPush(message) {
  if (!message) return "New message";
  if (message.encryptedPayload) return "🔒 Encrypted message";
  if (message.file?.viewOnce) return "Sent a view-once media";
  if (message.file) return \`📎 \${message.file.name || "Attachment"}\`;
  if (message.gif) return "Sent a GIF";
  const t = String(message.text || "").replace(/\\s+/g, " ").trim();
  return t ? t.slice(0, 120) : "New message";
}

async function deliverPushToRoom(roomId, message, excludeSocketId) {
  if (!vapidPub || !vapidPriv) return;
  const payload = JSON.stringify({
    title: \`\${message?.userName || "New message"}\`,
    body: summarizeForPush(message),
    roomId,
    tag: roomId,
    ts: message?.ts || Date.now()
  });

  if (redisClient) {
    try {
      const endpoints = await redisClient.smembers(\`push:room:\${roomId}:endpoints\`);
      if (endpoints && endpoints.length > 0) {
        await Promise.all(endpoints.map(async (endpoint) => {
          const rawEntry = await redisClient.get(\`push:sub:\${endpoint}\`);
          if (!rawEntry) {
            await redisClient.srem(\`push:room:\${roomId}:endpoints\`, endpoint);
            return;
          }
          const entry = JSON.parse(rawEntry);
          if (excludeSocketId && entry.senderSocketId === excludeSocketId) return;
          try {
            await webpush.sendNotification(entry.subscription, payload);
          } catch (err) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await redisClient.del(\`push:sub:\${endpoint}\`);
              await redisClient.srem(\`push:room:\${roomId}:endpoints\`, endpoint);
            }
          }
        }));
      }
    } catch (err) {
      console.error("[Web Push] Redis delivery error:", err);
    }
  } else {
    for (const [endpoint, entry] of pushSubs) {
      if (entry.roomId !== roomId) continue;
      if (excludeSocketId && entry.senderSocketId === excludeSocketId) continue;
      try {
        await webpush.sendNotification(entry.subscription, payload);
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) pushSubs.delete(endpoint);
      }
    }
  }
}

app.get("/api/push/vapid", (_req, res) => {
  if (!vapidPub) return res.status(503).json({ error: "Push is not configured." });
  res.json({ publicKey: vapidPub });
});

app.post("/api/push/subscribe", express.json({ limit: "64kb" }), async (req, res) => {
  const { subscription, roomId, userName, senderSocketId } = req.body || {};
  const endpoint = subscription?.endpoint;
  if (!endpoint || typeof endpoint !== "string" || !roomId) {
    return res.status(400).json({ error: "Invalid subscription." });
  }

  const payload = {
    subscription,
    roomId: String(roomId).slice(0, 64),
    userName: String(userName || "Guest").slice(0, 32),
    senderSocketId: senderSocketId ? String(senderSocketId).slice(0, 64) : null
  };

  if (redisClient) {
    try {
      await redisClient.set(\`push:sub:\${endpoint}\`, JSON.stringify(payload), "EX", 30 * 24 * 60 * 60); // 30 days TTL
      await redisClient.sadd(\`push:room:\${roomId}:endpoints\`, endpoint);
    } catch (err) {
      console.error("[Web Push] Redis subscribe error:", err);
    }
  } else {
    pushSubs.set(endpoint, payload);
  }
  res.json({ ok: true });
});

app.post("/api/push/unsubscribe", express.json({ limit: "16kb" }), async (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) {
    if (redisClient) {
      try {
        const rawEntry = await redisClient.get(\`push:sub:\${endpoint}\`);
        if (rawEntry) {
          const entry = JSON.parse(rawEntry);
          if (entry.roomId) {
            await redisClient.srem(\`push:room:\${entry.roomId}:endpoints\`, endpoint);
          }
        }
        await redisClient.del(\`push:sub:\${endpoint}\`);
      } catch (err) {
        console.error("[Web Push] Redis unsubscribe error:", err);
      }
    } else {
      pushSubs.delete(String(endpoint));
    }
  }
  res.json({ ok: true });
});`;

if (content.includes(oldPushSubsLogic)) {
  content = content.replace(oldPushSubsLogic, newPushSubsLogic);
  console.log("- Refactored push endpoints and deliverPushToRoom to support Redis scaling.");
} else {
  console.warn("⚠️ Push logic block not found or already modified.");
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log("server.js patch completed successfully.");
