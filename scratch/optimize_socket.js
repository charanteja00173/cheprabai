const fs = require('fs');
const path = '/Users/charantejaperala/Downloads/Projects/cheprabai-backend/server.js';

let content = fs.readFileSync(path, 'utf8');

// Optimize Socket.io for speed: faster ping, compression, httpCompression
const oldSocketConfig = `const io = new Server(server, {
  // Large binaries use the upload route; socket payloads must stay bounded.
  maxHttpBufferSize: 1e11,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  },
});`;

const newSocketConfig = `const io = new Server(server, {
  maxHttpBufferSize: 1e11,
  pingTimeout: 60000,
  pingInterval: 15000,
  transports: ["websocket", "polling"],
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: { level: 3 },
  },
  httpCompression: {
    threshold: 1024,
  },
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  },
});`;

if (content.includes(oldSocketConfig)) {
  content = content.replace(oldSocketConfig, newSocketConfig);
  fs.writeFileSync(path, content, 'utf8');
  console.log("SUCCESS: Socket.io optimized with compression and faster ping interval!");
} else {
  console.log("SKIPPED: Could not find the exact Socket.io config block to replace.");
}
