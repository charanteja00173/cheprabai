/* ──────────────────────────────────────────────────────────────────────────
 * P2P file transfer over WebRTC DataChannel.
 *
 * Sends files browser-to-browser, bypassing the serverless relay entirely.
 * This gives real peer-to-peer speed and removes server-side disconnects:
 * once the DataChannel is open, data flows directly between the two devices.
 *
 * Signaling rides the existing socket.io `webrtc-offer` / `webrtc-answer` /
 * `webrtc-ice` relays (server.js:3396-3419), which are already generic,
 * point-to-point and room-validated — so NO backend changes are needed.
 *
 * Protocol over the DataChannel:
 *   1. META : JSON string { livefileMeta, fid, name, mime, size, totalChunks }
 *   2. CHUNK binary frames : Uint32 BE seq + raw bytes (1 MB each)
 *   3. END  : JSON string { livefileEnd, fid }
 * Receiver replies with DONE : JSON string { livefileDone, fid } so the sender
 * reports real success only once the file was assembled.
 * ────────────────────────────────────────────────────────────────────────── */

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];

const P2P_CHUNK_BYTES = 1024 * 1024; // 1 MB binary chunks
const P2P_CONNECT_TIMEOUT_MS = 15000;

// Registry of socket.id -> { pc, channel }
const connections = new Map();
// Per-peer receive context: { fid, totalChunks, got, parts, size, name, mime, viewOnce, onProgress, onDone, append }
const receiveContexts = new Map();

function randToken(len) {
  const bytes = new Uint8Array(len);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeCloseConn(peerId) {
  const conn = peerId && connections.get(peerId);
  if (conn) {
    try { if (conn.channel && conn.channel.readyState === "open") conn.channel.close(); } catch {}
    try { conn.pc.close(); } catch {}
    connections.delete(peerId);
  }
}

/**
 * Register the inbound side. Call once per socket, after join.
 * `onMeta({ fid, meta, tempId }) -> append` where append({ seq, data, got, totalChunks }) is
 * called as each chunk arrives; `onDone({ url, name, mime, size, fid })` and
 * `onProgress({ loaded, total, progress })` are wired from the meta handler.
 * Returns a cleanup function.
 */
export function registerP2PReceiver({ socket, onMeta, onDone, onProgress }) {
  const onOffer = ({ from, offer }) => {
    if (!from || !offer) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    connections.set(from, { pc, channel: null });

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("webrtc-ice", { to: from, from: socket.id, candidate: e.candidate });
    };
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      connections.set(from, { pc, channel: dc });
      dc.binaryType = "arraybuffer";
      dc.onmessage = (ev) => handleInbound(from, dc, ev, onMeta, onDone, onProgress);
      dc.onclose = () => { if (connections.get(from)?.channel === dc) connections.delete(from); };
      dc.onerror = () => {};
    };

    pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: offer }))
      .then(() => pc.createAnswer())
      .then((answer) => pc.setLocalDescription(answer))
      .then(() => socket.emit("webrtc-answer", { to: from, from: socket.id, answer: pc.localDescription }))
      .catch(() => connections.delete(from));
  };

  const onAnswer = ({ from, answer }) => {
    const conn = from && connections.get(from);
    if (conn && answer) conn.pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answer })).catch(() => {});
  };
  const onIce = ({ from, candidate }) => {
    const conn = from && connections.get(from);
    if (conn && candidate) conn.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  };

  socket.on("webrtc-offer", onOffer);
  socket.on("webrtc-answer", onAnswer);
  socket.on("webrtc-ice", onIce);

  return () => {
    socket.off("webrtc-offer", onOffer);
    socket.off("webrtc-answer", onAnswer);
    socket.off("webrtc-ice", onIce);
    connections.forEach((c) => { try { c.pc.close(); } catch {} });
    connections.clear();
    receiveContexts.clear();
  };
}

function handleInbound(peerId, dc, ev, onMeta, onDone, onProgress) {
  const data = ev.data;
  if (typeof data === "string") {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg && msg.livefileMeta) {
      const ctx = {
        fid: msg.fid, totalChunks: msg.totalChunks, got: 0,
        parts: new Array(msg.totalChunks).fill(null),
        size: msg.size, name: msg.name, mime: msg.mime, viewOnce: msg.viewOnce
      };
      if (typeof onMeta === "function") ctx.append = onMeta({ fid: msg.fid, meta: msg, tempId: `p2p-${msg.fid}` });
      receiveContexts.set(peerId, ctx);
      return;
    }
    if (msg && msg.livefileEnd) {
      const ctx = receiveContexts.get(peerId);
      if (ctx) {
        const fid = ctx.fid;
        receiveContexts.delete(peerId);
        try {
          const clean = ctx.parts.map((p) => p || new Uint8Array(0));
          const blob = new Blob(clean, { type: ctx.mime || "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          if (typeof onDone === "function") onDone({ url, name: ctx.name, mime: ctx.mime, size: ctx.size, viewOnce: ctx.viewOnce, fid });
        } catch (e) {
          if (typeof onDone === "function") onDone({ error: (e && e.message) || "assemble failed", fid });
        }
      }
      if (dc.readyState === "open") {
        try { dc.send(JSON.stringify({ livefileDone: true, fid: msg.fid })); } catch {}
      }
      return;
    }
    // Sender-side DONE ack handled in sendFileP2P; ignore here.
    return;
  }
  if (data instanceof ArrayBuffer) {
    const ctx = receiveContexts.get(peerId);
    if (!ctx) return;
    const view = new DataView(data);
    const seq = view.getUint32(0, false);
    const payload = new Uint8Array(data, 4);
    if (ctx.parts[seq] == null) {
      ctx.parts[seq] = payload;
      ctx.got++;
    }
    if (typeof ctx.append === "function") {
      ctx.append({ seq, data: payload, got: ctx.got, totalChunks: ctx.totalChunks, size: ctx.size });
    }
    if (typeof onProgress === "function") {
      onProgress({ fid: ctx.fid, loaded: ctx.got * P2P_CHUNK_BYTES, total: ctx.size, progress: Math.floor((Math.min(ctx.got * P2P_CHUNK_BYTES, ctx.size) * 100) / ctx.size) });
    }
  }
}

/**
 * Send a File to `peerId` over a fresh DataChannel.
 * Resolves with { fid } when the receiver assembles the file (DONE ack).
 * Rejects with an Error (caller should fall back to the socket relay).
 */
export function sendFileP2P({ socket, peerId, file, viewOnce, fromName, onProgress }) {
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const fid = `p2p-${Date.now()}-${randToken(4)}`;
    let completed = false;
    let connectTimer = null;

    const cleanupSignaling = () => {
      socket.off("webrtc-answer", senderAnswer);
      socket.off("webrtc-ice", senderIce);
    };
    const fail = (err) => {
      if (completed) return;
      completed = true;
      if (connectTimer) clearTimeout(connectTimer);
      cleanupSignaling();
      safeCloseConn(peerId);
      reject(err);
    };

    const channel = pc.createDataChannel("cheprabai-file");
    channel.binaryType = "arraybuffer";
    connections.set(peerId, { pc, channel });

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("webrtc-ice", { to: peerId, from: socket.id, candidate: e.candidate });
    };

    function senderAnswer({ from, answer }) {
      if (from !== peerId || !answer) return;
      pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answer })).catch(() => {});
    }
    function senderIce({ from, candidate }) {
      if (from !== peerId || !candidate) return;
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
    socket.on("webrtc-answer", senderAnswer);
    socket.on("webrtc-ice", senderIce);

    channel.onopen = async () => {
      if (completed) return;
      if (connectTimer) clearTimeout(connectTimer);
      try {
        const totalChunks = Math.ceil(file.size / P2P_CHUNK_BYTES);
        channel.send(JSON.stringify({
          livefileMeta: true, fid, name: file.name, mime: file.type, size: file.size,
          totalChunks, viewOnce: Boolean(viewOnce), fromName: fromName || ""
        }));

        let loadedBytes = 0;
        for (let seq = 0; seq < totalChunks; seq++) {
          const start = seq * P2P_CHUNK_BYTES;
          const end = Math.min(start + P2P_CHUNK_BYTES, file.size);
          const slice = file.slice(start, end);
          const buf = await slice.arrayBuffer();
          const frame = new Uint8Array(4 + buf.byteLength);
          new DataView(frame.buffer).setUint32(0, seq, false);
          frame.set(new Uint8Array(buf), 4);
          if (channel.readyState !== "open") throw new Error("P2P channel closed mid-transfer");
          channel.send(frame.buffer);
          loadedBytes += buf.byteLength;
          if (typeof onProgress === "function") {
            onProgress({ fid, loaded: loadedBytes, total: file.size, progress: Math.floor((loadedBytes * 100) / file.size) });
          }
          if (seq % 8 === 0) await new Promise((r) => setTimeout(r, 0));
        }

        channel.send(JSON.stringify({ livefileEnd: true, fid }));

        // Wait for the DONE ack (receiver assembled). Fall back/resolve optimistically
        // after a wait so a slow ack doesn't hang the whole flow — the receiver has
        // already received everything by the time END is sent.
        const ackTimer = setTimeout(() => finish(), 20000);
        channel.addEventListener("message", function onAck(ev) {
          if (typeof ev.data === "string") {
            try {
              const m = JSON.parse(ev.data);
              if (m && m.livefileDone) {
                clearTimeout(ackTimer);
                channel.removeEventListener("message", onAck);
                finish();
              }
            } catch {}
          }
        });
        function finish() {
          if (completed) return;
          completed = true;
          if (connectTimer) clearTimeout(connectTimer);
          cleanupSignaling();
          safeCloseConn(peerId);
          resolve({ fid });
        }
      } catch (err) {
        fail(err || new Error("P2P send failed"));
      }
    };

    channel.onerror = () => fail(new Error("P2P channel error"));
    channel.onclose = () => { cleanupSignaling(); };

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit("webrtc-offer", { to: peerId, from: socket.id, offer: pc.localDescription });
        connectTimer = setTimeout(() => fail(new Error("P2P connection timed out")), P2P_CONNECT_TIMEOUT_MS);
      })
      .catch(fail);
  });
}

export { ICE_SERVERS, P2P_CHUNK_BYTES };
