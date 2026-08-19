export function createDecryptionHtmlTemplate(roomId, b64Data, b64Salt, b64Iv) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cheprabai Session: \${roomId}</title>
  <style>
    :root {
      --bg: #0b0c10;
      --surface: #12141c;
      --border: rgba(255, 255, 255, 0.08);
      --text: #ffffff;
      --text-sec: #8f9cae;
      --brand: #ff3f5e;
      --brand-sec: #ff7b90;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .wrapper {
      width: min(500px, 92%);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 36px 28px;
      box-sizing: border-box;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      text-align: center;
      transition: all 0.3s ease;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.6rem;
      background: linear-gradient(135deg, var(--brand), var(--brand-sec));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 800;
    }
    p {
      color: var(--text-sec);
      font-size: 0.88rem;
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .input-group {
      margin-bottom: 20px;
      text-align: left;
    }
    label {
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-sec);
      display: block;
      margin-bottom: 8px;
    }
    input {
      width: 100%;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(0,0,0,0.25);
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    input:focus {
      border-color: var(--brand);
    }
    button {
      width: 100%;
      padding: 14px;
      background: var(--brand);
      color: #fff;
      font-size: 0.95rem;
      font-weight: 700;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(255, 63, 94, 0.2);
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
    #error-msg {
      color: #ff4757;
      font-size: 0.8rem;
      margin-top: 12px;
      display: none;
    }
    #chat-container {
      display: none;
      width: min(920px, 94%);
      margin: 40px auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.4);
      flex-direction: column;
      height: 85vh;
      box-sizing: border-box;
      overflow: hidden;
    }
    .chat-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.01);
    }
    .chat-title {
      font-weight: 800;
      font-size: 1.2rem;
      margin: 0;
    }
    .chat-meta {
      font-size: 0.76rem;
      color: var(--text-sec);
    }
    .message-list {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .msg-item {
      max-width: 80%;
      padding: 14px 18px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.04);
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-self: flex-start;
    }
    .msg-sender {
      font-size: 0.76rem;
      font-weight: 800;
      color: var(--brand-sec);
    }
    .msg-body {
      font-size: 0.92rem;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .msg-time {
      font-size: 0.65rem;
      color: var(--text-sec);
      align-self: flex-end;
    }
    .attachment {
      margin-top: 10px;
      padding: 12px;
      background: rgba(0,0,0,0.2);
      border: 1px solid var(--border);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .attachment-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .attachment-name {
      font-size: 0.8rem;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .attachment-meta {
      font-size: 0.68rem;
      color: var(--text-sec);
    }
    .attachment-btn {
      padding: 6px 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      font-size: 0.72rem;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.2s;
    }
    .attachment-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  </style>
</head>
<body>
  <div class="wrapper" id="lock-screen">
    <h1>🔒 Decrypt Chat Log</h1>
    <p>This chat archive has been compiled as a mathematically secure vault. Enter the session password to view the decrypted history.</p>
    
    <div class="input-group">
      <label>Session Password</label>
      <input type="password" id="password-input" placeholder="Enter password" autofocus />
    </div>
    
    <button onclick="attemptDecryption()">Decrypt Session</button>
    <div id="error-msg">Cryptographic Decryption Failed. Check password.</div>
  </div>

  <div id="chat-container">
    <div class="chat-header">
      <div>
        <h2 class="chat-title" style="margin:0; background:none; -webkit-text-fill-color: initial;">Cheprabai Room: ${roomId}</h2>
        <div class="chat-meta" id="export-time">Exported: </div>
      </div>
      <button onclick="location.reload()" style="width: auto; padding: 8px 16px;">Lock Session</button>
    </div>
    <div class="message-list" id="message-list-container"></div>
  </div>

  <script>
    const b64Data = "${b64Data}";
    const b64Salt = "${b64Salt}";
    const b64Iv = "${b64Iv}";

    function b64ToUint8Array(b64) {
      const binaryString = atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    async function attemptDecryption() {
      const password = document.getElementById("password-input").value;
      const errorDiv = document.getElementById("error-msg");
      if (!password) return;

      try {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        const salt = b64ToUint8Array(b64Salt);
        const iv = b64ToUint8Array(b64Iv);
        const ciphertext = b64ToUint8Array(b64Data);

        const baseKey = await window.crypto.subtle.importKey(
          "raw",
          encoder.encode(password),
          "PBKDF2",
          false,
          ["deriveKey"]
        );

        const aesKey = await window.crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
          },
          baseKey,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );

        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          aesKey,
          ciphertext
        );

        const payload = JSON.parse(decoder.decode(decryptedBuffer));
        renderDecryptedChat(payload);
      } catch (err) {
        console.error(err);
        errorDiv.style.display = "block";
      }
    }

    function renderDecryptedChat(payload) {
      document.getElementById("lock-screen").style.display = "none";
      document.body.style.display = "block";
      const container = document.getElementById("chat-container");
      container.style.display = "flex";

      document.getElementById("export-time").innerText = "Exported: " + new Date(payload.exportedAt).toLocaleString();

      const listContainer = document.getElementById("message-list-container");
      listContainer.innerHTML = "";

      payload.messages.forEach(m => {
        const item = document.createElement("div");
        item.className = "msg-item";
        
        let attachmentHtml = "";
        if (m.file) {
          attachmentHtml = \`
            <div class="attachment">
              <div class="attachment-info">
                <span class="attachment-name">\${m.file.name}</span>
                <span class="attachment-meta">\${m.file.type || 'unknown'}</span>
              </div>
              <a href="\${m.file.dataUrl}" download="\${m.file.name}" class="attachment-btn">💾 Save File</a>
            </div>
          \`;
        }

        item.innerHTML = \`
          <span class="msg-sender">\${m.userName}</span>
          <span class="msg-body">\${m.text || ''}</span>
          \${attachmentHtml}
          <span class="msg-time">\${new Date(m.ts).toLocaleTimeString()}</span>
        \`;
        listContainer.appendChild(item);
      });
    }

    // Add Enter key listener
    document.getElementById("password-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") attemptDecryption();
    });
  </script>
</body>
</html>\`;
}
