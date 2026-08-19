const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Update express.json() limit
content = content.replace(
  'app.use(express.json());',
  'app.use(express.json({ limit: "1000mb" }));\napp.use(express.urlencoded({ limit: "1000mb", extended: true }));'
);

// 2. Update multer config to allow 1GB files
content = content.replace(
  'const upload = multer({ storage });',
  'const upload = multer({ storage, limits: { fileSize: 1000 * 1024 * 1024, fieldSize: 1000 * 1024 * 1024 } });'
);

// 3. Update Socket.io maxHttpBufferSize to 1GB
content = content.replace(
  'maxHttpBufferSize: 25 * 1024 * 1024,',
  'maxHttpBufferSize: 1000 * 1024 * 1024,'
);

// 4. Update /api/upload to use upload_large with fallback
const uploadTarget = `    // Attempt Cloudinary upload first
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: isEncrypted ? "raw" : "auto",
      public_id: path.basename(req.file.filename, path.extname(req.file.filename))
    });`;

const uploadReplacement = `    // Attempt Cloudinary upload_large for large files & reliability
    const result = await cloudinary.uploader.upload_large(req.file.path, {
      resource_type: isEncrypted ? "raw" : "auto",
      chunk_size: 20000000,
      public_id: path.basename(req.file.filename, path.extname(req.file.filename))
    });`;

if (content.includes(uploadTarget)) {
  content = content.replace(uploadTarget, uploadReplacement);
}

fs.writeFileSync(path, content, 'utf8');
console.log("SUCCESS: Backend limits and upload_large updated successfully!");
