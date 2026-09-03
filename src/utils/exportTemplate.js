export function createDecryptionHtmlTemplate(roomId, b64Data, b64Salt, b64Iv) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cheprabai: ${escapeHtml(roomId)}</title>
  <style>
    :root {
      --bg: #0b0c10;
      --surface: #12141c;
      --surface2: #1a1d27;
      --border: rgba(255,255,255,0.08);
      --text: #fff;
      --text-sec: #8f9cae;
      --brand: #ff3f5e;
      --brand-sec: #ff7b90;
      --brand-grad: linear-gradient(135deg, var(--brand), var(--brand-sec));
    }
    *{box-sizing:border-box}
    body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;margin:0;padding:0;display:flex;justify-content:center;min-height:100vh}
    .wrapper{width:min(500px,92%);background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:36px 28px;box-shadow:0 20px 60px rgba(0,0,0,0.5);text-align:center;margin:40px auto;align-self:center}
    h1{margin:0 0 8px;font-size:1.6rem;background:var(--brand-grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800}
    p{color:var(--text-sec);font-size:0.88rem;line-height:1.6;margin:0 0 24px}
    .input-group{margin-bottom:20px;text-align:left}
    label{font-size:0.76rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-sec);display:block;margin-bottom:8px}
    input[type="password"],input[type="text"]{width:100%;padding:14px 16px;border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,0.25);color:#fff;font-size:0.95rem;outline:none;transition:border-color 0.2s}
    input:focus{border-color:var(--brand)}
    button.decrypt-btn{width:100%;padding:14px;background:var(--brand);color:#fff;font-size:0.95rem;font-weight:700;border:none;border-radius:12px;cursor:pointer;box-shadow:0 4px 12px rgba(255,63,94,0.2);transition:opacity 0.2s}
    button.decrypt-btn:hover{opacity:0.9}
    #error-msg{color:#ff4757;font-size:0.8rem;margin-top:12px;display:none}

    #chat-container{display:none;width:min(800px,96%);margin:20px auto;background:var(--bg);border:1px solid var(--border);border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,0.4);flex-direction:column;height:88vh;overflow:hidden}
    .chat-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.01)}
    .chat-title{font-weight:800;font-size:1.1rem;margin:0}
    .chat-meta{font-size:0.72rem;color:var(--text-sec);margin-top:2px}

    .messages{flex:1;overflow-y:auto;padding:clamp(12px,3vw,24px);display:flex;flex-direction:column;gap:14px}
    @media(max-width:600px){.messages{padding:10px;gap:8px}}

    .bubble{max-width:clamp(70%,80vw,80%);padding:10px 14px;border-radius:22px 22px 22px 4px;align-self:flex-start;word-wrap:break-word;font-size:clamp(0.92rem,0.25vw + 0.88rem,1.05rem);display:flex;flex-direction:column;gap:5px}
    .bubble.own{background:var(--brand-grad);border-radius:22px 22px 4px 22px;align-self:flex-end;color:#fff;border:0.5px solid rgba(255,255,255,0.08)}
    .bubble.other{background:var(--surface2);align-self:flex-start;color:var(--text);border:0.5px solid var(--border);backdrop-filter:blur(16px)}
    .bubble.system{background:transparent;border:none;align-self:center;font-size:0.8rem;font-style:italic;opacity:0.85;border-radius:12px;padding:6px 14px}

    @media(max-width:600px){.bubble{max-width:86%;padding:7px 11px;font-size:0.92rem;border-radius:14px 14px 14px 4px}.bubble.own{border-radius:14px 14px 4px 14px}}

    .bubble .header{display:flex;align-items:center;gap:7px;margin-bottom:5px}
    .bubble .avatar{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;color:#fff;font-size:0.68rem;font-weight:800}
    .bubble .sender{font-size:0.75rem;font-weight:700}
    .bubble.own .sender{color:rgba(255,255,255,0.9)}
    .bubble .body{font-size:inherit;line-height:1.55;white-space:pre-wrap;word-break:break-word}
    .bubble .time{font-size:0.65rem;color:var(--text-sec);align-self:flex-end;margin-top:2px}
    .bubble.own .time{color:rgba(255,255,255,0.65)}

    .forwarded{display:inline-flex;align-items:center;gap:4px;font-size:0.72rem;opacity:0.6;font-style:italic;margin-bottom:4px}
    .reply-bar{border-left:3px solid var(--brand);background:rgba(255,255,255,0.055);border-radius:8px;padding:7px 9px;font-size:0.76rem;display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
    .reply-bar .rp-name{color:var(--brand);font-weight:700;font-size:0.76rem}
    .reply-bar .rp-text{opacity:0.78;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    .file-card{padding:12px;background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:12px;display:flex;align-items:center;gap:12px}
    .file-card img{max-width:100%;max-height:300px;border-radius:10px;object-fit:contain}
    .file-card video{max-width:100%;max-height:300px;border-radius:10px}
    .file-card audio{width:100%;height:36px}
    .file-card .fi{display:flex;flex-direction:column;gap:3px;min-width:0}
    .file-card .fn{font-size:0.8rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .file-card .ft{font-size:0.68rem;color:var(--text-sec)}
    .file-card a.dl{padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.08);color:#fff;font-size:0.72rem;font-weight:700;text-decoration:none;white-space:nowrap}
    .file-card a.dl:hover{background:rgba(255,255,255,0.15)}

    .gif-img{max-width:min(320px,100%);max-height:300px;border-radius:10px;display:block}

    .poll-card{background:rgba(0,0,0,0.15);border:1px solid var(--border);border-radius:12px;padding:12px;margin-top:4px;min-width:200px}
    .poll-q{font-weight:700;font-size:0.9rem;margin-bottom:8px}
    .poll-row{position:relative;margin:6px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.06);height:32px;display:flex;align-items:center}
    .poll-bar{position:absolute;left:0;top:0;height:100%;border-radius:8px;opacity:0.25;transition:width 0.3s}
    .poll-label{position:relative;z-index:1;padding:0 10px;font-size:0.8rem;font-weight:600;display:flex;justify-content:space-between;width:100%}
    .poll-total{font-size:0.72rem;color:var(--text-sec);margin-top:6px}

    .reactions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
    .reaction-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:0.72rem;background:rgba(255,255,255,0.08);border:1px solid var(--border)}
    .bubble.own .reaction-chip{background:rgba(255,255,255,0.15);border-color:rgba(255,255,255,0.12)}

    .viewonce-tag{font-size:0.72rem;opacity:0.5;font-style:italic}
    .ephemeral-tag{font-size:0.72rem;opacity:0.5;font-style:italic}

    #lock-screen h1{margin-bottom:24px}
  </style>
</head>
<body>

  <div class="wrapper" id="lock-screen">
    <h1>🔒 Decrypt Chat Log</h1>
    <p>This chat archive is encrypted end-to-end. Enter the session password to view the decrypted history.</p>
    <div class="input-group">
      <label for="password-input">Session Password</label>
      <input type="password" id="password-input" placeholder="Enter password" autocomplete="current-password" autofocus />
    </div>
    <button class="decrypt-btn" id="decrypt-button">Decrypt Session</button>
    <div id="error-msg"></div>
  </div>

  <div id="chat-container">
    <div class="chat-header">
      <div>
        <h2 class="chat-title" id="chat-title"></h2>
        <div class="chat-meta" id="export-meta"></div>
      </div>
      <button class="decrypt-btn" id="lock-button" style="width:auto;padding:8px 16px;font-size:0.8rem">Lock Session</button>
    </div>
    <div class="messages" id="message-list"></div>
  </div>

  <script>
    const ROOM_ID = ${JSON.stringify(String(roomId ?? ""))};
    const B64_DATA = ${JSON.stringify(String(b64Data ?? ""))};
    const B64_SALT = ${JSON.stringify(String(b64Salt ?? ""))};
    const B64_IV = ${JSON.stringify(String(b64Iv ?? ""))};

    function b64ToUint8Array(b64) {
      var bin = atob(b64);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    }

    function esc(s) {
      var d = document.createElement("div");
      d.textContent = s || "";
      return d.innerHTML;
    }

    function formatTime(ts) {
      if (!ts) return "";
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function formatDate(ts) {
      if (!ts) return "";
      return new Date(ts).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
    }

    function renderChat(payload) {
      document.getElementById("lock-screen").style.display = "none";
      var container = document.getElementById("chat-container");
      container.style.display = "flex";
      document.getElementById("chat-title").textContent = "Room: " + ROOM_ID;
      var msgs = (payload && payload.messages) || [];
      var count = msgs.length;
      var first = msgs.length > 0 ? msgs[0].ts : null;
      var last = msgs.length > 0 ? msgs[msgs.length - 1].ts : null;
      var meta = count + " message" + (count !== 1 ? "s" : "");
      if (first && last) meta += " \u00b7 " + formatDate(first) + " \u2013 " + formatDate(last);
      document.getElementById("export-meta").textContent = meta;
      var list = document.getElementById("message-list");
      list.innerHTML = "";
      if (count === 0) {
        list.innerHTML = '<div class="bubble system">No messages in this archive.</div>';
        return;
      }
      var lastSender = "";
      var lastTs = 0;
      msgs.forEach(function(m) {
        var isOwn = !!m.isOwn;
        var isGrouped = (m.userName === lastSender) && m.ts && lastTs && (m.ts - lastTs < 120000);
        lastSender = m.userName;
        lastTs = m.ts;

        var b = document.createElement("div");
        b.className = "bubble " + (isOwn ? "own" : "other");

        if (!isGrouped) {
          var hdr = document.createElement("div");
          hdr.className = "header";
          var av = document.createElement("div");
          av.className = "avatar";
          av.style.background = m.color || "#FF5722";
          av.textContent = (m.userName || "?").slice(0, 1).toUpperCase();
          hdr.appendChild(av);
          var sn = document.createElement("span");
          sn.className = "sender";
          sn.style.color = isOwn ? "rgba(255,255,255,0.9)" : (m.color || "var(--brand)");
          sn.textContent = m.userName || "Unknown";
          hdr.appendChild(sn);
          b.appendChild(hdr);
        }

        if (m.forwarded) {
          var fwd = document.createElement("div");
          fwd.className = "forwarded";
          fwd.textContent = "\\u21aa Forwarded" + (m.forwardedFrom ? " from " + m.forwardedFrom : "");
          b.appendChild(fwd);
        }

        if (m.replyTo) {
          var rp = document.createElement("div");
          rp.className = "reply-bar";
          rp.innerHTML = '<span class="rp-name">' + esc(m.replyTo.userName || "Message") + '</span><span class="rp-text">' + esc(m.replyTo.text) + '</span>';
          b.appendChild(rp);
        }

        if (m.viewOnce) {
          var vo = document.createElement("div");
          vo.className = "viewonce-tag";
          vo.textContent = "\\uD83D\\uDC41 View-once media";
          b.appendChild(vo);
        }

        if (m.ephemeral) {
          var ep = document.createElement("div");
          ep.className = "ephemeral-tag";
          ep.textContent = "\\uD83D\\uDCa8 Disappearing message";
          b.appendChild(ep);
        }

        if (m.poll) {
          var pc = document.createElement("div");
          pc.className = "poll-card";
          var pq = document.createElement("div");
          pq.className = "poll-q";
          pq.textContent = m.poll.question || "Poll";
          pc.appendChild(pq);
          var total = m.poll.totalVotes || 1;
          (m.poll.options || []).forEach(function(opt) {
            var votes = (m.poll.votes && m.poll.votes[opt]) ? m.poll.votes[opt].length : 0;
            var pct = Math.round((votes / total) * 100);
            var row = document.createElement("div");
            row.className = "poll-row";
            var bar = document.createElement("div");
            bar.className = "poll-bar";
            bar.style.width = pct + "%";
            bar.style.background = m.color || "var(--brand)";
            row.appendChild(bar);
            var lbl = document.createElement("div");
            lbl.className = "poll-label";
            lbl.innerHTML = '<span>' + esc(opt) + '</span><span>' + votes + ' (' + pct + '%)</span>';
            row.appendChild(lbl);
            pc.appendChild(row);
          });
          var pt = document.createElement("div");
          pt.className = "poll-total";
          pt.textContent = total + " vote" + (total !== 1 ? "s" : "");
          pc.appendChild(pt);
          b.appendChild(pc);
        } else if (m.text) {
          var bd = document.createElement("div");
          bd.className = "body";
          bd.textContent = m.text;
          b.appendChild(bd);
        }

        if (m.file) {
          var fc = document.createElement("div");
          fc.className = "file-card";
          var t = m.file.type || "";
          if (t.startsWith("image/") && m.file.url) {
            var img = document.createElement("img");
            img.src = m.file.url;
            img.alt = m.file.name || "image";
            fc.appendChild(img);
          } else if (t.startsWith("video/") && m.file.url) {
            var vid = document.createElement("video");
            vid.src = m.file.url;
            vid.controls = true;
            vid.preload = "metadata";
            fc.appendChild(vid);
          } else if (t.startsWith("audio/") && m.file.url) {
            var aud = document.createElement("audio");
            aud.src = m.file.url;
            aud.controls = true;
            fc.appendChild(aud);
          } else {
            var fi = document.createElement("div");
            fi.className = "fi";
            var fn = document.createElement("div");
            fn.className = "fn";
            fn.textContent = m.file.name || "Attachment";
            var ft = document.createElement("div");
            ft.className = "ft";
            ft.textContent = t || "Unknown type";
            fi.appendChild(fn);
            fi.appendChild(ft);
            fc.appendChild(fi);
          }
          if (m.file.url) {
            var dl = document.createElement("a");
            dl.className = "dl";
            dl.href = m.file.url;
            dl.target = "_blank";
            dl.rel = "noopener";
            dl.textContent = "\\uD83D\\uDCBE Save File";
            fc.appendChild(dl);
          }
          b.appendChild(fc);
        }

        if (m.gif && m.gif.url) {
          var gi = document.createElement("img");
          gi.className = "gif-img";
          gi.src = m.gif.url;
          gi.alt = "GIF";
          b.appendChild(gi);
        }

        if (m.reactions && typeof m.reactions === "object") {
          var rc = document.createElement("div");
          rc.className = "reactions";
          Object.keys(m.reactions).forEach(function(emoji) {
            var entries = m.reactions[emoji];
            if (!entries || (Array.isArray(entries) && entries.length === 0)) return;
            var chip = document.createElement("span");
            chip.className = "reaction-chip";
            var cnt = Array.isArray(entries) ? entries.length : 1;
            chip.textContent = emoji + " " + cnt;
            rc.appendChild(chip);
          });
          if (rc.children.length > 0) b.appendChild(rc);
        }

        var tm = document.createElement("span");
        tm.className = "time";
        tm.textContent = formatTime(m.ts);
        b.appendChild(tm);

        list.appendChild(b);
      });
    }

    async function attemptDecryption() {
      var pw = document.getElementById("password-input").value;
      if (!pw) { document.getElementById("password-input").focus(); return; }
      document.getElementById("error-msg").style.display = "none";
      var btn = document.getElementById("decrypt-button");
      btn.disabled = true; btn.textContent = "Decrypting...";
      try {
        var enc = new TextEncoder();
        var dec = new TextDecoder();
        var salt = b64ToUint8Array(B64_SALT);
        var iv = b64ToUint8Array(B64_IV);
        var ct = b64ToUint8Array(B64_DATA);
        var baseKey = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
        var aesKey = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        var buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, aesKey, ct);
        renderChat(JSON.parse(dec.decode(buf)));
      } catch (err) {
        document.getElementById("error-msg").textContent = "Decryption failed. Check password.";
        document.getElementById("error-msg").style.display = "block";
        btn.disabled = false; btn.textContent = "Decrypt Session";
      }
    }

    document.getElementById("decrypt-button").addEventListener("click", attemptDecryption);
    document.getElementById("password-input").addEventListener("keydown", function(e) { if (e.key === "Enter") { e.preventDefault(); attemptDecryption(); } });
    document.getElementById("lock-button").addEventListener("click", function() { location.reload(); });
  </script>
</body>
</html>`;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
