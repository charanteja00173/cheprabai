const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';

let content = fs.readFileSync(path, 'utf8');

const target = 'app.post("/api/upload", upload.single("file"), async (req, res, next) => {';
const replacement = 'app.post("/api/upload", uploadLimiter, upload.single("file"), async (req, res, next) => {';

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("SUCCESS: uploadLimiter successfully restored to /api/upload for secure rate limiting!");
} else {
  console.log("ERROR: Target signature not found.");
}
