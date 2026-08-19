export function createDecryptionHtmlTemplate(roomId, b64Data, b64Salt, b64Iv) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cheprabai Session: ${escapeHtml(roomId)}</title>

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

    * {
      box-sizing: border-box;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
        Roboto, "Helvetica Neue", Arial, sans-serif;
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
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      text-align: center;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 1.6rem;
      background: linear-gradient(
        135deg,
        var(--brand),
        var(--brand-sec)
      );
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
      background: rgba(0, 0, 0, 0.25);
      color: #fff;
      font-size: 0.95rem;
      outline: none;
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
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
      flex-direction: column;
      height: 85vh;
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
      background: rgba(0, 0, 0, 0.2);
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
      white-space: nowrap;
    }

    .attachment-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    @media (max-width: 600px) {
      .wrapper {
        padding: 28px 20px;
      }

      #chat-container {
        width: 96%;
        height: 90vh;
        margin: 20px auto;
        border-radius: 18px;
      }

      .message-list {
        padding: 16px;
      }

      .msg-item {
        max-width: 90%;
      }

      .chat-header {
        padding: 16px;
      }
    }
  </style>
</head>

<body>

  <div class="wrapper" id="lock-screen">
    <h1>🔒 Decrypt Chat Log</h1>

    <p>
      This chat archive has been compiled as a mathematically secure vault.
      Enter the session password to view the decrypted history.
    </p>

    <div class="input-group">
      <label for="password-input">Session Password</label>

      <input
        type="password"
        id="password-input"
        placeholder="Enter password"
        autocomplete="current-password"
        autofocus
      />
    </div>

    <button id="decrypt-button">
      Decrypt Session
    </button>

    <div id="error-msg">
      Cryptographic Decryption Failed. Check password.
    </div>
  </div>

  <div id="chat-container">

    <div class="chat-header">

      <div>
        <h2
          class="chat-title"
          id="chat-title"
        ></h2>

        <div
          class="chat-meta"
          id="export-time"
        >
          Exported:
        </div>
      </div>

      <button
        id="lock-button"
        style="width: auto; padding: 8px 16px;"
      >
        Lock Session
      </button>

    </div>

    <div
      class="message-list"
      id="message-list-container"
    ></div>

  </div>

  <script>
    /*
     * IMPORTANT:
     * These values are inserted by the outer JavaScript function.
     * JSON.stringify prevents quotes/newlines from breaking this script.
     */
    const ROOM_ID = ${JSON.stringify(String(roomId ?? ""))};
    const B64_DATA = ${JSON.stringify(String(b64Data ?? ""))};
    const B64_SALT = ${JSON.stringify(String(b64Salt ?? ""))};
    const B64_IV = ${JSON.stringify(String(b64Iv ?? ""))};

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
      const passwordInput =
        document.getElementById("password-input");

      const errorDiv =
        document.getElementById("error-msg");

      const button =
        document.getElementById("decrypt-button");

      const password = passwordInput.value;

      if (!password) {
        passwordInput.focus();
        return;
      }

      errorDiv.style.display = "none";
      button.disabled = true;
      button.textContent = "Decrypting...";

      try {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const salt = b64ToUint8Array(B64_SALT);
        const iv = b64ToUint8Array(B64_IV);
        const ciphertext = b64ToUint8Array(B64_DATA);

        /*
         * Password -> PBKDF2 base key
         */
        const baseKey = await window.crypto.subtle.importKey(
          "raw",
          encoder.encode(password),
          "PBKDF2",
          false,
          ["deriveKey"]
        );

        /*
         * PBKDF2 -> AES-256-GCM key
         */
        const aesKey = await window.crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
          },
          baseKey,
          {
            name: "AES-GCM",
            length: 256
          },
          false,
          ["decrypt"]
        );

        /*
         * AES-GCM decrypt
         */
        const decryptedBuffer =
          await window.crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: iv
            },
            aesKey,
            ciphertext
          );

        const decryptedText =
          decoder.decode(decryptedBuffer);

        const payload =
          JSON.parse(decryptedText);

        renderDecryptedChat(payload);

      } catch (err) {
        console.error(
          "Decryption failed:",
          err
        );

        errorDiv.textContent =
          "Cryptographic Decryption Failed. Check password.";

        errorDiv.style.display = "block";

        button.disabled = false;
        button.textContent = "Decrypt Session";
      }
    }

    function renderDecryptedChat(payload) {
      document.getElementById("lock-screen").style.display =
        "none";

      document.body.style.display = "block";

      const container =
        document.getElementById("chat-container");

      container.style.display = "flex";

      /*
       * Room title
       */
      const title =
        document.getElementById("chat-title");

      title.textContent =
        "Cheprabai Room: " + ROOM_ID;

      /*
       * Export timestamp
       */
      const exportTime =
        document.getElementById("export-time");

      if (payload && payload.exportedAt) {
        exportTime.textContent =
          "Exported: " +
          new Date(payload.exportedAt).toLocaleString();
      } else {
        exportTime.textContent =
          "Exported: Unknown";
      }

      /*
       * Message container
       */
      const listContainer =
        document.getElementById(
          "message-list-container"
        );

      listContainer.innerHTML = "";

      if (
        !payload ||
        !Array.isArray(payload.messages)
      ) {
        const emptyMessage =
          document.createElement("div");

        emptyMessage.className = "msg-item";

        const text =
          document.createElement("span");

        text.className = "msg-body";
        text.textContent =
          "No messages found in this archive.";

        emptyMessage.appendChild(text);
        listContainer.appendChild(emptyMessage);

        return;
      }

      payload.messages.forEach(function (m) {
        const item =
          document.createElement("div");

        item.className = "msg-item";

        /*
         * Sender
         */
        const sender =
          document.createElement("span");

        sender.className = "msg-sender";
        sender.textContent =
          m.userName || "Unknown User";

        /*
         * Message body
         */
        const body =
          document.createElement("span");

        body.className = "msg-body";
        body.textContent =
          m.text || "";

        /*
         * Timestamp
         */
        const time =
          document.createElement("span");

        time.className = "msg-time";

        if (m.ts) {
          time.textContent =
            new Date(m.ts).toLocaleTimeString();
        } else {
          time.textContent = "";
        }

        item.appendChild(sender);
        item.appendChild(body);

        /*
         * Attachment
         */
        if (m.file) {
          const attachment =
            document.createElement("div");

          attachment.className =
            "attachment";

          const attachmentInfo =
            document.createElement("div");

          attachmentInfo.className =
            "attachment-info";

          const attachmentName =
            document.createElement("span");

          attachmentName.className =
            "attachment-name";

          attachmentName.textContent =
            m.file.name || "Unnamed file";

          const attachmentMeta =
            document.createElement("span");

          attachmentMeta.className =
            "attachment-meta";

          attachmentMeta.textContent =
            m.file.type || "Unknown type";

          attachmentInfo.appendChild(
            attachmentName
          );

          attachmentInfo.appendChild(
            attachmentMeta
          );

          /*
           * Download button
           */
          if (m.file.dataUrl) {
            const download =
              document.createElement("a");

            download.className =
              "attachment-btn";

            download.textContent =
              "💾 Save File";

            download.href =
              m.file.dataUrl;

            download.download =
              m.file.name || "download";

            download.rel = "noopener";

            attachment.appendChild(
              attachmentInfo
            );

            attachment.appendChild(
              download
            );
          } else {
            attachment.appendChild(
              attachmentInfo
            );
          }

          item.appendChild(attachment);
        }

        item.appendChild(time);

        listContainer.appendChild(item);
      });
    }

    /*
     * Decrypt button
     */
    document
      .getElementById("decrypt-button")
      .addEventListener(
        "click",
        attemptDecryption
      );

    /*
     * Enter key
     */
    document
      .getElementById("password-input")
      .addEventListener(
        "keydown",
        function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            attemptDecryption();
          }
        }
      );

    /*
     * Lock session
     */
    document
      .getElementById("lock-button")
      .addEventListener(
        "click",
        function () {
          location.reload();
        }
      );
  </script>

</body>
</html>`;
}


/*
 * Escape values that are placed directly into HTML.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}