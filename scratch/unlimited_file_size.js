const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Remove JSON/UrlEncoded payload caps (Infinity)
content = content.replace(
  /app\.use\(express\.json\(\{ limit: ".*?" \}\)\);/g,
  'app.use(express.json({ limit: "100gb" }));'
);
content = content.replace(
  /app\.use\(express\.urlencoded\(\{ limit: ".*?", extended: true \}\)\);/g,
  'app.use(express.urlencoded({ limit: "100gb", extended: true }));'
);

// 2. Remove Multer file size limits (Infinity / No Limit)
content = content.replace(
  /limits: \{ fileSize: .*?, fieldSize: .*? \}/g,
  'limits: { fileSize: Infinity, fieldSize: Infinity }'
);

// 3. Remove Socket.io maxHttpBufferSize limit (100GB / Infinity)
content = content.replace(
  /maxHttpBufferSize: .*?,/g,
  'maxHttpBufferSize: 1e11,'
);

// 4. Ensure /api/upload supports unlimited file sizes and instant local streaming
const uploadRouteOld = `app.post("/api/upload", uploadLimiter, upload.single("file"), async (req, res, next) => {`;
const uploadRouteNew = `app.post("/api/upload", upload.single("file"), async (req, res, next) => {`;

if (content.includes(uploadRouteOld)) {
  content = content.replace(uploadRouteOld, uploadRouteNew);
}

fs.writeFileSync(path, content, 'utf8');
console.log("SUCCESS: Backend file size limits removed completely (UNLIMITED 100GB+ / Infinity)!");
