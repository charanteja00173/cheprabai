import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { io } from "socket.io-client";
import { backendUrl } from "../socket";
import {
  // Link, 
  useNavigate, useParams, useSearchParams
} from "react-router-dom";
import axios from "axios";
import styled, { keyframes } from "styled-components";
import {
  FaPaperPlane,
  FaPenNib,
  FaPaperclip,
  FaClock,
  FaPlus,
  FaFile,
  FaSearch,
  FaMicrophone,
  FaDownload,
  FaUpload,
  FaEye,
  FaEyeSlash,
  FaSignOutAlt,
  FaReply,
  FaTrash,
  FaThumbtack,
  FaPen,
  FaShare,
  FaBookmark,
  FaRegBookmark,
  FaCopy,
  FaCrown,
  FaCheck,
  FaTimes
} from "react-icons/fa";
import { HiGif } from "react-icons/hi2";
import { FaVideo } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";
import notificationSound from "../assets/iphone-sms.mp3";
import image from "../logo192.png";
import { AiOutlineClose } from "react-icons/ai";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ThemeSwitcher from "./ThemeSwitcher";
import { sendFileP2P, registerP2PReceiver, P2P_CHUNK_BYTES } from "../p2pFileTransfer";
import { createDecryptionHtmlTemplate } from "../utils/exportTemplate";
import { BREAKPOINTS, useIsMobile } from "../hooks/useIsMobile";
import { AtSign, BarChart3, CalendarClock, Clapperboard, Download, Eye, EyeOff, FileUp, FolderLock, Globe, Hash, Image, KeyRound, LockKeyhole, MessagesSquare, Mic, MonitorUp, Palette, PenTool, Phone, QrCode, ScreenShare, Search, ShieldCheck, Sparkles, Timer, Upload, UserRound, Users, Video, WifiOff, Zap, ArrowRight, Check, Copy } from "lucide-react";
import {
  encryptBinary,
  decryptBinary,
  exportKey,
  importKey,
  workerGenerateKeyFromSecret as generateKeyFromSecret,
  workerEncryptMessage as encryptMessage,
  workerDecryptMessage as decryptMessage
} from "../utils/crypto";
import { copyRoomShareLink, parseRoomRouteParams } from "../utils/shareLink";
import { safeCopyText, safeCopyImage } from "../utils/clipboard";
import { SOUND_CHOICES, getSoundChoice, setSoundChoice as persistSoundChoice, playNotificationSound } from "../utils/notificationSounds";
import {
  PLAN_META,
  PLAN_LIMIT_LABELS,
  planLimitValue,
  FEATURE_GROUPS,
  planIncludes,
} from "../lib/planSpecs";

const USER_FEATURE_GROUPS = FEATURE_GROUPS
  .map((g) => ({ ...g, features: g.features.filter((f) => f.key !== "stealthMode") }))
  .filter((g) => g.features.length > 0);

// Lazy-load heavy components with retry — survives flaky networks and
// stale tabs after redeploys (the classic "Loading chunk N failed" error).
// Retries the import a few times; if the chunk is still missing it means the
// tab references an old build, so do ONE guarded hard reload to re-sync.
function lazyWithRetry(importer, retries = 2) {
  return React.lazy(() =>
    new Promise((resolve, reject) => {
      const attempt = (left) => {
        importer()
          .then(resolve)
          .catch((err) => {
            const msg = String(err?.message || err);
            const isChunkErr = /loading chunk|chunkloaderror|dynamically imported module|importing a module script failed/i.test(msg);
            if (left > 0) {
              setTimeout(() => attempt(left - 1), 600);
            } else if (isChunkErr && Date.now() - Number(sessionStorage.getItem("__chunk_reload_at") || 0) > 15000) {
              sessionStorage.setItem("__chunk_reload_at", String(Date.now()));
              window.location.reload();
            } else {
              reject(err);
            }
          });
      };
      attempt(retries);
    })
  );
}

// Keeps a failed lazy module from crashing the whole app — offers a reload instead.
class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "grid", placeItems: "center", background: "rgba(4,5,10,.94)", color: "#fff", fontFamily: "inherit" }}>
          <div style={{ textAlign: "center", padding: 24 }}>
            <p style={{ opacity: 0.8, marginBottom: 16 }}>Couldn't load this module. Check your connection.</p>
            <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 12, padding: "12px 22px", fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff" }}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Whiteboard = lazyWithRetry(() => import("./Whiteboard"));
const LiveMeeting = lazyWithRetry(() => import("./LiveMeeting"));
const UniversalFileViewer = lazyWithRetry(() => import("./UniversalFileViewer"));

/* ── Shared media gallery ──
   Every decrypted photo/video attachment registers itself here when it scrolls
   into view. The fullscreen viewer walks this list with ‹ › buttons like a
   gallery app. Keyed by the file's canonical URL; insertion order ≈ chat order.
   View-once media is never registered (privacy). */
const mediaGalleryRegistry = new Map();
function registerGalleryMedia(key, item) {
  if (!key || !item?.url || !item?.type) return;
  const prev = mediaGalleryRegistry.get(key);
  if (prev && prev.url === item.url && prev.type === item.type) return;
  mediaGalleryRegistry.set(key, item);
}
function getGalleryItems() {
  return Array.from(mediaGalleryRegistry.values());
}

/* Storage provider (Cloudinary) rejects single files above this size on the
   current plan — failing fast beats uploading for minutes and dying at 99%.
   Matching the backend's 1 GB hard limit. Files >20 MB bypass Cloudinary and
   are served locally while a background sync uploads to Cloudinary. */
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 GB
const formatUploadLimit = () => {
  const mb = MAX_UPLOAD_BYTES / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${Math.round(mb)} MB`;
};

/* ══════════════════════════════════════════════════════════
   Vanishing-message durations — shown WhatsApp-style, in the
   nearest single unit (45s · 30m · 2h · 7d).
   ══════════════════════════════════════════════════════════ */
const EPHEMERAL_PRESETS = [
  { label: "Off", value: 0 },
  { label: "5 Minutes", value: 300 },
  { label: "1 Hour", value: 3600 },
  { label: "12 Hours", value: 43200 },
  { label: "24 Hours", value: 86400 },
  { label: "7 Days", value: 604800 },
  { label: "30 Days", value: 2592000 },
  { label: "90 Days", value: 7776000 }
];
const CUSTOM_EPHEMERAL_UNITS = [
  { label: "seconds", value: 1, key: "sec" },
  { label: "minutes", value: 60, key: "min" },
  { label: "hours", value: 3600, key: "hr" },
  { label: "days", value: 86400, key: "day" },
  { label: "weeks", value: 7 * 86400, key: "week" },
  { label: "months", value: 30 * 86400, key: "month" }
];
const EPHEMERAL_MAX_SECONDS = 365 * 86400;
const formatNearestUnit = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s === 0) return "Off";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  if (s < 30 * 86400) return `${Math.floor(s / (7 * 86400))}w`;
  return `${Math.floor(s / (30 * 86400))}mo`;
};

/* ══════════════════════════════════════════════════════════
   REALTIME FILE RELAY helpers — large files skip storage and
   travel chunk-by-chunk through the room's message channel.
   ══════════════════════════════════════════════════════════ */
  const LIVE_SHARE_CHUNK_BYTES = 4 * 1024 * 1024; // 4 MB (base64 ~5.3 MB on wire, well under backend 30 MB maxPayload / 100 MB buffer)
 const LIVE_SHARE_MAX_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB
  // Realtime relay pushes every chunk over the room socket, so gigantic files
  // are slow and need both users connected for the whole transfer. We let any
  // size up to the hard 100 GB ceiling through — the effective real limit is
  // the app's 1 GB multer hard cap enforced in uploadFile.
  const LIVE_SHARE_PRACTICAL_MAX_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB (any size up to the hard ceiling)

  // The backend is deployed on Vercel serverless, which hard-caps the request
  // body at ~4.5 MB (413) regardless of what Express/multer allows. So any file
  // at or above this floor MUST go through the realtime socket relay (no such
  // body limit) instead of the HTTP /api/upload endpoint.
  const REALTIME_FLOOR_BYTES = 4 * 1024 * 1024; // 4 MB — Vercel serverless body cap
/* eslint-disable-next-line no-unused-vars */
const bytesToB64 = (bytes) => {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CH, bytes.length)));
  }
  return btoa(s);
};
const b64ToBytes = (b64) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};


/* ── Full feature catalog — every capability inside AnonChat, grouped ── */


/* ══════════════════════════════════════════════════════════
   FEATURE EXPLORER — join-screen interactive product tour.
   Auto-cycling animated demos of everything the app can do.
   Pure CSS scenes; pauses on hover/focus; honors reduced motion.
   ══════════════════════════════════════════════════════════ */
const TOUR_SPEED = 5200;
const TOUR_FEATURES = [
  { id: "chat", icon: MessagesSquare, label: "Private chat", tint: "#818cf8", blurb: "Messages are sealed on your device with AES-GCM before they ever leave it." },
  { id: "vanish", icon: Timer, label: "Vanishing messages", tint: "#fb7185", blurb: "Set a timer and every message dissolves without a trace." },
  { id: "calls", icon: Video, label: "HD video calls", tint: "#22d3ee", blurb: "Crystal-clear group calls with voice changer and live filters." },
  { id: "share", icon: ScreenShare, label: "Screen sharing", tint: "#fbbf24", blurb: "Present your screen or a single tab to everyone in the room." },
  { id: "watch", icon: Clapperboard, label: "Watch parties", tint: "#a78bfa", blurb: "Stream videos together with synced playback and chat." },
  { id: "board", icon: PenTool, label: "Live whiteboard", tint: "#34d399", blurb: "Sketch ideas together in real time on an infinite canvas." },
  { id: "vault", icon: FolderLock, label: "Encrypted files", tint: "#60a5fa", blurb: "Send any file type — encrypted client-side, viewable in-app." },
  { id: "poll", icon: BarChart3, label: "Polls & reactions", tint: "#f472b6", blurb: "Run instant polls and react with live emoji bursts." },
  { id: "mention", icon: AtSign, label: "@mentions", tint: "#8b5cf6", blurb: "Type @ to autocomplete any member's name right in your message." },
  { id: "schedule", icon: CalendarClock, label: "Scheduled messages", tint: "#0ea5e9", blurb: "Queue a message to send at exactly the right moment, even overnight." },
  { id: "export", icon: Download, label: "Chat export", tint: "#10b981", blurb: "Save the whole room as a clean HTML file to keep forever." },
  { id: "viewonce", icon: Eye, label: "View-once media", tint: "#f59e0b", blurb: "Photos and videos that reveal once, then vanish for good." },
  { id: "push", icon: Globe, label: "Push alerts", tint: "#06b6d4", blurb: "Get notified instantly even when the tab is closed." },
  { id: "voicenote", icon: Mic, label: "Voice notes", tint: "#f43f5e", blurb: "Record and send a voice message with a single tap." },
  { id: "search", icon: Search, label: "Chat search", tint: "#6366f1", blurb: "Find any message or file in the room in an instant." },
  { id: "voicecall", icon: Phone, label: "Voice-only calls", tint: "#22c55e", blurb: "Clear, private audio-only calls when you don't need the video." },
  { id: "bg", icon: Palette, label: "Video filters", tint: "#a855f7", blurb: "Blur, grayscale, sepia and filters on your video — live in any call." },
  { id: "qr", icon: QrCode, label: "QR room invite", tint: "#ef4444", blurb: "Scan to join — sharing your room is now one tap away." },
  { id: "presence", icon: Users, label: "Online presence", tint: "#14b8a6", blurb: "See who's here and who's typing, all in real time." },
  { id: "stealth", icon: EyeOff, label: "Stealth blur", tint: "#64748b", blurb: "Blur your chat instantly when someone peeks over your shoulder." },
  { id: "offline", icon: WifiOff, label: "Resilient connections", tint: "#0d9488", blurb: "App shell loads instantly and auto-reconnects if your connection drops." },
  { id: "fast", icon: Zap, label: "Lightning relay", tint: "#eab308", blurb: "Realtime relay streams huge files without grinding to a halt." },
  { id: "theme", icon: Sparkles, label: "Chat themes", tint: "#d946ef", blurb: "Recolor the room your way with a tap — even mid-chat." }
];

function TourSceneChat() {
  return (
    <div className="fe-scene fe-devices">
      <div className="fe-device">
        <span className="fe-ava" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>Y</span>
        <div className="fe-bubble fe-out">Hey, is this safe?</div>
      </div>
      <div className="fe-wire"><span className="fe-pkt"><LockKeyhole size={11} /></span></div>
      <div className="fe-device">
        <span className="fe-ava" style={{ background: "linear-gradient(135deg,#ec4899,#f43f5e)" }}>A</span>
        <div className="fe-bubble fe-in"><span className="fe-scr">▚▞▚▞▜▞▚</span><span className="fe-real">end-to-end 🔒</span></div>
      </div>
    </div>
  );
}

function TourSceneVanish() {
  return (
    <div className="fe-scene fe-vanish-wrap">
      <div className="fe-vanish-card">
        <svg viewBox="0 0 44 44" className="fe-ring"><circle cx="22" cy="22" r="18" /></svg>
        <Timer size={16} />
        <span>Screen-record proof… gone in 10s</span>
      </div>
      <div className="fe-vanish-note">leaves no copy on any server</div>
    </div>
  );
}

function TourSceneCalls() {
  return (
    <div className="fe-scene fe-callgrid">
      {["A", "M", "S"].map((n, i) => (
        <div key={n} className={`fe-tile fe-t${i}`}>
          <span className="fe-tava">{n}</span>
          <span className="fe-wave"><i /><i /><i /></span>
        </div>
      ))}
      <div className="fe-tile fe-you fe-t3"><span className="fe-tava">You</span></div>
      <div className="fe-calldock"><Video size={12} /><MonitorUp size={12} />HD</div>
    </div>
  );
}

function TourSceneShare() {
  return (
    <div className="fe-scene fe-sharewrap">
      <div className="fe-winbar"><i /><i /><i /><em>quarterly-deck.key</em></div>
      <div className="fe-winbody">
        <span className="fe-cursor">▲</span>
      </div>
      <span className="fe-live">● LIVE</span>
    </div>
  );
}

function TourSceneWatch() {
  return (
    <div className="fe-scene fe-watchwrap">
      <div className="fe-player">
        <div className="fe-film" />
        <span className="fe-head"><i className="fe-ha ha1">A</i><i className="fe-ha ha2">M</i></span>
      </div>
      <div className="fe-watchmeta">synced playback · everyone sees the same frame</div>
    </div>
  );
}

function TourSceneBoard() {
  return (
    <div className="fe-scene fe-boardwrap">
      <div className="fe-tools"><i /><i /><i /></div>
      <div className="fe-board-stage">
        <svg viewBox="0 0 300 120" className="fe-canvas" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path className="fe-draw d1" d="M20 90 C 70 10, 120 130, 170 50 S 260 80, 282 34" />
          <path className="fe-draw d2" d="M60 108 L 250 108" />
        </svg>
      </div>
    </div>
  );
}

function TourSceneVault() {
  return (
    <div className="fe-scene fe-vaultwrap">
      <div className="fe-filechip"><FileUp size={13} />movie-night.mp4<em>842 MB</em></div>
      <div className="fe-vaultline"><ShieldCheck size={26} /></div>
      <div className="fe-vaultbar"><i /></div>
    </div>
  );
}

function TourScenePoll() {
  return (
    <div className="fe-scene fe-pollwrap">
      <div className="fe-pollq">Movie night — pick one 🍿</div>
      {[["Dune 2", 62, "d1"], ["Arrival", 28, "d2"], ["Tenet", 10, "d3"]].map(([t, w]) => (
        <div key={t} className="fe-pollrow"><span>{t}</span><div className="fe-pollbar"><i style={{ "--w": `${w}%` }} /></div><b>{w}%</b></div>
      ))}
      <span className="fe-heart h1">❤️</span><span className="fe-heart h2">🔥</span><span className="fe-heart h3">👍</span>
    </div>
  );
}

function TourSceneMention() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-msgline"><em>A</em><span className="fe-msg"><b>@</b>Sam how's the deck?</span></div>
      <div className="fe-msgline fe-ins"><em>M</em><span className="fe-msg">Almost done <b className="fe-at">@You</b></span></div>
      <i className="fe-mention">@Sam ➜ ring</i>
    </div>
  );
}

function TourSceneSchedule() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-msgline"><em>A</em><span className="fe-msg">Remind me to ship at 9am 📅</span></div>
      <div className="fe-clockchip fe-tick"><CalendarClock size={13} /><span>09:00 · tomorrow</span></div>
      <div className="fe-msgline fe-ins"><em>bot</em><span className="fe-msg">Scheduled ✅</span></div>
    </div>
  );
}

function TourSceneExport() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-docchip fe-glow"><FileUp size={13} /><span>room-export.html</span><em className="fe-save">💾</em></div>
      <div className="fe-docrow">· end-to-end chat · files · links</div>
      <i className="fe-mention">exported in one tap</i>
    </div>
  );
}

function TourSceneViewOnce() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-ph"><span>📸</span><i className="fe-lock"><Eye size={13} /></i></div>
      <i className="fe-mention">view-once · no copies</i>
    </div>
  );
}

function TourScenePush() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-notif fe-push"><Globe size={13} /><span>New message from Sam</span></div>
      <i className="fe-mention">even when the tab is closed</i>
    </div>
  );
}

function TourSceneVoiceNote() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-voiceline"><Mic size={14} /><span className="fe-wavebar"><i /><i /><i /><i /><i /></span><em>0:14</em></div>
      <i className="fe-mention">press to record, release to send</i>
    </div>
  );
}

function TourSceneSearch() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-searchbox fe-scan"><Search size={13} /><span>meeting notes</span></div>
      <div className="fe-msgline fe-ins"><em>hit</em><span className="fe-msg">…the <b>meeting notes</b> are here…</span></div>
      <i className="fe-mention">instant full-room search</i>
    </div>
  );
}

function TourSceneVoiceCall() {
  return (
    <div className="fe-scene fe-callgrid">
      <div className="fe-tile fe-you fe-t3"><span className="fe-tava">You</span></div>
      <div className="fe-tile fe-t0"><span className="fe-tava">A</span><span className="fe-wave"><i /><i /><i /></span></div>
      <div className="fe-calldock"><Phone size={12} />Voice only</div>
    </div>
  );
}

function TourSceneBg() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-bgchip fe-hue"><Palette size={13} /><span>beach-office</span></div>
      <div className="fe-tile fe-you fe-t3"><span className="fe-tava">You</span><em className="fe-bglabel">blurred</em></div>
      <i className="fe-mention">backdrop or blur on any call</i>
    </div>
  );
}

function TourSceneQR() {
  return (
    <div className="fe-scene fe-qrscene">
      <div className="fe-qr"><QrCode size={44} /></div>
    </div>
  );
}

function TourScenePresence() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-presrow"><i className="fe-dot on" />Ava · typing… <em>A</em></div>
      <div className="fe-presrow"><i className="fe-dot" />Marcus <em>M</em></div>
      <div className="fe-presrow"><i className="fe-dot on" />You <em>Y</em></div>
    </div>
  );
}

function TourSceneStealth() {
  return (
    <div className="fe-scene fe-msgscene">
      <span className="fe-msg fe-dim">🤫 someone's peeking…</span>
      <div className="fe-msgline fe-blur"><span className="fe-scr">▚▞▚▞▜▞▚</span></div>
      <i className="fe-mention">tap to blur instantly</i>
    </div>
  );
}

function TourSceneOffline() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-notif fe-reconn"><WifiOff size={13} /><span>connection dropped — reconnecting…</span></div>
      <i className="fe-mention">app shell loads instantly, auto-reconnects</i>
    </div>
  );
}

function TourSceneFast() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-fastbar"><Zap size={13} /><span className="fe-wavebar"><i /><i /><i /><i /><i /></span><em>2.1 GB/sec</em></div>
      <i className="fe-mention">huge files, instant relay</i>
    </div>
  );
}

function TourSceneTheme() {
  return (
    <div className="fe-scene fe-msgscene">
      <div className="fe-searchbox fe-theme"><Sparkles size={13} /><span>room accent · violet</span></div>
      <div className="fe-presrow"><i className="fe-dot" />everyone sees the new look</div>
    </div>
  );
}

const TOUR_SCENES = { chat: TourSceneChat, vanish: TourSceneVanish, calls: TourSceneCalls, share: TourSceneShare, watch: TourSceneWatch, board: TourSceneBoard, vault: TourSceneVault, poll: TourScenePoll, mention: TourSceneMention, schedule: TourSceneSchedule, export: TourSceneExport, viewonce: TourSceneViewOnce, push: TourScenePush, voicenote: TourSceneVoiceNote, search: TourSceneSearch, voicecall: TourSceneVoiceCall, bg: TourSceneBg, qr: TourSceneQR, presence: TourScenePresence, stealth: TourSceneStealth, offline: TourSceneOffline, fast: TourSceneFast, theme: TourSceneTheme };

function FeatureExplorer() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useMemo(() => (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ), []);
  const feat = TOUR_FEATURES[active];
  const Scene = TOUR_SCENES[feat.id];

  useEffect(() => {
    if (paused || reducedMotion) return undefined;
    const t = setInterval(() => setActive((a) => (a + 1) % TOUR_FEATURES.length), TOUR_SPEED);
    return () => clearInterval(t);
  }, [paused, reducedMotion]);

  return (
    <TourPanel onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <style>{TOUR_CSS}</style>
      <div className="fe-eyebrow">Inside AnonChat</div>
      <h3 className="fe-title">One room.<br />Everything private.</h3>

      <div className="fe-stage" key={feat.id} style={{ "--tint": feat.tint }}>
        <Scene />
        <div className="fe-blurb">{feat.blurb}</div>
      </div>

      <div className="fe-chips" role="tablist" aria-label="Feature tour">
        {TOUR_FEATURES.map((f, i) => {
          const Icon = f.icon;
          const on = i === active;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={on}
              type="button"
              className={`fe-chip ${on ? "on" : ""}`}
              style={{ "--tint": f.tint }}
              onClick={() => setActive(i)}
            >
              <Icon size={13} strokeWidth={2.4} />
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      <div className="fe-progress" aria-hidden="true">
        {!reducedMotion && <span key={`${active}-${paused}`} className="fe-prog-fill" style={{ animationDuration: paused ? "0s" : `${TOUR_SPEED}ms`, animationPlayState: paused ? "paused" : "running" }} />}
      </div>
    </TourPanel>
  );
}

const TOUR_CSS = `
.fe-eyebrow{color:var(--tint,#818cf8);font-size:.62rem;font-weight:850;letter-spacing:.14em;text-transform:uppercase;}
.fe-title{margin:.35em 0 .9em;color:var(--chakra-colors-textPrimary);font-size:clamp(1.15rem,2.4vw,1.45rem);font-weight:800;letter-spacing:-.03em;line-height:1.15;}
.fe-stage{position:relative;flex:1;border-radius:16px;border:1px solid color-mix(in srgb, var(--tint) 26%, var(--chakra-colors-border));background:
 radial-gradient(120% 140% at 85% -10%, color-mix(in srgb, var(--tint) 18%, transparent), transparent 55%),
 radial-gradient(90% 120% at 8% 100%, color-mix(in srgb, var(--tint) 12%, transparent), transparent 60%),
 var(--chakra-colors-badgeBg);
 min-height:196px;display:flex;flex-direction:column;justify-content:center;padding:18px;overflow:hidden;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 46px color-mix(in srgb, var(--tint) 9%, transparent);
 animation:fe-stagein .6s cubic-bezier(.22,1,.36,1) both;}
.fe-stage::before{content:"";position:absolute;inset:-45%;z-index:0;pointer-events:none;
 background:radial-gradient(34% 45% at 80% 8%, color-mix(in srgb,var(--tint) 36%,transparent), transparent 62%),
            radial-gradient(30% 42% at 12% 92%, color-mix(in srgb,var(--tint) 22%,transparent), transparent 64%);
 filter:blur(12px);opacity:.85;animation:fe-aurora 11s ease-in-out infinite alternate;}
.fe-stage::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;
 background-image:radial-gradient(rgba(255,255,255,.3) 1px, transparent 1.5px);background-size:26px 26px;
 mask-image:radial-gradient(58% 62% at 50% 46%, #000 18%, transparent 100%);-webkit-mask-image:radial-gradient(58% 62% at 50% 46%, #000 18%, transparent 100%);
 animation:fe-sparkles 32s linear infinite;}
@keyframes fe-aurora{from{transform:translate3d(-2.5%,-1.5%,0) rotate(-1.5deg) scale(.98);}to{transform:translate3d(2.5%,1.5%,0) rotate(1.5deg) scale(1.05);}}
@keyframes fe-stagein{from{opacity:0;transform:translateY(18px) scale(.972);filter:blur(5px);}55%{opacity:1;}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0);}}
@keyframes fe-sparkles{to{background-position:520px 520px;}}
.fe-blurb{position:relative;z-index:1;margin-top:14px;color:var(--chakra-colors-textSecondary);font-size:.76rem;line-height:1.5;text-align:center;animation:fe-fade .5s ease both;animation-delay:.22s;}
.fe-scene{position:relative;z-index:1;height:118px;margin:auto;animation:fe-fade .45s ease both;animation-delay:.1s;}
@keyframes fe-fade{from{opacity:0;}to{opacity:1;}}

/* scene polish */
.fe-device{animation:fe-drift 6.5s ease-in-out infinite;}
.fe-device:nth-child(3){animation-delay:-3.2s;}
@keyframes fe-drift{0%,100%{transform:translateY(0);}50%{transform:translateY(-2.5px);}}
.fe-bubble{border-color:color-mix(in srgb,var(--tint) 22%,transparent);}
.fe-bubble.fe-out::after{content:"⋯";margin-left:4px;color:var(--chakra-colors-textSecondary);opacity:.85;animation:fe-ellipsis 1.5s ease-in-out infinite;font-weight:800;}
@keyframes fe-ellipsis{0%,100%{opacity:.35;}50%{opacity:1;}}
.fe-wire::after{content:"";position:absolute;top:50%;left:0;width:100%;height:2px;transform:translateY(-50%);
 background:linear-gradient(90deg,transparent,rgba(129,140,248,.5),rgba(236,72,153,.5),transparent);opacity:.5;}
.fe-pkt{box-shadow:0 0 0 4px color-mix(in srgb,var(--tint) 12%,transparent),0 4px 16px rgba(0,0,0,.4),0 0 14px color-mix(in srgb,var(--tint) 40%,transparent);}
.fe-canvas{filter:drop-shadow(0 0 7px rgba(52,211,153,.35)) drop-shadow(0 0 3px rgba(96,165,250,.4));}
.fe-player::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.07) 50%,transparent 58%);background-size:220% 100%;
 animation:fe-scan 5.5s linear infinite;}
@keyframes fe-scan{to{background-position:-220% 0;}}
.fe-calldock{animation:fe-callpulse 3.2s ease-in-out infinite;}
@keyframes fe-callpulse{0%,100%{box-shadow:0 0 0 0 rgba(34,211,238,0);}50%{box-shadow:0 0 18px rgba(34,211,238,.28);}}

/* chat */
.fe-devices{display:flex;align-items:center;gap:10px;}
.fe-device{flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;}
.fe-ava{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:.72rem;}
.fe-bubble{max-width:100%;padding:7px 10px;border-radius:12px;font-size:.68rem;line-height:1.35;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);}
.fe-out{opacity:.85;}
.fe-in{position:relative;}
.fe-wire{position:relative;flex:.9;height:2px;background:linear-gradient(90deg,rgba(129,140,248,.5),rgba(236,72,153,.5));border-radius:2px;}
.fe-pkt{position:absolute;top:-9px;left:0;width:20px;height:20px;border-radius:7px;background:#11131c;border:1px solid rgba(255,255,255,.25);display:grid;place-items:center;color:#c7d2fe;animation:fe-travel 3.6s cubic-bezier(.45,0,.55,1) infinite;}
@keyframes fe-travel{0%{left:2%;transform:scale(.9);}46%{transform:scale(1);}54%{transform:scale(1);}100%{left:calc(100% - 24px);transform:scale(.9);}}
.fe-scr{color:#818cf8;font-size:.66rem;letter-spacing:.12em;animation:fe-swap 3.6s steps(1) infinite;}
.fe-real{position:absolute;inset:0;display:flex;align-items:center;padding:7px 10px;opacity:0;animation:fe-reveal 3.6s steps(1) infinite;}
@keyframes fe-swap{0%,44%{opacity:1;}50%,100%{opacity:0;}}
@keyframes fe-reveal{0%,48%{opacity:0;}56%,88%{opacity:1;}100%{opacity:0;}}

/* vanish */
.fe-vanish-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;}
.fe-vanish-card{position:relative;display:flex;align-items:center;gap:9px;padding:10px 14px;border-radius:13px;background:rgba(251,113,133,.08);border:1px solid rgba(251,113,133,.28);color:#fecdd3;font-size:.72rem;font-weight:600;animation:fe-dissolve 4.4s ease-in infinite;}
.fe-ring{position:absolute;top:-7px;right:-7px;width:22px;height:22px;transform:rotate(-90deg);}
.fe-ring circle{fill:none;stroke:#fb7185;stroke-width:3;stroke-linecap:round;stroke-dasharray:113;stroke-dashoffset:0;animation:fe-ringrun 4.4s linear infinite;}
@keyframes fe-ringrun{from{stroke-dashoffset:0;}to{stroke-dashoffset:-113;}}
@keyframes fe-dissolve{0%,78%{opacity:1;filter:blur(0);}92%{opacity:0;filter:blur(6px);transform:translateY(-8px);}100%{opacity:0;}}
.fe-vanish-note{color:var(--chakra-colors-textSecondary);font-size:.64rem;opacity:.75;}

/* calls */
.fe-callgrid{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr;gap:7px;}
.fe-tile{position:relative;border-radius:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);display:grid;place-items:center;}
.fe-tile.fe-you{grid-column:span 2;background:rgba(34,211,238,.10);border-color:rgba(34,211,238,.35);}
.fe-tava{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#334155,#475569);display:grid;place-items:center;color:#e2e8f0;font-size:.6rem;font-weight:800;}
.fe-t0{animation:fe-speak 5s ease-in-out infinite;}
.fe-t2{animation:fe-speak 5s ease-in-out 2.5s infinite;}
@keyframes fe-speak{0%,40%,100%{box-shadow:0 0 0 0 transparent;}12%{box-shadow:0 0 0 3px rgba(34,211,238,.55);}}
.fe-wave{position:absolute;bottom:5px;left:50%;transform:translateX(-50%);display:flex;gap:2px;}
.fe-wave i{width:3px;border-radius:2px;background:#22d3ee;animation:fe-wave 1s ease-in-out infinite;}
.fe-wave i:nth-child(2){height:9px;animation-delay:.15s;}
.fe-wave i:nth-child(1){height:6px;}
.fe-wave i:nth-child(3){height:7px;animation-delay:.3s;}
@keyframes fe-wave{0%,100%{transform:scaleY(.4);}50%{transform:scaleY(1.3);}}
.fe-calldock{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:4px 10px;border-radius:999px;background:#11131c;border:1px solid rgba(255,255,255,.14);color:#94a3b8;font-size:.58rem;font-weight:800;letter-spacing:.08em;}

/* share */
.fe-sharewrap{display:flex;flex-direction:column;gap:8px;}
.fe-winbar{display:flex;align-items:center;gap:5px;padding:7px 10px;border-radius:10px 10px 0 0;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);border-bottom:0;}
.fe-winbar i{width:7px;height:7px;border-radius:50%;background:#475569;}
.fe-winbar em{margin-left:auto;font-style:normal;font-size:.58rem;color:#94a3b8;font-weight:700;}
.fe-winbody{position:relative;height:74px;border-radius:0 0 10px 10px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(110deg,#1e293b,#334155,#1e293b);background-size:220% 100%;animation:fe-pan 5s linear infinite;overflow:hidden;}
@keyframes fe-pan{to{background-position:-220% 0;}}
.fe-cursor{position:absolute;color:#fbbf24;font-size:.9rem;text-shadow:0 2px 6px rgba(0,0,0,.6);animation:fe-glide 4.5s ease-in-out infinite;}
@keyframes fe-glide{0%{top:62%;left:8%;}45%{top:28%;left:52%;}70%{top:48%;left:78%;}100%{top:62%;left:8%;}}
.fe-live{position:absolute;top:-8px;right:-6px;padding:3px 9px;border-radius:999px;background:#dc2626;color:#fff;font-size:.56rem;font-weight:900;letter-spacing:.1em;animation:fe-blink 1.6s ease-in-out infinite;}
@keyframes fe-blink{50%{opacity:.55;}}

/* watch */
.fe-watchwrap{display:flex;flex-direction:column;gap:9px;justify-content:center;}
.fe-player{position:relative;height:86px;border-radius:12px;border:1px solid rgba(167,139,250,.32);overflow:hidden;background:
 repeating-linear-gradient(90deg,transparent 0 10px,rgba(167,139,250,.05) 10px 20px),
 linear-gradient(120deg,#171226,#2a1f4d 55%,#171226);}
.fe-film{position:absolute;inset:0;background:radial-gradient(60% 90% at 30% 40%,rgba(167,139,250,.28),transparent 65%),radial-gradient(50% 80% at 75% 65%,rgba(96,165,250,.2),transparent 60%);animation:fe-pan 6s linear infinite reverse;}
.fe-head{position:absolute;bottom:8px;left:0;width:100%;height:2px;background:rgba(255,255,255,.16);}
.fe-head::after{content:"";position:absolute;left:0;top:0;height:100%;width:38%;background:linear-gradient(90deg,#a78bfa,#c4b5fd);animation:fe-fill 5.2s ease-in-out infinite;}
.fe-ha{position:absolute;top:-19px;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:.5rem;font-weight:900;color:#fff;}
.ha1{left:36%;background:#ec4899;animation:fe-bob 2.4s ease-in-out infinite;}
.ha2{left:41%;background:#22d3ee;animation:fe-bob 2.4s ease-in-out .5s infinite;}
@keyframes fe-bob{50%{transform:translateY(-3px);}}
.fe-watchmeta{text-align:center;color:var(--chakra-colors-textSecondary);font-size:.62rem;opacity:.8;}

/* board */
.fe-boardwrap{display:flex;align-items:center;gap:12px;}
.fe-board-stage{flex:1 1 auto;min-width:0;height:104px;position:relative;}
.fe-tools{display:flex;flex-direction:column;gap:6px;padding:8px 5px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);}
.fe-tools i{width:9px;height:9px;border-radius:3px;background:#64748b;}
.fe-tools i:first-child{background:#34d399;}
.fe-canvas{position:absolute;inset:0;width:100%;height:100%;}
.fe-draw{fill:none;stroke-linecap:round;stroke-width:3.5;stroke-dasharray:420;stroke-dashoffset:420;}
.d1{stroke:#34d399;animation:fe-sketch 4.6s ease-in-out infinite;}
.d2{stroke:#60a5fa;stroke-width:2.5;stroke-dasharray:200;stroke-dashoffset:200;animation:fe-sketch2 4.6s ease-in-out .9s infinite;}
@keyframes fe-sketch{0%{stroke-dashoffset:420;}55%,82%{stroke-dashoffset:0;}100%{stroke-dashoffset:0;opacity:0;}}
@keyframes fe-sketch2{0%,20%{stroke-dashoffset:200;}65%,85%{stroke-dashoffset:0;}100%{stroke-dashoffset:0;opacity:0;}}

/* vault */
.fe-vaultwrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;}
.fe-filechip{display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:11px;background:rgba(96,165,250,.09);border:1px solid rgba(96,165,250,.3);color:#dbeafe;font-size:.66rem;font-weight:700;animation:fe-chipgo 4.4s cubic-bezier(.6,0,.4,1) infinite;}
.fe-filechip em{font-style:normal;opacity:.6;font-weight:600;}
@keyframes fe-chipgo{0%{opacity:0;transform:translateX(-34px) scale(.9);}18%,70%{opacity:1;transform:none;}100%{opacity:0;transform:translateX(34px) scale(.9);}}
.fe-vaultline{color:#60a5fa;margin-top:-26px;animation:fe-shieldpulse 4.4s ease infinite;}
@keyframes fe-shieldpulse{0%,20%,70%,100%{filter:none;}45%{filter:drop-shadow(0 0 12px rgba(96,165,250,.8));transform:scale(1.12);}}
.fe-vaultbar{width:150px;height:4px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;}
.fe-vaultbar i{display:block;height:100%;width:100%;border-radius:4px;background:linear-gradient(90deg,#60a5fa,#34d399);transform-origin:left;animation:fe-vfill 4.4s ease infinite;}
@keyframes fe-vfill{0%{transform:scaleX(0);}75%{transform:scaleX(1);background:#34d399;}100%{transform:scaleX(1);}}

/* poll */
.fe-pollwrap{display:flex;flex-direction:column;gap:7px;padding-right:26px;}
.fe-pollq{font-size:.72rem;font-weight:800;color:var(--chakra-colors-textPrimary);}
.fe-pollrow{display:flex;align-items:center;gap:8px;font-size:.62rem;color:var(--chakra-colors-textSecondary);}
.fe-pollrow span{width:52px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fe-pollrow b{width:30px;text-align:right;color:#f472b6;font-variant-numeric:tabular-nums;}
.fe-pollbar{flex:1;height:7px;border-radius:6px;background:rgba(255,255,255,.09);overflow:hidden;}
.fe-pollbar i{display:block;height:100%;width:var(--w);border-radius:6px;background:linear-gradient(90deg,#f472b6,#fb7185);transform-origin:left;animation:fe-pfill 4.8s cubic-bezier(.3,.7,.3,1) infinite;}
@keyframes fe-pfill{0%{transform:scaleX(0);}55%,90%{transform:scaleX(1);}100%{transform:scaleX(1);opacity:0;}}
.fe-heart{position:absolute;right:2px;bottom:-4px;font-size:.85rem;opacity:0;animation:fe-rise 4.8s ease-out infinite;}
.h2{animation-delay:1.1s !important;}
.h3{animation-delay:2.3s !important;}
@keyframes fe-rise{0%,12%{opacity:0;transform:translateY(0) scale(.6);}25%{opacity:.95;}55%{opacity:.7;transform:translateY(-46px) scale(1.15);}70%,100%{opacity:0;transform:translateY(-70px) scale(.9);}}

/* chips */
.fe-chips{display:flex;gap:7px;margin-top:14px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;-ms-overflow-style:none;}
.fe-chips::-webkit-scrollbar{display:none;}
.fe-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;border:1px solid var(--chakra-colors-border);background:transparent;color:var(--chakra-colors-textSecondary);font-size:.66rem;font-weight:700;cursor:pointer;transition:all .22s ease;white-space:nowrap;}
.fe-chip span{pointer-events:none;}
.fe-chip:hover{border-color:color-mix(in srgb,var(--tint) 55%,transparent);color:var(--chakra-colors-textPrimary);}
.fe-chip.on{border-color:color-mix(in srgb,var(--tint) 70%,transparent);background:color-mix(in srgb,var(--tint) 14%,transparent);color:#fff;box-shadow:0 0 14px color-mix(in srgb,var(--tint) 25%,transparent);}
.fe-progress{height:2px;border-radius:2px;background:rgba(255,255,255,.07);margin-top:12px;overflow:hidden;}
.fe-prog-fill{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--tint),#fff3);transform-origin:left;animation-name:fe-prog;animation-timing-function:linear;animation-fill-mode:forwards;}
@keyframes fe-prog{from{transform:scaleX(0);}to{transform:scaleX(1);}}

/* expanded tour scenes */
.fe-msgscene{display:flex;flex-direction:column;gap:8px;padding:4px 0;}
.fe-msgline{display:flex;align-items:center;gap:7px;font-size:.72rem;color:var(--chakra-colors-textPrimary);}
.fe-msgline em{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;font-style:normal;font-size:.6rem;font-weight:800;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6);}
.fe-msgline.fe-ins em{background:linear-gradient(135deg,#ec4899,#f43f5e);}
.fe-msg{background:rgba(255,255,255,.06);border:1px solid var(--chakra-colors-border);padding:5px 9px;border-radius:10px;}
.fe-msg b{color:var(--tint,#818cf8);}
.fe-msg .fe-at{background:color-mix(in srgb,var(--tint) 20%,transparent);border-radius:5px;padding:0 3px;}
.fe-mention{font-style:normal;font-size:.6rem;color:var(--chakra-colors-textSecondary);opacity:.85;}
.fe-clockchip,.fe-docchip,.fe-notif,.fe-searchbox,.fe-fastbar{display:inline-flex;align-items:center;gap:6px;font-size:.68rem;color:var(--chakra-colors-textPrimary);background:rgba(255,255,255,.06);border:1px solid var(--chakra-colors-border);padding:6px 9px;border-radius:10px;}
.fe-docrow,.fe-presrow{font-size:.66rem;color:var(--chakra-colors-textSecondary);}
.fe-presrow{display:flex;align-items:center;gap:6px;}
.fe-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.2);display:inline-block;}
.fe-dot.on{background:#22c55e;box-shadow:0 0 8px #22c55e55;}
.fe-ph{position:relative;width:56px;height:56px;border-radius:12px;display:grid;place-items:center;font-size:1.4rem;background:linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid var(--chakra-colors-border);}
.fe-lock{position:absolute;right:-6px;top:-6px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#f59e0b;color:#111;}
.fe-voiceline{display:inline-flex;align-items:center;gap:8px;font-size:.68rem;color:var(--chakra-colors-textPrimary);background:rgba(255,255,255,.06);border:1px solid var(--chakra-colors-border);padding:7px 10px;border-radius:14px;}
.fe-voiceline .fe-wavebar{display:inline-flex;align-items:center;gap:2px;}
.fe-wavebar i{width:3px;height:14px;border-radius:2px;background:linear-gradient(180deg,#ec4899,#f43f5e);animation:fe-wave 1s ease-in-out infinite;display:inline-block;}
.fe-wavebar i:nth-child(2){animation-delay:.15s}.fe-wavebar i:nth-child(3){animation-delay:.3s}.fe-wavebar i:nth-child(4){animation-delay:.45s}.fe-wavebar i:nth-child(5){animation-delay:.6s}
@keyframes fe-wave{0%,100%{transform:scaleY(.5);}50%{transform:scaleY(1);}}
.fe-qr{width:56px;height:56px;border-radius:10px;display:grid;place-items:center;background:#fff;color:#111;}
.fe-qrscene{display:grid;place-items:center;padding:4px 0;}
.fe-qrscene .fe-qr{width:116px;height:116px;border-radius:22px;}
.fe-qrscene .fe-qr svg{width:76px;height:76px;}
.fe-msg .fe-at{display:inline-block;animation:fe-atpulse 2.4s ease-in-out infinite;}
@keyframes fe-atpulse{0%,100%{color:#fff;}50%{color:#c4b5fd;box-shadow:0 0 12px rgba(139,92,246,.55);}}
.fe-tick{animation:fe-tick 2.2s ease-in-out infinite;}
@keyframes fe-tick{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
.fe-glow{animation:fe-glow 3.2s ease-in-out infinite;}
@keyframes fe-glow{0%,100%{box-shadow:0 0 0 rgba(16,185,129,0);}50%{box-shadow:0 0 18px rgba(16,185,129,.32);}}
.fe-push{animation:fe-blink 2.8s ease-in-out infinite;}
@keyframes fe-blink{0%,100%{opacity:1;}50%{opacity:.55;}}
.fe-reconn{animation:fe-reconn 2.6s ease-in-out infinite;}
@keyframes fe-reconn{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}
.fe-scan{position:relative;overflow:hidden;animation:fe-scanborder 2.8s ease-in-out infinite;}
@keyframes fe-scanborder{0%,100%{border-color:rgba(99,102,241,.35);}50%{border-color:rgba(99,102,241,.75);}}
.fe-scan::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(99,102,241,.3),transparent);transform:translateX(-100%);animation:fe-scan 2.4s ease-in-out infinite;}
@keyframes fe-scan{0%{transform:translateX(-100%);}60%,100%{transform:translateX(100%);}}
.fe-theme{animation:fe-themeglow 4.5s ease-in-out infinite;}
@keyframes fe-themeglow{0%,100%{box-shadow:0 0 0 rgba(167,139,250,0);}50%{box-shadow:0 0 20px rgba(217,70,239,.4);}}
.fe-hue{animation:fe-bg 3.4s ease-in-out infinite;}
@keyframes fe-bg{0%,100%{border-color:rgba(168,85,247,.35);}50%{border-color:rgba(236,72,153,.6);}}
.fe-presrow .fe-dot.on{animation:fe-dotring 2.2s ease-out infinite;}
@keyframes fe-dotring{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55);}70%,100%{box-shadow:0 0 0 8px rgba(34,197,94,0);}}
.fe-ph .fe-lock{animation:fe-lock 2.6s ease-in-out infinite;}
@keyframes fe-lock{0%,100%{transform:scale(1);}50%{transform:scale(1.12);}}
.fe-qrscene .fe-qr{animation:fe-qrbreathe 3s ease-in-out infinite;}
@keyframes fe-qrbreathe{0%,100%{box-shadow:0 0 0 rgba(239,68,68,0);}50%{box-shadow:0 0 26px rgba(239,68,68,.38);}}
.fe-bgchip{display:inline-flex;align-items:center;gap:6px;font-size:.66rem;color:var(--chakra-colors-textPrimary);background:rgba(255,255,255,.06);border:1px solid var(--chakra-colors-border);padding:6px 9px;border-radius:10px;margin-bottom:6px;}
.fe-bglabel{font-style:normal;font-size:.55rem;color:var(--chakra-colors-textSecondary);}
.fe-blur{filter:blur(5px)!important;opacity:.7;}
.fe-msgline.fe-blur .fe-scr{font-size:.8rem;letter-spacing:.05em;}
.fe-dim{opacity:.6;}
.fe-save{font-style:normal;}
@media (min-width:${BREAKPOINTS.xl}px){
  .fe-title{font-size:clamp(1.35rem,2.4vw,1.75rem);}
  .fe-blurb{font-size:.84rem;}
  .fe-scene{height:236px;}
  .fe-devices,.fe-callgrid,.fe-sharewrap,.fe-watchwrap,.fe-boardwrap,.fe-pollwrap{width:100%;}
  .fe-vanish-wrap,.fe-sharewrap,.fe-watchwrap,.fe-vaultwrap,.fe-pollwrap{justify-content:center;}
  .fe-boardwrap{justify-content:flex-start;}
  .fe-msgscene{align-items:center;justify-content:center;}
  .fe-msgscene>*{max-width:100%;}
  .fe-devices{gap:20px;}
  .fe-devices{gap:20px;}
  .fe-device{gap:14px;}
  .fe-ava{width:58px;height:58px;border-radius:16px;font-size:1.08rem;}
  .fe-bubble{padding:13px 18px;border-radius:16px;font-size:.92rem;}
  .fe-real{padding:13px 18px;}
  .fe-pkt{width:36px;height:36px;border-radius:10px;}
  .fe-pkt svg{width:17px;height:17px;}
  .fe-wire{height:3px;}
  .fe-scr,.fe-real{font-size:.8rem;}
  .fe-callgrid{gap:12px;}
  .fe-tile{border-radius:16px;}
  .fe-tava{width:50px;height:50px;font-size:1rem;}
  .fe-wave i{width:5px;}
  .fe-calldock{font-size:.7rem;padding:8px 14px;gap:10px;}
  .fe-winbar{padding:9px 12px;}
  .fe-winbar i{width:9px;height:9px;}
  .fe-winbar em{font-size:.7rem;}
  .fe-winbody{height:120px;}
  .fe-cursor{font-size:1.2rem;}
  .fe-live{font-size:.64rem;padding:4px 10px;}
  .fe-player{height:180px;border-radius:16px;}
  .fe-ha{width:24px;height:24px;font-size:.7rem;}
  .fe-watchmeta{font-size:.7rem;}
  .fe-boardwrap{position:relative;}
  .fe-board-stage{position:absolute;top:36px;bottom:36px;left:44px;right:0;flex:none;width:auto;height:auto;}
  .fe-draw{stroke-width:4.5;}
  .fe-tools{gap:8px;padding:11px 8px;}
  .fe-tools i{width:12px;height:12px;}
  .fe-filechip{padding:13px 18px;border-radius:14px;gap:10px;font-size:.86rem;}
  .fe-vaultbar{width:250px;height:6px;}
  .fe-vaultline svg{width:42px;height:42px;}
  .fe-pollq{font-size:.98rem;}
  .fe-pollrow{font-size:.78rem;}
  .fe-pollbar{height:11px;}
  .fe-pollrow span{width:78px;}
  .fe-pollrow b{width:46px;}
  .fe-msgscene{gap:14px;}
  .fe-ph{width:92px;height:92px;border-radius:18px;font-size:2rem;}
  .fe-lock{width:28px;height:28px;}
  .fe-lock svg{width:18px;height:18px;}
  .fe-msgline{gap:10px;font-size:.86rem;}
  .fe-msgline em{width:34px;height:34px;font-size:.86rem;}
  .fe-msg{padding:12px 16px;border-radius:13px;font-size:.9rem;}
  .fe-mention{font-size:.74rem;}
  .fe-notif,.fe-searchbox,.fe-fastbar,.fe-clockchip,.fe-docchip,.fe-bgchip,.fe-voiceline{font-size:.86rem;padding:12px 16px;border-radius:14px;gap:9px;}
  .fe-wavebar i,.fe-fastbar .fe-wavebar i{width:5px;height:20px;}
  .fe-vanish-card{padding:18px 24px;border-radius:18px;gap:13px;font-size:.94rem;}
  .fe-vanish-card svg{width:26px;height:26px;}
  .fe-ring{width:36px;height:36px;}
  .fe-vanish-note{font-size:.74rem;}
  .fe-qr{width:92px;height:92px;border-radius:15px;}
  .fe-qr svg{width:54px !important;height:54px !important;}
  .fe-qrscene{display:grid;}
  .fe-qrscene .fe-qr{width:132px;height:132px;border-radius:24px;}
  .fe-qrscene .fe-qr svg{width:88px !important;height:88px !important;}
  .fe-presrow{font-size:.82rem;}
  .fe-dot{width:10px;height:10px;}
}
@media (min-width:1440px){
  .fe-scene{height:282px;}
  .fe-ava{width:66px;height:66px;font-size:1.2rem;}
  .fe-tava{width:54px;height:54px;}
  .fe-bubble{font-size:.98rem;padding:15px 20px;}
  .fe-real{padding:15px 20px;}
  .fe-player{height:205px;}
}
@media (prefers-reduced-motion: reduce){
  .fe-stage{animation:none;}
  .fe-stage *, .fe-prog-fill{animation:none !important;}
  .fe-stage::before, .fe-stage::after{animation:none !important;}
}
`;

const TourPanel = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100vw - 32px));
  padding: clamp(22px, 3vw, 36px);
  border-radius: 22px;
  background: var(--chakra-colors-surface);
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  border: 1px solid var(--chakra-colors-border);
  box-shadow: 0 4px 30px rgba(0,0,0,.15), 0 25px 60px rgba(0,0,0,.25), inset 0 1px 0 var(--chakra-colors-borderSubtle);
  animation: fade-in-up .7s cubic-bezier(.16,1,.3,1) both;
  animation-delay: .25s;
  box-sizing: border-box;

  @media (min-width: 1100px) {
    flex: 6 1 0;
    width: auto;
    max-width: none;
    min-width: 0;
  }
`;


const FEATURE_CATALOG = [
  {
    group: "Messaging core",
    icon: MessagesSquare,
    tint: "#818cf8",
    blurb: "Everything you expect from a chat — private by default.",
    items: [
      "End-to-end encrypted chat",
      "Vanishing messages (5m up to 90 days)",
      "View-once photos & videos",
      "Reply · Edit · Delete · Forward · Copy",
      "Emoji reactions",
      "Typing indicators + read receipts",
      "@mentions with autocomplete",
      "Polls & live voting",
      "Message search & pinned messages",
      "Scheduled messages",
      "Voice message recording",
      "GIF picker · code blocks · link previews",
      "Chat export as HTML",
      "QR-code room sharing",
      "Unread badge + jump to bottom",
      "Bookmarked / starred messages",
      "Custom notification sounds",
      "Client-side word filter"
    ]
  },
  {
    group: "Files & media",
    icon: FolderLock,
    tint: "#60a5fa",
    blurb: "Encrypted on your device before anything leaves it.",
    items: [
      "Encrypted files — any type, sealed before upload",
      "Realtime large-file relay (100MB+ practical, 100GB hard cap)",
      "Universal viewer: PDF, docs, audio/video, PiP",
      "Gallery left/right media navigation",
      "Client-side image compression"
    ]
  },
  {
    group: "Calls & meetings",
    icon: Video,
    tint: "#22d3ee",
    blurb: "Crystal-clear groups with a toolkit for fun and focus.",
    items: [
      "HD group video calls (grid / spotlight / theater)",
      "Voice-only calls",
      "Screen sharing",
      "Video & Audio filters",
      "Voice changer",
      "Call recording",
      "Floating emoji reactions in-call",
      "Watch parties — synced co-watch",
      "Collaborative whiteboard"
    ]
  }
];

const FeatureCatalog = () => {
  return (
    <>
      <style>{CATALOG_CSS}</style>
      <section className="cat-section">
        <header className="cat-header">
          <div className="cat-eyebrow">Everything inside AnonChat</div>
          <h3 className="cat-title">One room. Every tool you need.</h3>
          <p className="cat-sub">Messaging, files and calls — ready the moment you join. Encrypted by default and covered end-to-end.</p>
        </header>
        <div className="cat-grid">
          {FEATURE_CATALOG.map((g) => {
            const Icon = g.icon;
            return (
              <article className="cat-card" key={g.group} style={{ "--tint": g.tint }}>
                <div className="cat-head">
                  <span className="cat-head-icon"><Icon size={18} strokeWidth={2.2} /></span>
                  <div>
                    <div className="cat-group-name">{g.group}</div>
                    <div className="cat-group-count">{g.items.length} features</div>
                  </div>
                </div>
                <p className="cat-blurb">{g.blurb}</p>
                <ul className="cat-features">
                  {g.items.map((it) => (
                    <li key={it}>
                      <span className="cat-check" aria-hidden="true"><Check size={11} strokeWidth={3.2} /></span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <div className="cat-closer">
          <span className="cat-join-ring"><ArrowRight size={16} strokeWidth={2.4} /></span>
          <span>Join with just a room ID and a security code — no sign-up, ever.</span>
        </div>
      </section>
    </>
  );
};

const CATALOG_CSS = `
.cat-section{display:flex;flex-direction:column;gap:clamp(16px,3vw,26px);width:100%;margin-top:clamp(26px,5vw,44px);border-top:1px solid rgba(255,255,255,.05);padding-top:clamp(24px,4vw,38px);box-sizing:border-box;}
.cat-eyebrow{color:var(--chakra-colors-brandPrimary);font-size:.66rem;font-weight:850;letter-spacing:.15em;text-transform:uppercase;}
.cat-title{margin:.35em 0 0;color:var(--chakra-colors-textPrimary);font-size:clamp(1.3rem,3vw,1.8rem);font-weight:850;letter-spacing:-.03em;}
.cat-sub{margin:.5em 0 0;color:var(--chakra-colors-textSecondary);font-size:clamp(.8rem,1.8vw,.9rem);line-height:1.55;max-width:70ch;}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px;}
@media (min-width:${BREAKPOINTS.xl}px){
  .cat-grid{display:flex;gap:18px;justify-content:center;}
  .cat-card{flex:1 1 0;min-width:0;}
}
.cat-card{position:relative;display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:18px;box-sizing:border-box;
 background:linear-gradient(160deg,color-mix(in srgb,var(--tint) 9%,transparent),transparent 40%),var(--chakra-colors-surface);
 border:1px solid var(--chakra-colors-border);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);
 box-shadow:0 10px 34px rgba(0,0,0,.22),inset 0 1px 0 var(--chakra-colors-borderSubtle);
 transition:transform .22s cubic-bezier(.16,1,.3,1),border-color .22s ease,box-shadow .22s ease;}
.cat-card:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--tint) 45%,transparent);box-shadow:0 18px 44px rgba(0,0,0,.3),0 0 0 1px color-mix(in srgb,var(--tint) 18%,transparent),0 0 30px color-mix(in srgb,var(--tint) 14%,transparent);}
.cat-card::before{content:"";position:absolute;top:0;left:14px;right:14px;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--tint) 70%,transparent),transparent);}
.cat-head{display:flex;align-items:center;gap:11px;}
.cat-head-icon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0;
 background:color-mix(in srgb,var(--tint) 16%,transparent);border:1px solid color-mix(in srgb,var(--tint) 30%,transparent);color:#fff;box-shadow:0 0 18px color-mix(in srgb,var(--tint) 22%,transparent);}
.cat-group-name{color:var(--chakra-colors-textPrimary);font-size:.92rem;font-weight:800;letter-spacing:-.01em;}
.cat-group-count{color:var(--chakra-colors-textSecondary);font-size:.66rem;font-weight:650;margin-top:1px;}
.cat-blurb{margin:0;color:var(--chakra-colors-textSecondary);font-size:.74rem;line-height:1.5;padding-bottom:4px;border-bottom:1px solid var(--chakra-colors-border);}
.cat-features{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;}
.cat-features li{display:flex;align-items:flex-start;gap:8px;color:var(--chakra-colors-textPrimary);font-size:.77rem;line-height:1.35;font-weight:560;}
.cat-check{flex-shrink:0;margin-top:2px;width:16px;height:16px;border-radius:5px;display:grid;place-items:center;
 background:color-mix(in srgb,var(--tint) 22%,transparent);border:1px solid color-mix(in srgb,var(--tint) 45%,transparent);color:#fff;}
.cat-closer{display:flex;align-items:center;gap:11px;justify-content:center;flex-wrap:wrap;color:var(--chakra-colors-textSecondary);font-size:.8rem;font-weight:650;text-align:center;margin-top:4px;}
.cat-join-ring{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;
 background:linear-gradient(135deg,var(--chakra-colors-brandPrimary),var(--chakra-colors-brandAccent,var(--chakra-colors-brandSecondary)));color:#fff;box-shadow:0 6px 18px color-mix(in srgb,var(--chakra-colors-brandPrimary) 45%,transparent);}
@media (max-width:${BREAKPOINTS.md}px){.cat-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));}.cat-closer{padding:0 6px;}}
@media (max-width:${BREAKPOINTS.sm}px){.cat-grid{grid-template-columns:1fr;}}
@media (prefers-reduced-motion:reduce){.cat-card{transition:none;}.cat-card:hover{transform:none;}}
`;

const LandingGrid = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 26px;
  width: 100%;
  padding: 0 16px;
  box-sizing: border-box;

  @media (min-width: 1100px) {
    flex-direction: row;
    align-items: stretch;
    gap: clamp(28px, 3.5vw, 44px);
  }
`;


// Platform-aware aspect ratio for media embeds and file uploads
const getMediaAspectRatio = (sourceStr = "", fileType = "") => {
  const str = sourceStr.toLowerCase();
  if (str.includes("snap") || str.includes("tiktok")) return "9 / 16";
  if (str.includes("instagram") || str.includes("insta")) return "4 / 5";
  if (str.includes("youtube") || str.includes("youtu.be") || str.includes("vimeo")) return "16 / 9";
  if (str.includes("twitter") || str.includes("x.com")) return "16 / 9";
  if (str.includes("reddit")) return "16 / 9";
  if (fileType && fileType.startsWith("video")) return "16 / 9";
  return "16 / 9";
};

const getFileType = (file) => {
  if (!file) return "";
  let type = (file.type || "").toLowerCase();
  if (!type || type === "application/octet-stream" || type === "binary/oct-stream") {
    const ext = (file.name || "").split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "heif"].includes(ext)) {
      return "image/" + (ext === "jpg" ? "jpeg" : ext);
    }
    if (["mp4", "webm", "ogg", "mov", "avi", "mkv", "flv", "3gp"].includes(ext)) {
      return "video/" + (ext === "mov" ? "quicktime" : ext);
    }
    if (["mp3", "wav", "ogg", "m4a", "aac", "flac", "webm"].includes(ext)) {
      return "audio/" + (ext === "m4a" ? "mp4" : ext);
    }
  }
  return type;
};

// Security code validation is handled server-side to support per-room passwords

const urlRegex = /(https?:\/\/[^\s]+)/g;

// Inline clipboard helper for exported HTML (works on http + https).
// Lazily defines window.__cbCopy on first click, then reuses it.
const INLINE_CLIPBOARD_FALLBACK =
  "(window.__cbCopy||(window.__cbCopy=function(t){try{if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(t);var a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.position='fixed';a.style.top='-9999px';a.style.left='-9999px';document.body.appendChild(a);a.select();document.execCommand('copy');document.body.removeChild(a);}catch(e){}}))";

/* ================= STYLES ================= */

const colorPalette = [
  "#FF5722",
  "#4CAF50",
  "#2196F3",
  "#9C27B0",
  "#FFC107",
  "#00BCD4",
  "#E91E63",
  "#8BC34A",
  "#FF9800",
  "#3F51B5",
];

const glow = keyframes`
  0% { opacity: .4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: .4; transform: scale(1); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const scaleUp = keyframes`
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const popIn = keyframes`
  0% { opacity: 0; transform: scale(0.96) translateY(18px); }
  60% { opacity: 1; transform: scale(1.02) translateY(-4px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
`;

const LiveBadge = styled.div`
  background: #ff4757;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
  animation: ${glow} 1.5s infinite;
  display: flex;
  align-items: center;
  gap: 4px;
`;



const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--chakra-colors-bg);
  box-sizing: border-box;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 16px;
  min-height: 52px;
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: var(--chakra-colors-textPrimary);
  border-bottom: 1px solid var(--chakra-colors-border);
  box-sizing: border-box;
  z-index: 10;
  flex-shrink: 0;

  @media (max-width: ${BREAKPOINTS.sm}px) {
    padding: 6px 10px;
    min-height: 46px;
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    padding: 6px 8px;
    min-height: 42px;
  }
`;

const Avatar = styled.img`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  margin-right: 8px;
  border: 1.5px solid var(--chakra-colors-border);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;

  @media (max-width: ${BREAKPOINTS.sm}px) {
    width: 26px;
    height: 26px;
    margin-right: 6px;
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    width: 24px;
    height: 24px;
    margin-right: 5px;
  }
`;

const RoomActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: clamp(8px, 2vw, 14px);
  flex-wrap: nowrap;
  flex-shrink: 1;
  min-width: 0;
  max-width: 100%;
  /* Safety valve on tiny screens: the actions box squeezes to the free header
     width and scrolls its content horizontally, so buttons/LIVE stay on the
     same line as the room number without spilling or colliding. */
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar { display: none; }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    gap: 6px;
    padding-bottom: 2px;
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    gap: 4px;
  }
`;

const ActionButton = styled.button`
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-badgeBorder);
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  font-size: 1rem;
  min-width: 34px;
  min-height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    border-color: var(--chakra-colors-brandPrimary);
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    font-size: 0.92rem;
    min-width: 30px;
    min-height: 30px;
    border-radius: 8px;
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    font-size: 0.85rem;
    min-width: 28px;
    min-height: 28px;
    border-radius: 7px;
  }
`;

const MessageContainer = styled.div`
  flex: 1;
  padding: clamp(12px, 3vw, 24px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.15) 100%);

  @media (max-width: ${BREAKPOINTS.md}px) {
    padding: 10px;
    gap: 8px;
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    padding: 8px;
    gap: 6px;
  }
`;

const MessageBubble = styled.div`
  max-width: ${(p) => (p.$isSystem ? "80%" : "clamp(70%, 80vw, 80%)")};
  padding: ${(p) => (p.$isSystem ? "6px 14px" : p.$isFile ? "0" : "10px 14px")};
  touch-action: pan-y;
  will-change: transform;

  background: ${(p) =>
    p.$isSystem ? "transparent" :
      p.$isSender ? "linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary))" :
        "var(--chakra-colors-badgeBg)"};
  
  backdrop-filter: ${(p) => (p.$isSystem ? "none" : p.$isSender ? "none" : "blur(16px)")};
  -webkit-backdrop-filter: ${(p) => (p.$isSystem ? "none" : p.$isSender ? "none" : "blur(16px)")};

  border: ${(p) =>
    p.$isSystem ? "none" :
      p.$isSender ? "0.5px solid rgba(255,255,255,0.08)" :
        "0.5px solid var(--chakra-colors-border)"};

  border-radius: ${(p) =>
    p.$isSystem ? "12px" :
      p.$isSender ? "22px 22px 4px 22px" :
        "22px 22px 22px 4px"};

  box-shadow: ${(p) => p.$isSystem ? "none" : "0 8px 24px rgba(0,0,0,0.15)"};

  align-self: ${(p) =>
    p.$isSystem ? "center" : p.$isSender ? "flex-end" : "flex-start"};

  color: ${(p) =>
    p.$isSystem ? (p.$systemType === "join" ? "#2ecc71" : p.$systemType === "ephemeral-change" ? "#e0a030" : "#e74c3c") :
      p.$isSender ? "#fff" :
        "var(--chakra-colors-textPrimary)"};

  font-size: ${(p) => (p.$isSystem ? "0.8rem" : "clamp(0.92rem, 0.25vw + 0.88rem, 1.05rem)")};
  font-style: ${(p) => (p.$isSystem ? "italic" : "normal")};
  opacity: ${(p) => (p.$isSystem ? 0.85 : 1)};
  text-align: left;
  position: relative;
  word-wrap: break-word;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: ${(p) => (p.$isSystem || p.$isFile ? "none" : "translateY(-1px)")};
    box-shadow: ${(p) => p.$isSystem || p.$isFile ? "none" : "0 10px 30px rgba(0,0,0,0.25)"};
  }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    max-width: ${(p) => (p.$isSystem ? "90%" : "86%")};
    padding: ${(p) => (p.$isSystem ? "4px 10px" : p.$isFile ? "8px" : "7px 11px")};
    font-size: ${(p) => (p.$isSystem ? "0.75rem" : "0.92rem")};
    border-radius: ${(p) =>
    p.$isSystem ? "10px" :
      p.$isSender ? "14px 14px 4px 14px" :
        "14px 14px 14px 4px"};
    box-shadow: ${(p) => p.$isSystem ? "none" : "0 3px 10px rgba(0,0,0,0.12)"};
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    max-width: ${(p) => (p.$isSystem ? "95%" : "90%")};
    padding: ${(p) => (p.$isSystem ? "4px 8px" : p.$isFile ? "6px" : "6px 10px")};
    font-size: ${(p) => (p.$isSystem ? "0.72rem" : "0.88rem")};
    border-radius: ${(p) =>
    p.$isSystem ? "9px" :
      p.$isSender ? "13px 13px 4px 13px" :
        "13px 13px 13px 4px"};
  }

  ${p => p.$isFile && `
    width: min(78vw, 480px);
    max-width: min(78vw, 480px);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding: 0 !important;
    overflow: hidden;

    /* media-first: no bubble chrome around attachments */
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-radius: 16px !important;
  `}

  ${p => p.$highlighted && `
    animation: chakraMsgHighlight 2.4s cubic-bezier(0.4, 0, 0.2, 1);
    @keyframes chakraMsgHighlight {
      0%, 100% { outline: 0 solid transparent; outline-offset: 0; }
      10% { outline: 4px solid rgba(16, 185, 129, 0.9); outline-offset: 3px; }
      35% { outline-color: rgba(16, 185, 129, 0.55); }
      82% { outline-color: rgba(16, 185, 129, 0.3); }
    }
  `}
`;

const Username = styled.div`
  font-size: 0.75rem;
  font-weight: bold;
  color: ${(p) => p.color};
  margin-bottom: 4px;
`;

const Timestamp = styled.div`
  font-size: 0.65rem;
  color: var(--chakra-colors-textSecondary);
  text-align: right;
  margin-top: 4px;
`;

const FileAttachmentWrapper = styled.div`
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  border-radius: 16px;
  overflow: hidden;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    border-color: var(--chakra-colors-brandPrimary);
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  }

  .expand-btn {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }
  
  &:hover .expand-btn, &:focus-within .expand-btn {
    opacity: 1;
    pointer-events: auto;
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    .expand-btn {
      opacity: 0.75 !important;
      pointer-events: auto !important;
    }
  }

`;

const BubbleActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid ${(p) => p.$active ? "rgba(255, 165, 0, .25)" : "var(--chakra-colors-border)"};
  background: ${(p) => p.$active ? "rgba(255, 165, 0, .1)" : "var(--chakra-colors-badgeBg)"};
  color: ${(p) => p.$active ? "#ffa500" : "var(--chakra-colors-textSecondary)"};
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  flex-shrink: 0;
  font-size: 0.85rem;

  &:hover {
    background: ${(p) => p.$danger ? "var(--chakra-colors-dangerBg)" : p.$active ? "rgba(255, 165, 0, 0.18)" : "var(--chakra-colors-surfaceHover)"};
    color: ${(p) => p.$danger ? "var(--chakra-colors-danger)" : p.$active ? "#ffa500" : "var(--chakra-colors-brandPrimary)"};
    border-color: ${(p) => p.$danger ? "var(--chakra-colors-dangerBorder)" : p.$active ? "rgba(255, 165, 0, 0.35)" : "var(--chakra-colors-brandPrimary)"};
    transform: translateY(-1.5px) scale(1.05);
  }

  @media (max-width: ${BREAKPOINTS.md}px) {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;

    svg {
      width: 12px;
      height: 12px;
    }
  }

  &:active {
    transform: scale(0.95);
  }

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    background: rgba(15, 15, 25, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.07);
    color: #fff;
    padding: 5px 9px;
    border-radius: 8px;
    font-size: 0.68rem;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 100;
  }

  &:hover::after {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`;

const TypingIndicator = styled.div`
  position: sticky;
  bottom: 10px;

  align-self: flex-start;
  margin-top: auto;

  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid var(--chakra-colors-border);

  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(6px);

  font-size: 0.8rem;
  color: var(--chakra-colors-textSecondary);

  animation: ${glow} 1.5s infinite;

  z-index: 50;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.4);
`;

/* ── Whisper Network: signals crossing the dark ──
   One lightweight canvas replaces the old blurred aurora/star/orbit stack:
   identity-less nodes drift silently, faint lines bind neighbours, and
   light pulses travel between them — messages with no sender, no face,
   no trace. Single rAF loop, DPR-capped at 1.5, pauses when the tab is
   hidden, and renders a single static frame under prefers-reduced-motion. */


const LandingWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-height: 100dvh;
  height: auto;
  padding: 52px 20px 60px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #08090d 0%, #0c0d14 40%, #0e1018 100%);
  overflow-x: clip;
  overflow-y: visible;
  isolation: isolate;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
    background-size: 48px 48px;
    background-position: center;
    pointer-events: none;
    z-index: -1;
  }

  @media (min-width: ${BREAKPOINTS.md}px) {
    padding-top: 96px;
  }
  @media (max-width: ${BREAKPOINTS.sm}px) {
    padding: 54px 16px 48px;
    &::before { background-size: 36px 36px; }
  }
  @media (max-width: ${BREAKPOINTS.xs}px) {
    padding: 52px 12px 40px;
    &::before { background-size: 28px 28px; }
  }
`;

const LandingBrandbar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: clamp(48px, 7vh, 60px);
  padding: 0 clamp(16px, 5vw, 64px);
  box-sizing: border-box;
  pointer-events: none;

  .lb-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    pointer-events: auto;
    animation: fade-in-up .7s cubic-bezier(.16,1,.3,1) both;
  }

  .lb-mark {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: #fff;
    flex-shrink: 0;
    background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
    box-shadow: 0 4px 16px color-mix(in srgb, var(--chakra-colors-brandPrimary) 45%, transparent);
  }

  .lb-name {
    color: var(--chakra-colors-textPrimary);
    font-size: .95rem;
    font-weight: 800;
    letter-spacing: -.02em;
    line-height: 1;
  }

  .lb-version {
    color: var(--chakra-colors-textSecondary);
    font-size: .6rem;
    font-weight: 750;
    letter-spacing: .14em;
    text-transform: uppercase;
    padding: 3px 7px;
    border-radius: 999px;
    border: 1px solid var(--chakra-colors-border);
    background: color-mix(in srgb, var(--chakra-colors-surface) 70%, transparent);
  }

  .lb-tag {
    display: block;
    margin-top: 3px;
    color: var(--chakra-colors-textSecondary);
    font-size: .68rem;
    font-weight: 600;
    opacity: .82;
  }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    justify-content: center;
    padding: 0 12px;
    .lb-tag { display: none; }
  }
`;


const ShimmerTitle = styled.span`
  color: var(--chakra-colors-textPrimary);
  letter-spacing: -0.02em;
`;

/* Subtle glow behind the join card — no animation, no beacon */
const CardHalo = styled.div`
  position: absolute;
  inset: -40px;
  border-radius: 40px;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--chakra-colors-brandPrimary) 14%, transparent) 0%, transparent 70%);
  filter: blur(50px);
  opacity: 0.6;

  @media (max-width: ${BREAKPOINTS.md}px) {
    inset: -28px;
    filter: blur(36px);
  }
`;

const JoinContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 440px;
  background: var(--chakra-colors-surface);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: clamp(24px, 4vw, 36px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 12px 40px rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
  z-index: 2;
  position: relative;

  @media (max-width: ${BREAKPOINTS.sm}px) {
    width: 100%;
    padding: 22px 20px;
    border-radius: 16px;
  }

  @media (min-width: 1100px) {
    flex: 4 1 0;
    max-width: none;
    min-width: 0;
  }
`;

const JoinInput = styled.input`
  grid-row: 2;
  grid-column: 1;
  width: 100%;
  box-sizing: border-box;
  min-height: 46px;
  padding: 12px 14px 12px 42px;
  border-radius: 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 0.92rem;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.045);
  }

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(255, 255, 255, 0.05);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--chakra-colors-brandPrimary) 18%, transparent);
  }

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    opacity: 0.6;
  }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    padding: 10px 14px 10px 42px;
    font-size: 0.9rem;
    min-height: 42px;
    border-radius: 10px;
  }
`;

const JoinField = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 7px;
`;

const JoinLabel = styled.label`
  color: var(--chakra-colors-textSecondary);
  font-size: .78rem;
  font-weight: 750;
  letter-spacing: .015em;
`;

const FieldIcon = styled.span`
  /* Shares the input's grid cell — self-centers vertically at any height */
  grid-row: 2;
  grid-column: 1;
  justify-self: start;
  align-self: stretch;
  display: flex;
  align-items: center;
  margin-left: 15px;
  color: var(--chakra-colors-textSecondary);
  pointer-events: none;
  z-index: 1;
`;

const AvatarPicker = styled.label`
  min-height: 50px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 11px;
  cursor: pointer;
  color: var(--chakra-colors-textPrimary);
  background: var(--chakra-colors-badgeBg);
  border: 1px dashed var(--chakra-colors-border);
  transition: border-color .2s ease, background .2s ease;
  &:hover, &:focus-within { border-color: var(--chakra-colors-brandPrimary); background: var(--chakra-colors-surfaceHover); }
`;

const PasswordInputContainer = styled.div`
  position: relative;
  width: 100%;
  grid-row: 2;
  grid-column: 1;
`;

const PasswordInput = styled(JoinInput)`
  width: 100%;
  padding-right: 48px;
  box-sizing: border-box;
`;

const EyeButton = styled.button`
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--chakra-colors-textSecondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  width: 44px;
  height: 44px;
  padding: 0;
  z-index: 10;
  transition: color 0.2s;

  &:hover {
    color: var(--chakra-colors-textPrimary);
  }
`;

const JoinButton = styled.button`
  padding: 13px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  margin-top: 4px;
  min-height: 48px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    filter: brightness(1.08);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--chakra-colors-brandPrimary) 30%, transparent);
  }

  &:active {
    transform: translateY(0.5px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    filter: none;
  }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    padding: 11px;
    font-size: 0.9rem;
    min-height: 44px;
  }
`;

const PreviewOverlay = styled.div`
  position: fixed;
  inset: 0;
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  animation: ${fadeIn} 0.3s ease-out;
`;

const PlanModalOverlay = styled(PreviewOverlay)`
  z-index: 10002;
`;

const PlanModalCard = styled.div`
  width: min(440px, calc(100vw - 32px));
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--chakra-shadows-cardShadowHover);
  animation: ${popIn} 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 90dvh;
  overflow-y: auto;
`;

const PreviewModal = styled.div`
  width: ${(props) => (props.$isMobile ? "100vw" : "90vw")};
  max-width: 1000px;
  height: ${(props) => (props.$isMobile ? "100vh" : "90vh")};
  max-height: ${(props) => (props.$isMobile ? "100dvh" : "90dvh")};
  background: var(--chakra-colors-surface);
  border: ${(props) => (props.$isMobile ? "none" : "1px solid var(--chakra-colors-border)")};
  border-radius: ${(props) => (props.$isMobile ? "0" : "24px")};
  padding: ${(props) => (props.$isMobile ? "0" : "20px")};
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  box-shadow: ${(props) => (props.$isMobile ? "none" : "var(--chakra-shadows-cardShadowHover)")};
  animation: ${popIn} 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
  margin: auto;

  @media (max-width: ${BREAKPOINTS.md}px) {
    padding: 0;
    gap: 0;
  }
`;

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 22px 24px;
  border-bottom: 1px solid var(--chakra-colors-border);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(20px);
  z-index: 3;
`;

const PreviewTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const PreviewTitle = styled.div`
  color: var(--chakra-colors-textPrimary);
  font-size: 1.18rem;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

const PreviewSubtitle = styled.div`
  color: var(--chakra-colors-textSecondary);
  font-size: 0.95rem;
  line-height: 1.5;
  max-width: 760px;
  letter-spacing: 0.01em;
`;

const PreviewCloseButton = styled.button`
  background: rgba(255, 107, 107, 0.12);
  border: 1px solid rgba(255, 107, 107, 0.22);
  color: var(--chakra-colors-textPrimary);
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.22s ease;
  flex-shrink: 0;

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 107, 107, 0.15);
    border-color: rgba(255, 107, 107, 0.3);
    color: #ff8a8a;
    box-shadow: 0 8px 16px rgba(255, 107, 107, 0.15);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const PreviewContent = styled.div`
  flex: 1 1 auto;
  min-height: 0;

  overflow-y: auto;
  overflow-x: hidden;

  display: grid;

  grid-template-columns: ${(props) =>
    props.$singleFile
      ? "minmax(0, 1fr)"
      : "repeat(auto-fit, minmax(240px, 1fr))"};

  justify-items: center;

  /* IMPORTANT: do not stretch the single card vertically */
  align-items: ${(props) =>
    props.$singleFile ? "center" : "center"};

  justify-content: center;

  gap: 18px;
  padding: 24px;

  width: 100%;
  box-sizing: border-box;

  /* Don't stretch the grid row */
  align-content: ${(props) =>
    props.$singleFile ? "center" : "start"};

  @media (max-width: ${BREAKPOINTS.lg}px) {
    padding: 16px;
    gap: 12px;

    display: ${(props) =>
      props.$singleFile ? "grid" : "flex"};

    flex-direction: ${(props) =>
      props.$singleFile ? "unset" : "column"};

    grid-template-columns: ${(props) =>
      props.$singleFile ? "minmax(0, 1fr)" : "unset"};

    align-items: center;
    align-content: start;

    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
`;

const PreviewCard = styled.div`
  position: relative;

  width: 100%;
  max-width: 100%;

  /* VERY IMPORTANT */
  height: fit-content;
  min-height: 0;

  display: flex;
  flex-direction: column;

  align-self: center;

  border-radius: ${(props) =>
    props.$singleFile ? "20px" : "22px"};

  background: var(--chakra-colors-badgeBg);

  border: 1px solid var(--chakra-colors-border);

  box-shadow: var(--chakra-shadows-cardShadow);

  overflow: hidden;

  transition: all 0.24s cubic-bezier(0.2, 0, 0, 1);

  will-change: transform, border-color;
  backface-visibility: hidden;

  @media (hover: hover) {
    &:hover {
      transform: ${(props) =>
        props.$singleFile
          ? "none"
          : "translateY(-3px)"};

      border-color: var(--chakra-colors-brandPrimary);

      box-shadow: var(--chakra-shadows-cardShadowHover);
    }
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    width: 100%;
    height: fit-content;
    min-height: 0;
    max-height: none;

    flex-shrink: 0;

    flex-direction: ${(props) =>
      props.$singleFile ? "column" : "row"};

    align-items: ${(props) =>
      props.$singleFile ? "stretch" : "center"};
  }
`;

const PreviewMediaWrapper = styled.div`
  position: relative;

  width: 100%;

  /* This is now the ONLY thing determining media height */
  aspect-ratio: 16 / 9;

  height: auto;
  min-height: 0;

  flex: 0 0 auto;

  display: flex;
  align-items: center;
  justify-content: center;

  background: #000;

  overflow: hidden;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    width: ${(props) =>
      props.$singleFile ? "100%" : "80px"};

    aspect-ratio: ${(props) =>
      props.$singleFile ? "16 / 9" : "1 / 1"};

    height: auto;
    min-height: 0;

    flex: 0 0 auto;

    min-width: ${(props) =>
      props.$singleFile ? "0" : "80px"};

    border-radius: ${(props) =>
      props.$singleFile ? "0" : "12px"};
  }
`;

const PreviewMedia = styled.img`
  width: 100%;
  height: 100%;

  display: block;

  object-fit: contain;
  object-position: center;

  background: #000;

  user-select: none;
  -webkit-user-drag: none;
`;

const PreviewVideo = styled.video`
  width: 100%;
  height: 100%;

  display: block;

  object-fit: contain;
  object-position: center;

  background: #000;

  user-select: none;
  -webkit-user-drag: none;
`;

const PreviewFilePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--chakra-colors-badgeBg);
  color: var(--chakra-colors-textSecondary);
  text-align: center;
  box-sizing: border-box;
`;

const PreviewFileInfo = styled.div`
  padding: 18px 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    padding: 10px 14px;
    gap: 4px;
  }
`;

const PreviewFileName = styled.div`
  color: var(--chakra-colors-textPrimary);
  font-weight: 700;
  font-size: 0.96rem;
  line-height: 1.35;
  word-break: break-word;
`;

const PreviewFileMeta = styled.div`
  color: var(--chakra-colors-textMuted);
  font-size: 0.82rem;
`;

const PreviewRemoveButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: 1px solid var(--chakra-colors-border);
  border-radius: 50%;
  background: var(--chakra-colors-badgeBg);
  color: var(--chakra-colors-textPrimary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
  font-size: 0.82rem;

  &:hover {
    transform: translateY(-1px);
    background: var(--chakra-colors-surfaceHover);
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    position: static;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    margin-right: 10px;
    align-self: center;
  }
`;

const PreviewActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding: 22px 24px 24px;
  border-top: 1px solid var(--chakra-colors-border);
  background: var(--chakra-colors-glassBg);

  @media (max-width: ${BREAKPOINTS.lg}px) {
    justify-content: stretch;
  }
`;

const PreviewButton = styled.button`
  padding: 12px 28px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.95rem;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  }

  &:active {
    transform: scale(0.98);
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    width: 100%;
  }
`;

const CancelBtn = styled(PreviewButton)`
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  color: var(--chakra-colors-textPrimary);

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    border-color: var(--chakra-colors-brandPrimary);
  }
`;

const SendBtn = styled(PreviewButton)`
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  color: #fff;

  &:hover {
    box-shadow: 0 8px 20px var(--chakra-colors-brandGlow);
  }
`;

const MessageInputContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-top: 1px solid var(--chakra-colors-border);
  gap: 12px;
  padding-bottom: calc(10px + var(--safe-bottom));
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
  box-sizing: border-box;

  @media (max-width: ${BREAKPOINTS.md}px) {
    padding: 8px 10px;
    padding-bottom: calc(8px + var(--safe-bottom));
    gap: 6px;
  }
`;

const InputPill = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 24px;
  padding: 4px 8px;
  gap: 4px;
  min-width: 0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.25s ease;
  box-sizing: border-box;

  &:focus-within {
    border-color: var(--chakra-colors-brandPrimary);
    box-shadow: 
      inset 0 2px 4px rgba(0, 0, 0, 0.05),
      0 0 15px var(--chakra-colors-brandGlow);
    background: var(--chakra-colors-surface);
  }

  @media (max-width: ${BREAKPOINTS.md}px) {
    padding: 2px 6px;
    border-radius: 20px;
    gap: 2px;
  }
`;

const AccessoryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 16px;
  padding: 6px 12px;
  margin-bottom: 4px;
  gap: 8px;
  animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes slideDown {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    justify-content: flex-start;
    gap: 10px;
    padding: 8px 10px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    &::-webkit-scrollbar { display: none; }
  }
`;

const IconButton = styled.button`
  background: transparent;
  border: none;
  color: var(--chakra-colors-textSecondary);
  cursor: pointer;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &:hover {
    color: var(--chakra-colors-textPrimary);
    background: var(--chakra-colors-surfaceHover);
  }

  &:active {
    transform: scale(0.95);
  }

  @media (max-width: ${BREAKPOINTS.md}px) {
    width: 38px;
    height: 38px;
    font-size: 1rem;
  }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    width: 38px;
    height: 38px;
    font-size: 0.95rem;
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    width: 36px;
    height: 36px;
    font-size: 0.9rem;
  }
`;

const EphemeralToggle = styled(IconButton)`
  color: ${(p) => (p.$active ? "#ff4757" : "var(--chakra-colors-textSecondary)")};
  background: ${(p) => (p.$active ? "rgba(255, 71, 87, 0.12)" : "transparent")};

  &:hover {
    color: ${(p) => (p.$active ? "#ff6b72" : "var(--chakra-colors-textPrimary)")};
    background: ${(p) => (p.$active ? "rgba(255, 71, 87, 0.18)" : "var(--chakra-colors-surfaceHover)")};
  }
`;

const RecordingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  color: #ff4757;
  cursor: pointer;
  animation: pulse 1.5s infinite;
  flex-shrink: 0;

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff4757;
  }

  .timer {
    font-size: 0.8rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    padding: 0 4px;
    gap: 4px;
    .dot {
      width: 6px;
      height: 6px;
    }
    .timer {
      font-size: 0.75rem;
    }
  }
`;

const MessageInput = styled.textarea`
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 0.95rem;
  box-shadow: none;
  resize: none;
  overflow-y: auto;
  max-height: 150px;
  line-height: 1.4;
  font-family: inherit;
  box-sizing: border-box;

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    opacity: 0.6;
  }

  @media (max-width: ${BREAKPOINTS.md}px) {
    padding: 6px 8px;
    font-size: 16px;
    min-height: 36px;
    line-height: 1.35;
  }
`;

const FileInput = styled.input`
  display: none;
`;


const SendButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);

  &:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 6px 15px var(--chakra-colors-brandGlow);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: rgba(255,255,255,0.08);
    color: rgba(255, 255, 255, 0.3);
  }

  @media (max-width: ${BREAKPOINTS.md}px) {
    width: 36px;
    height: 36px;

    svg {
      width: 16px;
      height: 16px;
    }
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    width: 34px;
    height: 34px;

    svg {
      width: 15px;
      height: 15px;
    }
  }
`;
const slideUpMobile = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`;

const GifPickerOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: stretch;
  justify-content: center;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease-out;
`;

const GifPickerModal = styled.div`
  position: relative;
  width: ${(props) => (props.$isMobile ? "100vw" : "85vw")};
  max-width: 1200px;
  height: ${(props) => (props.$isMobile ? "100vh" : "85vh")};
  background: var(--chakra-colors-surface);
  border: ${(props) => (props.$isMobile ? "none" : "1px solid var(--chakra-colors-border)")};
  border-radius: ${(props) => (props.$isMobile ? "0" : "24px")};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: auto;
  box-shadow: ${(props) => (props.$isMobile ? "none" : "var(--chakra-shadows-cardShadowHover)")};
  animation: ${scaleUp} 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);

  @media (max-width: ${BREAKPOINTS.lg}px) {
    width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    margin: 0;
    border: none;
    animation: ${slideUpMobile} 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
`;

const EphemeralMenuOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: transparent;
`;

const EphemeralMenuCard = styled.div`
  position: absolute;
  bottom: 54px;
  right: 0;
  width: 250px;
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--chakra-shadows-cardShadowHover);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: scaleUp 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);

  .title {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--chakra-colors-textPrimary);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .subtitle {
    font-size: 0.72rem;
    color: var(--chakra-colors-textMuted);
    line-height: 1.35;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .option-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    border-radius: 8px;
    color: var(--chakra-colors-textSecondary);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;

    &:hover {
      background: var(--chakra-colors-surfaceHover);
      color: var(--chakra-colors-textPrimary);
    }

    &.active {
      background: rgba(255, 63, 94, 0.12);
      color: var(--chakra-colors-brandPrimary);
      font-weight: 700;
    }

    &.custom-btn {
      border-top: 1px solid var(--chakra-colors-border);
      margin-top: 4px;
      border-radius: 0 0 8px 8px;
      color: var(--chakra-colors-textMuted);
      font-style: italic;

      &:hover {
        color: #fff;
      }
    }

    .check {
      font-size: 0.8rem;
      font-weight: 900;
    }
  }

  @media (max-width: ${BREAKPOINTS.sm}px) {
    width: 220px;
    bottom: 50px;
    right: 10px;
  }
`;

const GifDrawerHandle = styled.div`
  display: none;
  @media (max-width: ${BREAKPOINTS.lg}px) {
    display: flex;
    justify-content: center;
    padding: 10px 0 2px;
    background: var(--chakra-colors-badgeBg);
    &::after {
      content: '';
      width: 42px;
      height: 4px;
      border-radius: 999px;
      background: var(--chakra-colors-border);
    }
  }
`;

const GifPickerTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  span.title {
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--chakra-colors-textPrimary);
    letter-spacing: -0.02em;
  }

  span.badge {
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.15);
    border: 1px solid rgba(255, 107, 107, 0.25);
    padding: 6px 14px;
    border-radius: 999px;
    backdrop-filter: blur(10px);
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    span.title { font-size: 1.15rem; }
    span.badge { font-size: 0.65rem; padding: 4px 10px; }
  }
`;

const GifPickerSubtitle = styled.div`
  color: var(--chakra-colors-textSecondary);
  font-size: 0.95rem;
  line-height: 1.55;
  max-width: 780px;
  letter-spacing: 0.01em;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    font-size: 0.9rem;
  }
`;

const CloseGifPickerButton = styled.button`
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  width: 38px;
  height: 38px;
  min-width: 38px;
  min-height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  flex-shrink: 0;
  transition: transform 0.2s ease, background 0.2s ease;
  margin-left: auto;

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 107, 107, 0.16);
    border-color: rgba(255, 107, 107, 0.3);
    color: #ff8a8a;
  }

  &:active {
    transform: scale(0.94);
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    font-size: 0.95rem;
  }
`;

const GifPickerHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px 28px 18px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--chakra-colors-border);
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 2;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    padding: 14px 16px 12px;
    gap: 12px;
  }
`;

const GifPickerTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const GifSearchContainer = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
`;

const GifSearchIcon = styled.div`
  position: absolute;
  left: 16px;
  color: var(--chakra-colors-textMuted);
  display: flex;
  align-items: center;
  pointer-events: none;
  font-size: 0.95rem;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    left: 14px;
    font-size: 0.88rem;
  }
`;

const GifSearchClearButton = styled.button`
  position: absolute;
  right: 14px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.18s ease;

  &:hover {
    color: var(--chakra-colors-textPrimary);
    background: var(--chakra-colors-surfaceHover);
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    right: 12px;
  }
`;

const GifEmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
  color: var(--chakra-colors-textMuted);
  flex: 1;

  .icon {
    font-size: 2.4rem;
    color: var(--chakra-colors-border);
    margin-bottom: 14px;
  }

  .text {
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 6px;
    color: var(--chakra-colors-textPrimary);
  }

  .subtext {
    font-size: 0.8rem;
    color: var(--chakra-colors-textSecondary);
  }
`;

const GiphyAttribution = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 16px;
  background: var(--chakra-colors-glassBg);
  border-top: 1px solid var(--chakra-colors-border);
  font-size: 0.72rem;
  color: var(--chakra-colors-textMuted);
  gap: 6px;
  flex-shrink: 0;

  a {
    color: var(--chakra-colors-brandPrimary);
    text-decoration: none;
    font-weight: 600;
    &:hover {
      text-decoration: underline;
    }
  }
`;

const GifSearchInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 11px 16px 11px 40px;
  border-radius: 14px;
  border: 1px solid var(--chakra-colors-border);
  background: var(--chakra-colors-badgeBg);
  color: var(--chakra-colors-textPrimary);
  font-size: max(16px, 0.9rem);
  font-weight: 500;
  outline: none;
  box-sizing: border-box;
  transition: all 0.25s ease;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: var(--chakra-colors-surface);
    box-shadow: 0 0 0 3px var(--chakra-colors-brandGlow);
  }

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    font-weight: 400;
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    padding: 10px 14px 10px 36px;
    border-radius: 12px;
  }
`;



const GifGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 14px;
  margin-top: 10px;
  padding: 0 20px 18px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  align-items: start;
  flex: 1;
  min-height: 0;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    /* Fixed 3-up mosaic on phones — auto-fit collapses to 2 giant tiles */
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 0 10px 14px;
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    gap: 6px;
    padding: 0 8px 12px;
  }

  @media (min-width: 1024px) {
    gap: 16px;
  }
`;

const GifCard = styled.div`
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255,255,255,0.055);
  transition: transform 0.2s ease, box-shadow 0.25s ease, border-color 0.25s ease;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    border-radius: 10px;
  }

  &:before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07);
    pointer-events: none;
    transition: box-shadow 0.25s ease;
  }

  &:active {
    transform: scale(0.96);
  }

  @media (hover: hover) {
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
      border-color: rgba(255, 255, 255, 0.14);
    }

    &:hover:before {
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 4px rgba(255,255,255,0.055);
    }
  }
`;

const GifItem = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: rgba(255, 255, 255, 0.02);

  @media (hover: hover) {
    transition: transform 0.25s ease;
    ${GifCard}:hover & {
      transform: scale(1.08);
    }
  }
`;

const CardOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.6) 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.18s ease;

  @media (hover: hover) {
    ${GifCard}:hover & {
      opacity: 1;
    }
  }

  ${GifCard}:active & {
    opacity: 1;
  }
`;


const SearchPopup = styled.div`
  position: absolute;
  top: 76px;
  right: 20px;
  z-index: 100;
  background: var(--chakra-colors-glassBg);
  padding: 10px 18px;
  border-radius: 16px;
  border: 1px solid var(--chakra-colors-border);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  display: flex;
  gap: 12px;
  align-items: center;
  box-shadow: var(--chakra-shadows-cardShadowHover);
  animation: slide-down-fade 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: ${BREAKPOINTS.md}px) {
    right: 12px;
    left: 12px;
    top: 64px;
    width: auto;
    padding: 8px 14px;
  }
`;

const SearchInput = styled.input`
  background: none;
  border: none;
  color: var(--chakra-colors-textPrimary);
  outline: none;
  width: 180px;
  font-size: 0.95rem;

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    opacity: 0.6;
  }

  @media (max-width: ${BREAKPOINTS.md}px) {
    flex: 1;
    width: auto;
  }
`;

const RoomInfoDropdown = styled.div`
  position: fixed;
  top: 68px;
  left: max(16px, env(safe-area-inset-left));
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100dvh - 84px);
  overflow-y: auto;
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 18px;
  padding: 18px;
  z-index: 9001;
  box-shadow: var(--chakra-shadows-cardShadowHover);
  box-sizing: border-box;
  animation: slide-down-fade 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: ${BREAKPOINTS.md}px) {
    top: calc(54px + env(safe-area-inset-top));
    left: max(10px, env(safe-area-inset-left));
    width: min(420px, calc(100vw - 20px));
    max-height: calc(100dvh - 68px - env(safe-area-inset-top));
    padding: 12px;
    border-radius: 14px;
    font-size: 0.92rem;
  }
`;

const RoomInfoBackdrop = styled.button`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh;
  border: 0;
  padding: 0;
  margin: 0;
  cursor: default;
  background: rgba(0, 0, 0, 0.28);
  z-index: 9000;
`;

const RoomInfoTrigger = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  padding: 2px 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  @media (max-width: ${BREAKPOINTS.sm}px) {
    flex-shrink: 0;
  }

  // &:hover, &:focus-visible {
  //   background: rgba(255,255,255,0.06);
  //   outline: none;
  // }
`;

function ReplyAttachmentPreview({ reply, roomKey }) {
  const [url, setUrl] = useState(reply.gif || null);

  useEffect(() => {
    const file = reply.file;
    if (!file?.url || reply.gif) return undefined;
    let objectUrl;
    let active = true;
    (async () => {
      try {
        let source = file.url;
        if (file.iv && !file.url.startsWith(window.location.origin) && !file.url.includes("/uploads/")) {
          source = `${backendUrl}/api/proxy-file?url=${encodeURIComponent(file.url)}`;
        }
        const response = await fetch(source);
        if (!response.ok) throw new Error("Preview download failed");
        let blob;
        let decryptionKey = roomKey;
        if (file.keyB64) {
          decryptionKey = await importKey(file.keyB64);
        }
        if (file.iv && decryptionKey) {
          const encrypted = await response.arrayBuffer();
          const iv = new Uint8Array(atob(file.iv).split("").map((char) => char.charCodeAt(0)));
          const decrypted = await decryptBinary(decryptionKey, { iv, data: encrypted });
          blob = new Blob([decrypted], { type: file.type || "application/octet-stream" });
        } else {
          blob = await response.blob();
        }
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      } catch (err) { console.warn("Reply preview decrypt failed:", err.message || err); }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [reply.file, reply.gif, roomKey]);

  if (reply.file?.viewOnce) {
    return <div aria-label="View-once media" style={{ width: 38, height: 38, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(5,150,105,.16)", color: "#86efac", flexShrink: 0, fontSize: ".72rem", fontWeight: 800 }}>LOCK</div>;
  }
  if (url && (reply.gif || reply.file?.type?.startsWith("image/"))) return <img src={url} alt="Replied attachment" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} />;
  if (url && reply.file?.type?.startsWith("video/")) return <video src={`${url}#t=0.1`} muted playsInline style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} />;
  return reply.file ? <div style={{ width: 42, height: 42, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,.04)", fontSize: ".62rem", fontWeight: 800 }}>FILE</div> : null;
}

const EMOJI_DATA = [
  {
    category: "Smileys",
    icon: "😀",
    emojis: ["😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊", "😋", "😎", "😍", "😘", "🥰", "😗", "😙", "😚", "🙂", "🤗", "🤩", "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😣", "😥", "😮", "🤐", "😪", "😫", "🥱", "😴", "😌", "😛", "😜", "🤪", "😝", "🤤", "😒", "😓", "😔", "😕", "🙃", "🤑", "😲", "☹️", "🙁", "😖", "😞", "😟", "😤", "😢", "😭", "😦", "😧", "😨", "😩", "🤯", "😬", "😰", "😱", "🥵", "🥶", "😳", "😵", "🥴", "😠", "😡", "🤬", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "😇", "🤠", "🤡", "🥳", "🥺", "🤫", "🤭", "🧐", "🤓", "😈", "👿", "💀", "☠️", "👻", "👽", "👾", "🤖", "💩"]
  },
  {
    category: "Nature",
    icon: "🌸",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "Penguin", "Bird", "Duck", "Eagle", "Owl", "Bat", "Wolf", "Boar", "Horse", "Unicorn", "Bee", "Bug", "Butterfly", "Snail", "Ladybug", "Ant", "Mosquito", "Cricket", "Spider", "Scorpion", "Turtle", "Snake", "Lizard", "Octopus", "Squid", "Lobster", "Crab", "Fish", "Dolphin", "Whale", "Shark", "Crocodile", "Tiger", "Leopard", "Zebra", "Gorilla", "Elephant", "Camel", "Giraffe", "Kangaroo", "Sheep", "Goat", "Deer", "Dog", "Cat", "Rabbit", "Dragon", "Cactus", "🌲", "Tree", "Palm", "Seedling", "Herb", "Clover", "Maple", "Mushroom", "Shell", "Bouquet", "Tulip", "Rose", "Hibiscus", "🌸", "Sunflower", "Sun", "Moon", "Star", "Sparkles", "Lightning", "Fire", "Rainbow", "Cloud", "Rain", "Snowflake", "Wind", "Water Drop", "Wave"]
  },
  {
    category: "Food",
    icon: "🍔",
    emojis: ["🍏", "🍎", "🍐", "🍊", "Lemon", "Banana", "Watermelon", "Grapes", "Strawberry", "Melon", "Cherry", "Peach", "Pineapple", "Coconut", "Kiwi", "Tomato", "Eggplant", "Avocado", "Broccoli", "Pepper", "Corn", "Carrot", "Potato", "Croissant", "Bread", "Cheese", "Egg", "Frying Pan", "Pancake", "Bacon", "Meat", "Chicken", "Hot Dog", "Hamburger", "Fries", "Pizza", "Sandwich", "Taco", "Burrito", "Salad", "Spaghetti", "Ramen", "Sushi", "Bento", "Dumpling", "Fried Shrimp", "Rice", "Ice Cream", "Cake", "Cupcake", "Pie", "Chocolate", "Candy", "Lollipop", "Honey", "Milk", "Coffee", "Tea", "Wine", "Cocktail", "Beer", "Whiskey", "Soda"]
  },
  {
    category: "Travel",
    icon: "✈️",
    emojis: ["🚗", "Taxi", "🚙", "Bus", "🚓", "Ambulance", "Fire Engine", "Motorcycle", "Bicycle", "Scooter", "Skateboard", "Train", "Rocket", "Airplane", "Helicopter", "Sailboat", "Speedboat", "Ship", "Anchor", "Fuel Pump", "Stop Sign", "Map", "Statue of Liberty", "Eiffel Tower", "Castle", "Stadium", "Ferris Wheel", "Roller Coaster", "Carousel", "Fountain", "Beach", "Island", "Desert", "Volcano", "Mountain", "Tent", "House", "Office", "Hospital", "Bank", "Hotel", "School", "Church", "Sunrise", "Sunset", "Bridge", "Milky Way"]
  },
  {
    category: "Activities",
    icon: "⚽️",
    emojis: ["⚽️", "🏀", "🏈", "Baseball", "Tennis", "Volleyball", "Rugby", "8 Ball", "Ping Pong", "Badminton", "Golf", "Archery", "Fishing", "Boxing Glove", "Skate", "Sled", "Ski", "Snowboard", "Weightlifter", "Fencer", "Gymnast", "Cyclist", "Yoga", "Trophy", "Medal", "Ticket", "Circus Tent", "Performing Arts", "Artist Palette", "Clapperboard", "Microphone", "Headphones", "Musical Keyboard", "Drum", "Guitar", "Violin", "Game Die", "Puzzle", "Bowling", "Video Game", "Slot Machine", "Dart"]
  },
  {
    category: "Objects",
    icon: "💡",
    emojis: ["⌚️", "Mobile Phone", "Laptop", "Keyboard", "Desktop", "Printer", "Mouse", "Camera", "Video Camera", "TV", "Radio", "Clock", "Hourglass", "Battery", "Plug", "Light Bulb", "Flashlight", "Candle", "Money Bag", "Dollar Banknote", "Credit Card", "Gem Stone", "Balance Scale", "Wrench", "Hammer", "Gear", "Shield", "Cigarette", "Coffin", "Crystal Ball", "Magnet", "Balloon", "Party Popper", "Confetti Ball", "Gift", "Envelope", "Postbox", "File Folder", "Calendar", "Bar Chart", "Paperclip", "Scissors", "Lock", "Key", "Shopping Cart", "Trash Can"]
  },
  {
    category: "Symbols",
    icon: "❤️",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "Purple Heart", "Black Heart", "White Heart", "Broken Heart", "Exclamation Heart", "Two Hearts", "Sparkling Heart", "Heart Aflutter", "Growing Heart", "Heart With Ribbon", "Peace Symbol", "Latin Cross", "Star and Crescent", "Star of David", "Yin Yang", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces", "Biohazard", "Warning", "Prohibited", "Check Mark", "Cross Mark", "Question Mark", "Exclamation Mark", "Arrow Up", "Arrow Right", "Arrow Down", "Arrow Left", "Reload", "Play Button", "Pause Button", "Stop Button"]
  }
];

const EMOJI_NAMES = {
  "😀": "smiley face grin smile happy",
  "😁": "beaming face smile happy",
  "😂": "tears of joy laugh crying lol lmao",
  "🤣": "rofl laughing floor rolling lol lmao",
  "😃": "grinning face big eyes open mouth happy",
  "😄": "grinning face smiling eyes happy",
  "😅": "sweat smile relief nervous",
  "😆": "laughing face squinting eyes happy",
  "😉": "wink winking face",
  "😊": "smiling face rosy cheeks blush warm nice",
  "😋": "yum delicious food tasty hungry",
  "😎": "cool sunglasses smart swag",
  "😍": "heart eyes love adore crush romantic",
  "😘": "kiss blow kiss love romantic",
  "🥰": "smiling face hearts in love warm romantic",
  "😗": "kissing face",
  "😙": "kissing face smiling eyes",
  "😚": "kissing face closed eyes",
  "🙂": "slightly smiling face",
  "🤗": "hug hugging face",
  "🤩": "star struck amazed wow",
  "🤔": "thinking pondering wonder question",
  "🤨": "raised eyebrow skeptical suspicious",
  "😐": "neutral face meh",
  "😑": "expressionless face flat line",
  "😶": "no mouth speech silent",
  "🙄": "roll eyes rolling bored annoyed",
  "😏": "smirk smirking sly cool",
  "😣": "persevere struggling frustrated",
  "😥": "sad relieved sweat tear cry",
  "😮": "gasp wow surprise open mouth",
  "🤐": "zipper mouth secret quiet silent",
  "😪": "sleepy tear yawn tired",
  "😫": "tired exhausted groan",
  "🥱": "yawn yawning tired bored",
  "😴": "sleep sleeping zzz tired",
  "😌": "relieved peaceful calm",
  "😛": "tongue out playful",
  "😜": "tongue out wink playful cheeky",
  "🤪": "zany goofy crazy silly",
  "😝": "tongue squint playful",
  "🤤": "drool drooling delicious hungry",
  "😒": "unamused unimpressed annoyed bored",
  "😓": "downcast sweat sad tired",
  "😔": "pensive sad regretful",
  "😟": "worried anxious",
  "😤": "steam from nose angry win proud",
  "😢": "cry crying tear sad",
  "😭": "loud crying sob tear sad broken",
  "😦": "frowning mouth open shocked",
  "😧": "anguished sad worried",
  "😨": "fear fearful scared",
  "😩": "weary tired crying",
  "🤯": "exploding head mind blown wow surprise",
  "😬": "grimace awkward tense",
  "😰": "anxious blue forehead sweat scared",
  "😱": "scream screaming fear shocked scared",
  "🥵": "hot sweat red temperature summer",
  "🥶": "cold blue freeze ice winter",
  "😳": "flushed embarrassed shocked surprise blush",
  "😵": "dizzy cross eyes dead shocked",
  "🥴": "woozy drunk dizzy sick",
  "😠": "angry mad annoyed",
  "😡": "pout angry mad red",
  "🤬": "swearing curse mad angry",
  "😷": "mask medical doctor sick",
  "🤒": "thermometer sick flu fever temperature",
  "🤕": "bandage head hurt injured sick",
  "🤢": "nausea throw up green disgust sick",
  "🤮": "vomit throwing up sick disgust",
  "🤧": "sneeze tissue sick cold flu",
  "😇": "halo angel holy good innocent",
  "🤠": "cowboy hat west country",
  "🤡": "clown face circus silly goofy",
  "🥳": "party blower hat celebrate birthday cheers",
  "🥺": "pleading begging puppy eyes sad cute",
  "🤫": "shh quiet silent whisper",
  "🤭": "giggle hand over mouth oops",
  "🧐": "monocle class fancy smart",
  "🤓": "nerd geek smart glasses",
  "😈": "smiling devil purple evil mischievous",
  "👿": "angry devil purple evil demon",
  "💀": "skull skeleton death dead spooky",
  "☠️": "skull crossbones poison danger death",
  "👻": "ghost spooky halloween",
  "👽": "alien outer space ufo",
  "👾": "alien monster retro video game space invader",
  "🤖": "robot android technology mechanical",
  "💩": "poop turd brown piece of",
  "❤️": "heart love red romantic like favourite",
  "🧡": "orange heart love",
  "💛": "yellow heart love",
  "💚": "green heart love",
  "💙": "blue heart love",
  "💜": "purple heart love",
  "🖤": "black heart love",
  "🤍": "white heart love",
  "🤎": "brown heart love",
  "💔": "broken heart sad split break up",
  "👍": "thumbs up ok yes agree good check like",
  "👎": "thumbs down no disagree bad dislike",
  "🙏": "please pray thanks gratitude appreciate hope fold hands",
  "🔥": "fire hot lit flame match warm burn",
  "🎉": "tada party popper celebrate birthday congrats",
  "✨": "sparkles shiny clean magic new bright",
  "💯": "hundred percent perfect core A+ score check",
  "✅": "check mark green select pass correct tick",
  "❌": "cross mark red delete cancel close wrong fail"
};

function PremiumEmojiPicker({ onSelect, onClose, isMobile }) {
  const [activeCategory, setActiveCategory] = useState("Smileys");
  const [search, setSearch] = useState("");

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) {
      return EMOJI_DATA.find(c => c.category === activeCategory)?.emojis || [];
    }
    const query = search.toLowerCase();
    const results = [];
    EMOJI_DATA.forEach(cat => {
      cat.emojis.forEach(emoji => {
        const desc = EMOJI_NAMES[emoji] || cat.category.toLowerCase();
        if (desc.includes(query)) {
          results.push(emoji);
        }
      });
    });
    return results;
  }, [search, activeCategory]);

  return (
    <div className="emoji-picker-container" style={{
      position: isMobile ? "fixed" : "absolute",
      bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 90px)" : "calc(100% + 10px)",
      left: isMobile ? "50%" : "auto",
      right: isMobile ? "auto" : 0,
      transform: isMobile ? "translateX(-50%)" : "none",
      width: isMobile ? "calc(100% - 32px)" : 320,
      maxWidth: isMobile ? 360 : "none",
      height: 380,
      background: "var(--chakra-colors-surface)",
      border: "1px solid var(--chakra-colors-border)",
      borderRadius: 16,
      boxShadow: "var(--chakra-shadows-cardShadow)",
      display: "flex",
      flexDirection: "column",
      zIndex: 22000,
      overflow: "hidden"
    }}>
      <div style={{ padding: 10, borderBottom: "1px solid var(--chakra-colors-borderSubtle)" }}>
        <input
          type="text"
          placeholder="Search emojis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "var(--chakra-colors-surfaceHover)",
            border: "1px solid var(--chakra-colors-borderSubtle)",
            borderRadius: 8,
            color: "var(--chakra-colors-textPrimary)",
            fontSize: "0.85rem",
            outline: "none",
            boxSizing: "border-box"
          }}
          autoFocus
        />
      </div>

      {!search.trim() && (
        <div style={{
          display: "flex",
          padding: "6px 10px",
          background: "rgba(0,0,0,.15)",
          borderBottom: "1px solid rgba(255,255,255,.04)",
          justifyContent: "space-between"
        }}>
          {EMOJI_DATA.map(cat => (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "1.1rem",
                padding: "4px 6px",
                cursor: "pointer",
                borderRadius: 6,
                backgroundColor: activeCategory === cat.category ? "rgba(255,255,255,.04)" : "transparent",
                transition: "all 0.15s ease"
              }}
              title={cat.category}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: 10,
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 6,
        alignContent: "start"
      }}>
        {filteredEmojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              if (search.trim()) setSearch("");
            }}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.4rem",
              padding: 4,
              cursor: "pointer",
              borderRadius: 8,
              transition: "transform 0.1s ease",
              display: "grid",
              placeItems: "center"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.2)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {emoji}
          </button>
        ))}
        {filteredEmojis.length === 0 && (
          <div style={{ gridColumn: "span 7", textAlign: "center", padding: "40px 10px", fontSize: "0.85rem", opacity: 0.5 }}>
            No emojis found 😢
          </div>
        )}
      </div>
    </div>
  );
}

// Rich link preview card that fetches OG metadata from backend
function LinkPreviewCard({ url, renderLinkActions }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchPreview = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/link-preview?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error("Preview fetch failed");
        const data = await res.json();
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPreview();
    return () => { cancelled = true; };
  }, [url]);

  // Deterministic brand gradient from the hostname — every domain gets its own hue
  let host = "link";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { }
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const grad = `linear-gradient(135deg, hsla(${hue}, 70%, 45%, .55), hsla(${(hue + 60) % 360}, 70%, 35%, .65))`;
  const favicon = `https://www.google.com/s2/favicons?sz=64&domain=${host}`;

  if (loading) {
    return (
      <div style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,.07)" }}>
        <div className="skel-shimmer" style={{ height: 130, background: `hsla(${hue}, 30%, 18%, .6)` }} />
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="skel-shimmer" style={{ height: 9, width: "34%", borderRadius: 5 }} />
          <div className="skel-shimmer" style={{ height: 13, width: "82%", borderRadius: 5 }} />
          <div className="skel-shimmer" style={{ height: 11, width: "64%", borderRadius: 5 }} />
        </div>
      </div>
    );
  }

  const hasOg = preview && (preview.title || preview.description);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "block",
        marginTop: 10,
        borderRadius: 14,
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 0.2s ease, transform 0.2s ease",
        cursor: "pointer"
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(129,140,248,.55)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,.08)"; }}
    >
      {hasOg && preview.image ? (
        <img
          src={preview.image}
          alt=""
          style={{
            width: "100%",
            maxHeight: 260,
            objectFit: "cover",
            display: "block",
            background: "rgba(0,0,0,0.2)"
          }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
      ) : (
        !hasOg && (
          <div style={{
            position: "relative",
            height: 96,
            background: grad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12
          }}>
            <img src={favicon} alt="" width={34} height={34} style={{ borderRadius: 9, background: "rgba(255,255,255,.92)", padding: 4 }} onError={(e) => { e.target.style.visibility = "hidden"; }} />
            <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,.4)", letterSpacing: "-.01em" }}>{host}</span>
            <span style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 80% -20%, rgba(255,255,255,.25), transparent 50%)" }} />
          </div>
        )
      )}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: hasOg ? 4 : 0 }}>
          {!hasOg && null}
          {preview?.siteName || hasOg ? (
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, opacity: 0.5 }}>
              {preview.siteName || host}
            </div>
          ) : (
            <div style={{ fontSize: "0.78rem", opacity: 0.75, wordBreak: "break-all", fontWeight: 600 }}>{url}</div>
          )}
        </div>
        {hasOg && preview.title && (
          <div style={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.35, marginBottom: 4 }}>
            {preview.title}
          </div>
        )}
        {hasOg && preview.description && (
          <div style={{
            fontSize: "0.82rem",
            opacity: 0.7,
            lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical"
          }}>
            {preview.description}
          </div>
        )}
        <div onClick={(e) => e.preventDefault()}>{renderLinkActions(url)}</div>
      </div>
    </a>
  );
}

// Social embeds (Instagram/YouTube/TikTok…) load heavy iframes that autoplay on
// render. Show a lightweight poster instead and mount the iframe only on play.
function ClickToPlayEmbed({ embed, aspectRatio }) {
  const src = useMemo(() => {
    if (!embed) return "";
    return embed.src;
  }, [embed]);

  const frameStyle = {
    aspectRatio: aspectRatio || "16 / 9",
    height: "auto",
    display: "block",
    width: "100%",
    minHeight: "300px",
    border: 0
  };

  if (!embed) return null;

  // Direct embed in a borderless glass shell — media edge-to-edge
  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "rgba(255,255,255,0.045)",
        backdropFilter: "blur(20px) saturate(1.2)",
        WebkitBackdropFilter: "blur(20px) saturate(1.2)",
        boxShadow: "0 14px 44px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <iframe
        title={embed.type || "embed"}
        src={src}
        loading="lazy"
        allow="encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        style={frameStyle}
      />
    </div>
  );
}
const PlaybackSpeedAudio = ({ file, decryptedUrl }) => {
  const audioElRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [speed, setSpeed] = React.useState(1);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [peaks, setPeaks] = React.useState([]);

  // Fetch and decode audio to generate peaks
  React.useEffect(() => {
    if (!decryptedUrl) return;
    let active = true;
    const generatePeaks = async () => {
      try {
        const response = await fetch(decryptedUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const step = Math.floor(channelData.length / 50);
        const generatedPeaks = [];
        for (let i = 0; i < 50; i++) {
          let max = 0;
          for (let j = 0; j < step; j++) {
            const val = Math.abs(channelData[i * step + j]);
            if (val > max) max = val;
          }
          generatedPeaks.push(max);
        }
        if (active) {
          setPeaks(generatedPeaks);
          setDuration(audioBuffer.duration);
        }
        audioCtx.close();
      } catch (err) {
        const fallback = Array.from({ length: 50 }, () => 0.1 + Math.random() * 0.8);
        if (active) {
          setPeaks(fallback);
        }
      }
    };
    generatePeaks();
    return () => { active = false; };
  }, [decryptedUrl]);

  // Sync canvas redraw with currentTime
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const progress = duration > 0 ? currentTime / duration : 0;
    const activeColor = "#00bfa5";
    const inactiveColor = "rgba(255, 255, 255, 0.25)";

    const barWidth = 3;
    const gap = 2;
    const totalBars = peaks.length;

    for (let i = 0; i < totalBars; i++) {
      const x = i * (barWidth + gap);
      const peakVal = peaks[i];
      const barHeight = Math.max(3, peakVal * height * 0.9);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = (i / totalBars) <= progress ? activeColor : inactiveColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }
  }, [peaks, currentTime, duration]);

  const togglePlay = () => {
    if (!audioElRef.current) return;
    if (isPlaying) {
      audioElRef.current.pause();
    } else {
      audioElRef.current.play().catch(() => { });
    }
  };

  const handleTimeUpdate = () => {
    if (audioElRef.current) {
      setCurrentTime(audioElRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioElRef.current) {
      setDuration(audioElRef.current.duration);
    }
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioElRef.current || duration === 0) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTime = percentage * duration;
    audioElRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const cycleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioElRef.current) {
      audioElRef.current.playbackRate = nextSpeed;
    }
  };

  return (
    <div style={{ background: "rgba(20, 20, 30, 0.35)", borderRadius: "14px", padding: "12px", border: "1px solid rgba(255,255,255,0.055)", width: "100%", boxSizing: "border-box" }}>
      <audio
        ref={audioElRef}
        src={decryptedUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        style={{ display: "none" }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: "1.1rem" }}>🎙️</span>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--chakra-colors-textPrimary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
        </div>
        <button
          type="button"
          onClick={cycleSpeed}
          style={{
            background: "rgba(255,255,255,0.055)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px",
            color: "var(--chakra-colors-brandPrimary)",
            fontSize: "0.72rem",
            fontWeight: 750,
            padding: "2px 8px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          {speed}x
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={togglePlay}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--chakra-colors-brandPrimary)",
            border: "none",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "1rem",
            boxShadow: "0 4px 10px rgba(0, 191, 165, 0.3)",
            transition: "transform 0.1s"
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <div style={{ flex: 1, position: "relative", cursor: "pointer" }}>
          <canvas
            ref={canvasRef}
            width={250}
            height={32}
            onClick={handleCanvasClick}
            style={{ width: "100%", height: 32, display: "block" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.7rem", opacity: 0.6, fontWeight: 500 }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

const downloadMedia = (decryptedUrl, name) => {
  if (!decryptedUrl) return;
  const link = document.createElement("a");
  link.href = decryptedUrl;
  link.download = name || "download";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyImageToClipboard = async (decryptedUrl) => {
  if (!decryptedUrl) return;
  try {
    const { ok, mode } = await safeCopyImage(decryptedUrl);
    if (!ok) { toast.error("Failed to copy image."); return; }
    toast.success(mode === "image" ? "📋 Image copied to clipboard!" : "📋 Image link copied!");
  } catch (err) {
    console.error(err);
    toast.error("Failed to copy image.");
  }
};

const copyLinkToClipboard = async (url) => {
  if (!url) return;
  const ok = await safeCopyText(url);
  if (ok) toast.success("📋 Link copied to clipboard!");
  else toast.error("Failed to copy link.");
};

// Skeleton placeholder for media loading — MUST be defined outside E2EEFileAttachment
// to avoid React treating it as a new component type on every render (which resets onLoad)
const MediaSkeleton = ({ isMobile }) => (
  <div style={{
    width: "100%",
    height: isMobile ? "240px" : "300px",
    background: "linear-gradient(90deg, rgba(255,255,255,0.055) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.055) 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    color: "rgba(255,255,255,0.4)"
  }}>
    <div style={{
      width: 24, height: 24, border: "2px solid rgba(255,255,255,0.07)",
      borderTop: "2px solid var(--chakra-colors-brandPrimary)",
      borderRadius: "50%", animation: "spin 0.8s linear infinite"
    }} />
    <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Loading media...</span>
    <style>{`
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// ── Stunning progressive-reveal upload card ──
// The final attachment layout sits as a dimmed skeleton; as upload % grows,
// a lit "revealed" layer sweeps across it (clip-path), like a curtain lifting.
// Keyframes are injected as plain CSS so they work inside inline styles.

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// Stateful component to handle downloading, decrypting and displaying E2EE files
// ── Eased counter: smoothly animates a number toward its target (rAF lerp) ──
const useEasedValue = (target, duration = 600) => {
  const [val, setVal] = useState(target);
  const valRef = useRef(target);
  const rafRef = useRef();
  useEffect(() => {
    const from = valRef.current;
    if (Math.abs(from - target) < 0.5) { valRef.current = target; setVal(target); return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      valRef.current = next;
      setVal(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
};

// ── Upload card type: photo · video · file ──
const getUploadTypeMeta = (type = "", name = "") => {
  const t = (type || "").toLowerCase();
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (t.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp", "heic", "ico"].includes(ext)) {
    return { kind: "image", label: "Photo", from: "#f43f5e", to: "#fb923c" };
  }
  if (t.startsWith("video/") || ["mp4", "mov", "webm", "mkv", "avi", "m4v", "mpeg"].includes(ext)) {
    return { kind: "video", label: "Video", from: "#8b5cf6", to: "#e879f9" };
  }
  return { kind: "file", label: "File", from: "#38bdf8", to: "#34d399" };
};

// ── Upload progress card ──
// Photos & videos show the actual content large — it starts soft/dim and
// sharpens into full view as the upload progresses. Files show a compact row.
// Friendly copy only: Getting ready… → Sending → Almost done…
const UploadProgressCard = ({ file, isMobile }) => {
  const phase = file.phase || "uploading"; // "encrypting" | "uploading" | "finalizing" | "sharing-live" | "receiving-live"
  const target = phase === "encrypting" ? 0 : Math.max(0, Math.min(100, file.progress ?? 0));
  const eased = useEasedValue(target);
  const shown = Math.round(eased);
  const meta = getUploadTypeMeta(file.type, file.name);
  const speed = file.speed || 0;
  const hasPreview = Boolean(file.previewUrl) && meta.kind !== "file";
  const uploading = phase === "uploading" || phase === "sharing-live" || phase === "receiving-live";
  const indeterminate = phase === "encrypting" || phase === "finalizing";
  const amountText = file.total
    ? `${formatBytes(file.loaded || 0)} / ${formatBytes(file.total)}`
    : formatBytes(file.size);

  const statusText =
    phase === "encrypting" ? "Getting ready…" :
      phase === "finalizing" ? "Finishing up…" :
        phase === "sharing-live" ? "Sharing…" :
          phase === "receiving-live" ? "Receiving…" :
            "Sending";

  // Live ETA from measured transfer speed
  let etaText = "";
  if (uploading && speed > 0 && file.total) {
    const remainSec = Math.max(0, (file.total - (file.loaded || 0)) / speed);
    if (isFinite(remainSec)) {
      if (remainSec < 5) etaText = "almost there";
      else if (remainSec < 60) etaText = `${Math.round(remainSec)}s left`;
      else {
        const mm = Math.floor(remainSec / 60);
        const ss = Math.round(remainSec % 60);
        etaText = `${mm}m${ss ? ` ${ss}s` : ""} left`;
      }
    }
  }

  // ── Media variant: big live preview with progress woven over it ──
  if (hasPreview) {
    return (
      <div style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "#0d0e15"
      }}>
        <style>{`
          @keyframes upc-sweep {
            0% { transform: translateX(-120%) skewX(-14deg); }
            100% { transform: translateX(340%) skewX(-14deg); }
          }
          @keyframes upc-pulse {
            0%, 100% { opacity: 0.45; }
            50% { opacity: 1; }
          }
        @keyframes upc-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes upc-spin {
          to { transform: rotate(360deg); }
        }
        `}</style>

        {/* the content itself — sharpens as it sends */}
        <div style={{ position: "relative", width: "100%", maxHeight: isMobile ? 240 : 300, background: "#0a0b12", overflow: "hidden" }}>
          {meta.kind === "image" ? (
            <img
              src={file.previewUrl}
              alt=""
              style={{
                width: "100%", height: isMobile ? 240 : 300, objectFit: "contain", display: "block",
                filter: `blur(${((100 - eased) * 0.09).toFixed(2)}px) brightness(${(0.55 + eased * 0.0045).toFixed(3)})`,
                transition: "filter .25s linear"
              }}
            />
          ) : (
            <video
              src={`${file.previewUrl}#t=0.1`}
              muted playsInline preload="metadata"
              style={{
                width: "100%", height: isMobile ? 240 : 300, objectFit: "contain", display: "block",
                filter: `blur(${((100 - eased) * 0.09).toFixed(2)}px) brightness(${(0.55 + eased * 0.0045).toFixed(3)})`,
                transition: "filter .25s linear"
              }}
            />
          )}

          {/* dark veil that lifts with progress */}
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(180deg, rgba(10,11,18,${(0.45 * (1 - eased / 100)).toFixed(3)}), rgba(10,11,18,${(0.55 * (1 - eased / 100)).toFixed(3)}))`
          }} />

          {/* shimmer sweep */}
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: 0, width: "30%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)",
              animation: "upc-sweep 1.9s ease-in-out infinite"
            }} />
          </div>

          {/* centered % pill */}
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8
          }}>
            <div style={{
              width: isMobile ? 58 : 66, height: isMobile ? 58 : 66, borderRadius: "50%",
              padding: 3,
              background: `conic-gradient(${meta.to} ${eased * 3.6}deg, rgba(255,255,255,0.22) ${eased * 3.6}deg)`
            }}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%",
                background: "rgba(13,14,21,0.82)", backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {uploading ? (
                  <span style={{
                    fontSize: isMobile ? ".8rem" : ".9rem", fontWeight: 800, color: "#fff",
                    fontVariantNumeric: "tabular-nums"
                  }}>
                    {shown}%
                  </span>
                ) : phase === "finalizing" ? (
                  <span style={{
                    width: isMobile ? 14 : 16, height: isMobile ? 14 : 16, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.25)", borderTopColor: meta.to,
                    animation: "upc-spin .8s linear infinite", display: "block"
                  }} />
                ) : null}
              </div>
            </div>
            {phase === "encrypting" && (
              <span style={{ fontSize: ".72rem", fontWeight: 600, color: "rgba(255,255,255,0.85)", animation: "upc-pulse 1.4s ease-in-out infinite" }}>
                Getting ready…
              </span>
            )}
          </div>
        </div>

        {/* footer: name + progress bar + status */}
        <div style={{ padding: isMobile ? "10px 13px 11px" : "12px 15px 13px", background: "rgba(255,255,255,0.055)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <span style={{
              fontSize: isMobile ? ".78rem" : ".84rem", fontWeight: 650, color: "#fff",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0
            }}>
              {file.name}
            </span>
            {uploading && speed > 0 && (
              <span style={{ fontSize: ".68rem", color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {formatBytes(speed)}/s
              </span>
            )}
          </div>

          <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.07)", overflow: "hidden", position: "relative" }}>
            {indeterminate ? (
              <div style={{
                position: "absolute", top: 0, bottom: 0, left: 0, width: "25%", borderRadius: 4,
                background: `linear-gradient(90deg, transparent, ${meta.from}, ${meta.to}, transparent)`,
                animation: "upc-indeterminate 1.2s ease-in-out infinite"
              }} />
            ) : (
              <div style={{
                height: "100%", borderRadius: 4, width: `${eased}%`,
                background: `linear-gradient(90deg, ${meta.from}, ${meta.to})`,
                boxShadow: `0 0 10px ${meta.from}55`
              }} />
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, gap: 8 }}>
            <span style={{ fontSize: ".68rem", fontWeight: 600, color: uploading ? "rgba(255,255,255,0.55)" : meta.to }}>
              {statusText}
            </span>
            <span style={{ fontSize: ".68rem", color: "rgba(255,255,255,0.42)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {file.total ? amountText : formatBytes(file.size)}{etaText ? ` · ${etaText}` : ""}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Compact variant: files & anything without a preview ──
  return (
    <div style={{
      position: "relative",
      width: "100%",
      overflow: "hidden",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.06)",
      background: "linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
      boxShadow: "0 4px 24px rgba(0,0,0,0.18)"
    }}>
      <style>{`
        @keyframes upc-sweep {
          0% { transform: translateX(-120%) skewX(-14deg); }
          100% { transform: translateX(340%) skewX(-14deg); }
        }
        @keyframes upc-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @keyframes upc-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes upc-dot {
          0% { box-shadow: 0 0 0 0 ${meta.from}55; }
          70% { box-shadow: 0 0 0 6px ${meta.from}00; }
          100% { box-shadow: 0 0 0 0 ${meta.from}00; }
        }
      `}</style>

      <div style={{ padding: isMobile ? "13px 14px 11px" : "15px 16px 12px", display: "flex", alignItems: "center", gap: 13 }}>
        {/* icon tile */}
        <div style={{
          width: isMobile ? 46 : 54, height: isMobile ? 46 : 54, flexShrink: 0, borderRadius: 12,
          background: `linear-gradient(135deg, ${meta.from}26, ${meta.to}14)`,
          border: `1px solid ${meta.from}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: isMobile ? 20 : 23
        }}>
          📄
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? ".84rem" : ".9rem", fontWeight: 650, color: "#fff",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
          }}>
            {file.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
            <span style={{
              fontSize: ".6rem", fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase",
              color: meta.to, background: `${meta.from}1a`,
              padding: "2px 7px", borderRadius: 5, border: `1px solid ${meta.from}30`
            }}>
              {meta.label}
            </span>
            <span style={{ fontSize: ".68rem", color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
              {formatBytes(file.size)}
            </span>
          </div>
        </div>

        {/* % ring */}
        <div style={{
          width: isMobile ? 44 : 50, height: isMobile ? 44 : 50, flexShrink: 0,
          borderRadius: "50%", position: "relative",
          background: `conic-gradient(${meta.from} ${eased * 3.6}deg, rgba(255,255,255,0.06) ${eased * 3.6}deg)`,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            position: "absolute", inset: 3, borderRadius: "50%",
            background: "#14151d", border: "1px solid rgba(255,255,255,0.055)"
          }} />
          {uploading ? (
            <span style={{
              position: "relative", fontSize: isMobile ? ".66rem" : ".72rem", fontWeight: 800,
              color: "#fff", fontVariantNumeric: "tabular-nums"
            }}>
              {shown}%
            </span>
          ) : phase === "finalizing" ? (
            <span style={{
              position: "relative", width: isMobile ? 12 : 14, height: isMobile ? 12 : 14,
              borderRadius: "50%", display: "block",
              border: "2px solid rgba(255,255,255,0.25)", borderTopColor: meta.to,
              animation: "upc-spin .8s linear infinite"
            }} />
          ) : (
            <span style={{ position: "relative", fontSize: ".7rem" }}>🔒</span>
          )}
        </div>
      </div>

      <div style={{ padding: isMobile ? "0 14px 11px" : "0 16px 13px" }}>
        <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
          {indeterminate ? (
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: 0, width: "25%", borderRadius: 4,
              background: `linear-gradient(90deg, transparent, ${meta.from}, ${meta.to}, transparent)`,
              animation: "upc-indeterminate 1.2s ease-in-out infinite"
            }} />
          ) : (
            <div style={{
              height: "100%", borderRadius: 4, width: `${eased}%`,
              background: `linear-gradient(90deg, ${meta.from}, ${meta.to})`,
              boxShadow: `0 0 10px ${meta.from}55`
            }} />
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: meta.from,
              animation: "upc-dot 1.5s ease-out infinite"
            }} />
            <span style={{
              fontSize: ".68rem", fontWeight: 600,
              color: uploading ? "rgba(255,255,255,0.55)" : meta.to,
              animation: !uploading ? "upc-pulse 1.4s ease-in-out infinite" : "none",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
            }}>
              {statusText}
            </span>
          </span>
          {uploading && (
            <span style={{ fontSize: ".68rem", color: "rgba(255,255,255,0.42)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {speed > 0 ? `${formatBytes(speed)}/s · ` : ""}{amountText}{etaText ? ` · ${etaText}` : ""}
            </span>
          )}
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: 14 }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: "28%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          animation: "upc-sweep 2.2s ease-in-out infinite"
        }} />
      </div>
    </div>
  );
};
// ── View-Once "Burn After Reading" Text Bubble ──
function ViewOnceText({ text, messageId, onRevealComplete }) {
  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0) {
      onRevealComplete?.(messageId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  if (revealed) {
    return (
      <div style={{ position: "relative", padding: "2px 0" }}>
        <div style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{text}</div>
        {countdown > 0 && (
          <div style={{ fontSize: "0.68rem", color: "#f59e0b", fontWeight: 700, marginTop: 6, opacity: 0.85, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1s infinite" }} />
            Auto-deleting in {countdown}s
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => { setRevealed(true); setCountdown(10); }}
      style={{
        cursor: "pointer", padding: "14px 18px", borderRadius: 12,
        background: "rgba(129,140,248,0.06)", border: "1px dashed rgba(129,140,248,0.25)",
        textAlign: "center", userSelect: "none", transition: "all 0.2s"
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(129,140,248,0.12)"; e.currentTarget.style.borderColor = "rgba(129,140,248,0.4)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(129,140,248,0.06)"; e.currentTarget.style.borderColor = "rgba(129,140,248,0.25)"; }}
    >
      <span style={{ fontSize: "1.4rem" }}>🔒</span>
      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#818cf8", marginTop: 6 }}>
        View once message — tap to reveal
      </div>
      <div style={{ fontSize: "0.68rem", opacity: 0.5, marginTop: 3 }}>
        Message will be deleted 10s after viewing
      </div>
    </div>
  );
}

function E2EEFileAttachment({ file, roomKey, setFullscreen, isMobile, setViewer, reactions, messageId, onToggleReaction, reactionsEnabled = true }) {
  const fileType = getFileType(file);
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [viewedOnce, setViewedOnce] = useState(false);
  const containerRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // Clean up decrypted blob URLs to prevent memory leaks in the browser
  useEffect(() => {
    return () => {
      if (decryptedUrl && decryptedUrl.startsWith("blob:")) {
        URL.revokeObjectURL(decryptedUrl);
      }
    };
  }, [decryptedUrl]);

  const lastDecryptedIvRef = useRef(null);
  const lastDecryptedSourceUrlRef = useRef(null);
  const bypassProxyRef = useRef(false);

  const hasReactions = reactionsEnabled && Object.keys(reactions || {}).length > 0;
  const InlineReactions = hasReactions ? (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
      {Object.entries(reactions).map(([emoji, users]) => (
        <button
          key={emoji}
          type="button"
          title={Object.values(users).map((u) => u.name).join(", ")}
          onClick={(e) => { e.stopPropagation(); onToggleReaction?.(messageId, emoji); }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: isMobile ? "1px 6px" : "2px 7px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(129,140,248,.22)",
            color: "#c7d2fe",
            cursor: "pointer",
            fontSize: isMobile ? ".66rem" : ".7rem",
            lineHeight: 1.4,
            transition: ".2s",
          }}
        >
          <span style={{ fontSize: ".78rem", lineHeight: 1 }}>{emoji}</span>
          <span style={{ fontWeight: 700 }}>{Object.keys(users).length}</span>
        </button>
      ))}
    </div>
  ) : null;

  // Join the shared gallery once this media is viewable (skips view-once)
  useEffect(() => {
    if (!decryptedUrl || file.viewOnce) return;
    let registered = false;
    if (fileType.startsWith("image") || fileType.startsWith("video")) {
      registerGalleryMedia(file.url, { url: decryptedUrl, name: file.name, type: fileType });
      registered = true;
    }
    // Leave the gallery when this message unmounts (deleted/swept) — no ghosts
    return () => {
      if (registered) mediaGalleryRegistry.delete(file.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decryptedUrl]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;
    if (!file || !file.url) {
      setError(true);
      setLoading(false);
      return;
    }
    if (!file.iv && !file.keyB64) {
      setDecryptedUrl(file.url);
      setLoading(false);
      if (!fileType.startsWith("image") && !fileType.startsWith("video")) {
        setMediaLoaded(true);
      }
      return;
    }
    if (file.iv && !roomKey && !file.keyB64) {
      setError(true);
      setLoading(false);
      return;
    }

    if (decryptedUrl && lastDecryptedIvRef.current === file.iv) {
      lastDecryptedSourceUrlRef.current = file.url;
      return;
    }

    let active = true;
    bypassProxyRef.current = false;
    const decrypt = async (bypassProxy = false) => {
      try {
        setLoading(true);
        setError(false);

        // Remote files go through the backend proxy for CORS-safe fetching.
        // If the proxy is unavailable (404/5xx), fall back to the direct URL —
        // Cloudinary serves ACAO:* so the encrypted blob still downloads.
        let fetchUrl = file.url;
        const needsProxy = !bypassProxy && !file.url.startsWith(window.location.origin) && !file.url.includes("/uploads/");
        if (needsProxy) {
          fetchUrl = `${backendUrl}/api/proxy-file?url=${encodeURIComponent(file.url)}`;
        }

        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const encryptedBuffer = await res.arrayBuffer();

        if (encryptedBuffer.byteLength === 0) {
          throw new Error("Received empty response from server.");
        }

        const ivBytes = new Uint8Array(
          atob(file.iv)
            .split("")
            .map(c => c.charCodeAt(0))
        );

        let decryptionKey = roomKey;
        if (file.keyB64) {
          decryptionKey = await importKey(file.keyB64);
        }

        if (!decryptionKey) {
          throw new Error("No decryption key available.");
        }

        const decryptedBuffer = await decryptBinary(decryptionKey, {
          iv: ivBytes,
          data: encryptedBuffer
        });

        const blob = new Blob([decryptedBuffer], { type: file.type || "application/octet-stream" });
        const objectUrl = URL.createObjectURL(blob);

        if (active) {
          setDecryptedUrl(objectUrl);
          lastDecryptedIvRef.current = file.iv;
          lastDecryptedSourceUrlRef.current = file.url;
          setLoading(false);
          if (!fileType.startsWith("image") && !fileType.startsWith("video")) {
            setMediaLoaded(true);
          }
        }
      } catch (err) {
        console.error("File decryption failed:", err.message || err);
        console.error("  file.url:", file?.url);
        console.error("  file.iv present:", !!file?.iv, "  iv length:", file?.iv?.length);
        console.error("  file.keyB64 present:", !!file?.keyB64);
        console.error("  roomKey present:", !!roomKey);
        // Proxy unreachable (deploy gap) → one direct-URL retry before surfacing the error card
        if (active && !bypassProxyRef.current) {
          bypassProxyRef.current = true;
          decrypt(true);
          return;
        }
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };

    decrypt();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, file.url, file.iv, roomKey, file.keyB64, retryTick]);

  if (loading) {
    return (
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "10px" }}>
        <div style={{
          width: 16, height: 16, border: "2px solid rgba(255,255,255,0.07)",
          borderTop: "2px solid var(--chakra-colors-brandPrimary)",
          borderRadius: "50%", animation: "spin 0.8s linear infinite"
        }} />
        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Loading secure file...</span>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "rgba(255, 107, 107, 0.05)", borderRadius: "10px", border: "1px solid rgba(255, 107, 107, 0.2)", color: "#ff6b6b" }}>
        <span style={{ fontSize: "0.85rem" }}>🔒 File decryption failed</span>
        <button
          onClick={() => { setError(false); setLoading(true); setRetryTick(t => t + 1); }}
          style={{ marginLeft: "auto", fontSize: "0.75rem", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,107,107,0.35)", background: "transparent", color: "#ff6b6b", cursor: "pointer" }}
        >Retry</button>
      </div>
    );
  }

  if (file.viewOnce) {
    if (viewedOnce) {
      return <FileAttachmentWrapper ref={containerRef} style={{ padding: 16, cursor: "default", color: "var(--chakra-colors-textSecondary)", textAlign: "center" }}>🔒 View-once media opened</FileAttachmentWrapper>;
    }
    return (
      <FileAttachmentWrapper ref={containerRef} onClick={() => { setViewedOnce(true); setFullscreen({ ...file, url: decryptedUrl, viewOnce: true }); }} style={{ display: "grid", placeItems: "center", textAlign: "center", padding: 16 }}>
        <div><div style={{ fontSize: "1.8rem", marginBottom: 8 }}>🔒</div><strong>View once</strong><div style={{ fontSize: ".75rem", opacity: .7, marginTop: 4 }}>Open media · unavailable after viewing</div></div>
      </FileAttachmentWrapper>
    );
  }

  const actionBtnStyle = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 4, padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(129,140,248,.15)", color: "#c7d2fe", cursor: "pointer",
    fontSize: isMobile ? ".66rem" : ".7rem", fontWeight: 600, lineHeight: 1.4,
    transition: "background .2s, border-color .2s", whiteSpace: "nowrap",
    height: isMobile ? 24 : 26,
  };

  const isImage = fileType && fileType.startsWith("image");
  const isVideo = fileType && fileType.startsWith("video");
  const isAudio = fileType && fileType.startsWith("audio");

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <FileAttachmentWrapper ref={containerRef} style={{ padding: 0, overflow: "hidden" }}>
        {isImage ? (
          <div
            onClick={() => mediaLoaded && setFullscreen({ ...file, url: decryptedUrl })}
            style={{ position: "relative", borderRadius: 16, overflow: "hidden", cursor: mediaLoaded ? "pointer" : "default" }}
          >
            {!mediaLoaded && <MediaSkeleton isMobile={isMobile} />}
            <img
              alt={file.name}
              src={decryptedUrl || file.url}
              decoding="async"
              onLoad={() => setMediaLoaded(true)}
              onError={() => setMediaLoaded(true)}
              style={{ width: "100%", height: "auto", maxHeight: isMobile ? "240px" : "300px", objectFit: "cover", display: mediaLoaded ? "block" : "none", borderRadius: 0, background: "rgba(0,0,0,0.25)" }}
            />
          </div>
        ) : isVideo ? (
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
            {!mediaLoaded && <MediaSkeleton isMobile={isMobile} />}
            <video
              src={decryptedUrl || file.url}
              controls
              playsInline
              preload="auto"
              onLoadedData={() => setMediaLoaded(true)}
              onError={() => setMediaLoaded(true)}
              style={{ width: "100%", height: "auto", maxHeight: isMobile ? "240px" : "300px", objectFit: "contain", display: mediaLoaded ? "block" : "none", background: "#000" }}
            />
          </div>
        ) : isAudio ? (
          <div style={{ padding: "10px 12px", background: "rgba(255, 255, 255, 0.02)", cursor: "default", width: "100%", boxSizing: "border-box" }}>
            <PlaybackSpeedAudio file={file} decryptedUrl={decryptedUrl} />
          </div>
        ) : (
          <div
            style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "12px",
              background: "rgba(255, 255, 255, 0.02)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.055)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)", minWidth: 0, width: "100%", boxSizing: "border-box"
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 38, height: 38, borderRadius: "10px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.07)",
              fontSize: "1.3rem", flexShrink: 0
            }}>
              {file.name.match(/\.(xlsx|xls|csv)$/i) ? "📊" :
                file.name.match(/\.(docx|doc)$/i) ? "📝" :
                  file.name.match(/\.(zip|rar|7z)$/i) ? "🗜️" :
                    file.name.match(/\.pdf$/i) ? "📕" : "📎"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, flex: 1, textAlign: "left" }}>
              <span style={{ fontWeight: "600", fontSize: "0.8rem", color: "var(--chakra-colors-textPrimary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {file.name}
              </span>
              <span style={{ fontSize: "0.68rem", color: "var(--chakra-colors-brandPrimary)", marginTop: "1px", fontWeight: "600" }}>
                🔒 Secure E2EE Payload
              </span>
            </div>
          </div>
        )}
      </FileAttachmentWrapper>

      {/* Unified actions + reactions row below the media card */}
      {mediaLoaded && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, alignItems: "center", paddingLeft: 2 }}>
          {!file.viewOnce && isImage && (
            <>
              <button type="button" title="Copy to clipboard" onClick={(e) => { e.stopPropagation(); copyImageToClipboard(decryptedUrl); }} style={actionBtnStyle}>
                <Copy size={12} /> Copy
              </button>
              <button type="button" title="Download" onClick={(e) => { e.stopPropagation(); downloadMedia(decryptedUrl, file.name); }} style={actionBtnStyle}>
                <FaDownload size={10} /> Save
              </button>
              <button type="button" title="Expand" onClick={(e) => { e.stopPropagation(); setFullscreen({ ...file, url: decryptedUrl }); }} style={actionBtnStyle}>
                Expand
              </button>
            </>
          )}
          {!file.viewOnce && isVideo && (
            <>
              <button type="button" title="Copy video link" onClick={(e) => { e.stopPropagation(); copyLinkToClipboard(decryptedUrl); }} style={actionBtnStyle}>
                <Copy size={12} /> Copy
              </button>
              <button type="button" title="Download" onClick={(e) => { e.stopPropagation(); downloadMedia(decryptedUrl, file.name); }} style={actionBtnStyle}>
                <FaDownload size={10} /> Save
              </button>
              <button type="button" title="Fullscreen" onClick={(e) => { e.stopPropagation(); setFullscreen({ ...file, url: decryptedUrl }); }} style={actionBtnStyle}>
                Fullscreen
              </button>
            </>
          )}
          {isAudio && (
            <button type="button" title="Download" onClick={(e) => { e.stopPropagation(); downloadMedia(decryptedUrl, file.name); }} style={actionBtnStyle}>
              <FaDownload size={10} /> Save
            </button>
          )}
          {!isImage && !isVideo && !isAudio && (
            <>
              <button type="button" title="Preview" onClick={() => setViewer({ url: decryptedUrl, name: file.name, type: file.type || getFileType(file) })} style={actionBtnStyle}>
                Preview
              </button>
              <button
                type="button"
                title="Download file"
                onClick={() => { const a = document.createElement("a"); a.href = decryptedUrl; a.download = file.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
                style={actionBtnStyle}
              >
                <FaDownload size={10} /> Save
              </button>
            </>
          )}
          {InlineReactions}
        </div>
      )}
    </div>
  );
}

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const GifSkeleton = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #13131c 25%, #252538 50%, #13131c 75%);
  background-size: 200% 100%;
  animation: ${shimmer} 1.6s infinite linear;
  border-radius: 14px;
`;

function GifCardComponent({ gif, onSelect }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <GifCard onClick={() => onSelect(gif)}>
      {!loaded && <GifSkeleton />}
      <GifItem
        src={gif.images.fixed_height_small?.webp || gif.images.fixed_height?.webp || gif.images.fixed_height.url}
        alt={gif.title || "GIF"}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.25s ease" }}
      />
      {loaded && (
        <CardOverlay>
          <FaPaperPlane style={{ color: "#fff", fontSize: "1.1rem" }} />
        </CardOverlay>
      )}
    </GifCard>
  );
}

/* ================= COMPONENT ================= */

// ── Local chat-history cache helpers (module scope) ─────────────────────────
const readHistoryCache = (rid) => {
  try { return JSON.parse(localStorage.getItem(`cheprabai:room-cache:${rid}`) || "[]"); } catch { return []; }
};
const writeHistoryCache = (rid, list) => {
  try {
    const capped = (list || []).slice(-200);
    localStorage.setItem(`cheprabai:room-cache:${rid}`, JSON.stringify(capped));
  } catch { /* storage unavailable (private mode) — skip */ }
};

export default function ChatRoom() {
  const { roomId: routeRoomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const liveFileRxRef = useRef(new Map());
  const livefileAckRef = useRef(new Map()); // fileId -> resolve() for completion handshake
  const liveTxAbortRef = useRef(false); // set true when our socket drops mid-relay so senders un-stick fast
  const onResolvedRef = useRef(null);
  const userColorsRef = useRef({});
  const roomKeyRef = useRef(null);
  const reconnectRef = useRef({ droppedInRoom: false });
  const userNameRef = useRef("");
  const roomIdRef = useRef("");
  const securityCodeRef = useRef("");
  const showMeetingRef = useRef(false);
  const getJoinPayloadRef = useRef(null);
  const handleJoinResultRef = useRef(null);
  const attemptJoinRef = useRef(null);
  // One-shot guard so a reopened screen auto-connects exactly once (a manual
  // form submit later is always allowed and refreshes the stored session).
  const autoJoinTriedRef = useRef(false);
  const tryRestoreRef = useRef(null);

  const [joined, setJoined] = useState(false);
  const [roomKey, setRoomKey] = useState(null);
  const [roomId, setRoomId] = useState(() => {
    return routeRoomId ? decodeURIComponent(routeRoomId) : "";
  });
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("cheprabai:user-avatar") || "");
  const [avatarCrop, setAvatarCrop] = useState(null);
  const userAvatarRef = useRef(userAvatar);
  const [roomBackground, setRoomBackground] = useState("");
  const [backgroundLocked, setBackgroundLocked] = useState(false);
  const [backgroundTarget, setBackgroundTarget] = useState(null);
  const [securityCode, setSecurityCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showLandingQr, setShowLandingQr] = useState(false);
  const [showDropdownQr, setShowDropdownQr] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [allowedIpsText, setAllowedIpsText] = useState("");
  const [bannedWords, setBannedWords] = useState([]);
  const [isScreenProtected, setIsScreenProtected] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const diagnosticsIntervalRef = useRef(null);
  const [messages, setMessages] = useState([]);
  // ── Local chat-history cache ──────────────────────────────────────────────
  // Real chat history lives on the backend, but on Vercel serverless the room's
  // in-memory queue can be lost between a quick leave & rejoin (instance swap /
  // cold start). To make a user's view survive that, we keep a lightweight local
  // copy of the stable (non-ephemeral) messages per room and restore it on rejoin
  // whenever the server returns empty history. Helpers live at module scope.
  const historyCacheRoomRef = useRef("");
  useEffect(() => {
    if (!joined || !roomKey) return;
    const rid = roomId.trim();
    historyCacheRoomRef.current = rid;
    const stable = messages.filter((m) => {
      if (!m || m.ephemeral) return false;
      if (m.id && /^(uploading|liveshare|rx)-/.test(m.id)) return false;
      if (m.payload?.__livefile || m.__livefile) return false;
      return true;
    });
    writeHistoryCache(rid, stable);
  }, [messages, joined, roomKey, roomId]);
  const [message, setMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const typingFirstSeenRef = useRef(new Map()); // name -> ts first seen (hard-expiry guard)
  const onlineNamesRef = useRef(new Set());
  const [viewer, setViewer] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [pendingFiles, setPendingFiles] = useState([]);
  const [sendAsViewOnce, setSendAsViewOnce] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  // Code block mode: wraps the next sent message in ``` fences so pasted code
  // always renders as a real code block with formatting intact.
  const [codeBlockMode, setCodeBlockMode] = useState(false);
  const [codeViewer, setCodeViewer] = useState(null);
  const [codePane, setCodePane] = useState("code");
  useEffect(() => {
    // Inline onclick inside dangerouslySetInnerHTML can't reach React handlers,
    // and pasting code INTO attribute strings breaks on quotes (require('fs')…).
    // So blocks register their payload here and buttons pass only a safe id.
    window.__cheprabaiCodeRegistry = {};
    let seq = 0;
    window.__cheprabaiRegisterCode = (code, lang) => {
      const id = "cb" + ++seq;
      window.__cheprabaiCodeRegistry[id] = { code, lang };
      return id;
    };
    window.__cheprabaiOpenCodeById = (id) => {
      const entry = window.__cheprabaiCodeRegistry[id];
      if (!entry) return;
      const isHtml =
        (entry.lang || "").toLowerCase() === "html" ||
        /^\s*<!doctype\s+html/i.test(entry.code) ||
        /^\s*<html[\s>]/i.test(entry.code);
      setCodePane(isHtml ? "ui" : "code");
      setCodeViewer({ code: entry.code, lang: entry.lang || "", html: isHtml });
    };
    window.__cheprabaiCopyCodeById = (id, btn) => {
      const entry = window.__cheprabaiCodeRegistry[id];
      if (!entry) return;
      const done = () => {
        if (!btn) return;
        btn.innerText = "\u2713 Copied";
        btn.style.color = "#00bfa5";
        setTimeout(() => { btn.innerText = "Copy"; btn.style.color = "inherit"; }, 2000);
      };
      const notify = () => toast.success("📋 Code copied!");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(entry.code).then(() => { done(); notify(); }).catch(() => {
          toast.error("Could not copy code");
        });
      } else {
        const ta = document.createElement("textarea");
        ta.value = entry.code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) { }
        document.body.removeChild(ta);
        done();
        notify();
      }
    };
    return () => {
      delete window.__cheprabaiOpenCodeById;
      delete window.__cheprabaiCopyCodeById;
      delete window.__cheprabaiRegisterCode;
      delete window.__cheprabaiCodeRegistry;
    };
  }, []);
  // Swipe-to-reply gesture — user preference, persisted locally (default: on)
  const [swipeReplyEnabled, setSwipeReplyEnabled] = useState(() => {
    try { return localStorage.getItem("cheprabai_swipeReply") !== "0"; } catch { return true; }
  });
  const toggleSwipeReply = () => setSwipeReplyEnabled(prev => {
    const next = !prev;
    try { localStorage.setItem("cheprabai_swipeReply", next ? "1" : "0"); } catch { /* private mode */ }
    return next;
  });
  const [muteSounds, setMuteSounds] = useState(() => {
    try { return localStorage.getItem("cheprabai_muteSounds") === "1"; } catch { return false; }
  });
  const toggleMuteSounds = () => setMuteSounds(prev => {
    const next = !prev;
    try { localStorage.setItem("cheprabai_muteSounds", next ? "1" : "0"); } catch { /* private mode */ }
    return next;
  });
  // Notification sound choice: persisted in localStorage; socket handlers read via ref
  const [soundChoice, setSoundChoice] = useState(getSoundChoice);
  const soundChoiceRef = useRef(soundChoice);
  const muteSoundsRef = useRef(muteSounds);
  useEffect(() => { muteSoundsRef.current = muteSounds; }, [muteSounds]);
  useEffect(() => { soundChoiceRef.current = soundChoice; persistSoundChoice(soundChoice); }, [soundChoice]);

  const [shoulderSurfingProtection, setShoulderSurfingProtection] = useState(() => {
    try { return localStorage.getItem("cheprabai_shoulderSurfing") === "1"; } catch { return false; }
  });
  const toggleShoulderSurfing = () => setShoulderSurfingProtection(prev => {
    const next = !prev;
    try { localStorage.setItem("cheprabai_shoulderSurfing", next ? "1" : "0"); } catch { /* private mode */ }
    return next;
  });
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
  const [participantProfiles, setParticipantProfiles] = useState({});
  const [viewedByTarget, setViewedByTarget] = useState(null);
  const messageRefs = useRef({});
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  const highlightTimerRef = useRef(null);
  const jumpToMessage = (id) => {
    if (!id) return;
    let el = messageRefs.current[id];
    if (!el && typeof document !== "undefined" && typeof CSS !== "undefined" && CSS.escape) {
      el = document.querySelector(`[data-mid="${CSS.escape(String(id))}"]`);
    }
    if (!el) {
      toast.info("Original message is not loaded in this view");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightMessageId(null);
    requestAnimationFrame(() => setHighlightMessageId(String(id)));
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightMessageId(null), 2600);
  };
  const [pendingFilesUrls, setPendingFilesUrls] = useState({});
  const pendingFilesUrlsRef = useRef({});
  const leaveRoomNowRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(null);

  useEffect(() => {
    const handleBlur = () => setIsWindowBlurred(true);
    const handleFocus = () => setIsWindowBlurred(false);

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    if (typeof document !== "undefined" && !document.hasFocus()) {
      setIsWindowBlurred(true);
    }

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Gallery keyboard controls for the fullscreen media viewer
  useEffect(() => {
    if (!fullscreen) return;
    const onGalleryKey = (e) => {
      if (e.key === "Escape") {
        setFullscreen(null);
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = fullscreen.type || "";
      if (!t.startsWith("image") && !t.startsWith("video")) return;
      const items = getGalleryItems();
      if (items.length < 2) return;
      const idx = items.findIndex((it) => it.url === fullscreen.url);
      if (idx === -1) return;
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = items[(idx + dir + items.length) % items.length];
      setFullscreen({ url: next.url, name: next.name, type: next.type });
    };
    window.addEventListener("keydown", onGalleryKey);
    return () => window.removeEventListener("keydown", onGalleryKey);
  }, [fullscreen]);
  const isMobile = useIsMobile();
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const composerRef = useRef(null);
  const [ownerToken, setOwnerToken] = useState(() => {
    const match = window.location.pathname.match(/\/room\/([^/]+)/);
    const rId = match ? match[1] : "";
    return rId ? sessionStorage.getItem(`cheprabai:owner-token:${rId}`) || "" : "";
  });
  const [onlineUsers, setOnlineUsers] = useState([]);

  React.useEffect(() => {
    if (roomId) {
      const savedToken = sessionStorage.getItem(`cheprabai:owner-token:${roomId}`);
      setOwnerToken(savedToken || "");
    } else {
      setOwnerToken("");
    }
  }, [roomId]);
  const [screenLocked, setScreenLocked] = useState(false);

  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const closeMeeting = useCallback(() => { setShowMeeting(false); }, []);
  // Track an open standalone whiteboard so the plan upsell never pops over it.
  const showWhiteboardRef = useRef(false);
  useEffect(() => { showWhiteboardRef.current = showWhiteboard; }, [showWhiteboard]);
  const [roomPlan, setRoomPlan] = useState(null);
  const [roomPlanLimits, setRoomPlanLimits] = useState({});
  const planAutoOpenedRef = useRef(false);
  const [planOverride, setPlanOverride] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const ringtoneRef = useRef(null);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [latency, setLatency] = useState(0);
  const [gifQuery, setGifQuery] = useState("");

  const [gifs, setGifs] = useState([]);
  const [gifOffset, setGifOffset] = useState(0);
  const [hasMoreGifs, setHasMoreGifs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // ── Pinned Messages ──
  const [pinnedMessages, setPinnedMessages] = useState([]);

  // ── Message Editing ──
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInput, setEditInput] = useState("");

  // ── Polls ──
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // ── Mentions & Notifications ──
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // ── Slash commands ──
  const SLASH_COMMANDS = [
    { cmd: "/ai", label: "AI Assistant", desc: "Ask CheprabAI anything", icon: "✦" },
  ];
  const [slashSuggestions, setSlashSuggestions] = useState([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const [showSlashSuggestions, setShowSlashSuggestions] = useState(false);

  // ── Message Forwarding ──
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardRoomId, setForwardRoomId] = useState("");
  const [forwardSecurityCode, setForwardSecurityCode] = useState("");

  // ── Ephemeral Messages ──
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const [roomEphemeralDuration, setRoomEphemeralDuration] = useState(0); // 0 means OFF, positive is seconds
  const [showEphemeralMenu, setShowEphemeralMenu] = useState(false);
  const [customEphemeralOpen, setCustomEphemeralOpen] = useState(false);
  const [customEphemeralValue, setCustomEphemeralValue] = useState("");
  const [customEphemeralUnit, setCustomEphemeralUnit] = useState("min");
  const [confirmation, setConfirmation] = useState(null);
  const [exportPwdOpen, setExportPwdOpen] = useState(false);
  const [exportPwdValue, setExportPwdValue] = useState("");
  const [exportPwdErr, setExportPwdErr] = useState("");
  const exportPwdResolveRef = useRef(null);
  const DEFAULT_EPHEMERAL_DURATION = 300; // fallback seconds (5 min) — 15s was silently destroying messages

  const isCustomEphemeral = roomEphemeralDuration > 0 && !EPHEMERAL_PRESETS.some((p) => p.value === roomEphemeralDuration);
  const applyCustomEphemeral = () => {
    const n = parseInt(customEphemeralValue, 10);
    if (!Number.isFinite(n) || n <= 0) { toast.error("Enter a positive number."); return; }
    const unit = CUSTOM_EPHEMERAL_UNITS.find((u) => u.key === customEphemeralUnit) || CUSTOM_EPHEMERAL_UNITS[1];
    const secs = Math.min(n * unit.value, EPHEMERAL_MAX_SECONDS);
    socketRef.current.emit("updateRoomEphemeral", { roomId, ephemeralDuration: secs });
    toast.info(`💨 Messages will vanish after ${formatNearestUnit(secs)}`);
    setShowEphemeralMenu(false);
    setCustomEphemeralOpen(false);
  };
  const renderEphemeralMenuItems = () => (
    <>
      {EPHEMERAL_PRESETS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`option-btn ${!isCustomEphemeral && roomEphemeralDuration === opt.value ? 'active' : ''}`}
          onClick={() => {
            socketRef.current.emit("updateRoomEphemeral", { roomId, ephemeralDuration: opt.value });
            setShowEphemeralMenu(false);
            setCustomEphemeralOpen(false);
          }}
        >
          <span>{opt.label}</span>
          {!isCustomEphemeral && roomEphemeralDuration === opt.value && <span className="check">✓</span>}
        </button>
      ))}
      <button
        type="button"
        className={`option-btn ${isCustomEphemeral ? 'active' : ''}`}
        onClick={() => setCustomEphemeralOpen((v) => !v)}
      >
        <span>Custom…</span>
        {isCustomEphemeral && <span className="check">{formatNearestUnit(roomEphemeralDuration)}</span>}
      </button>
      {customEphemeralOpen && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 4px 2px" }}>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            autoFocus
            value={customEphemeralValue}
            onChange={(e) => setCustomEphemeralValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyCustomEphemeral(); }}
            placeholder="30"
            aria-label="Custom vanishing duration"
            style={{
              width: 64, padding: "6px 8px", borderRadius: 8,
              border: "1px solid var(--chakra-colors-border)",
              background: "var(--chakra-colors-bg)", color: "var(--chakra-colors-textPrimary)",
              fontSize: "0.8rem", outline: "none"
            }}
          />
          <select
            value={customEphemeralUnit}
            onChange={(e) => setCustomEphemeralUnit(e.target.value)}
            aria-label="Custom vanishing unit"
            style={{
              padding: "6px 6px", borderRadius: 8,
              border: "1px solid var(--chakra-colors-border)",
              background: "var(--chakra-colors-bg)", color: "var(--chakra-colors-textPrimary)",
              fontSize: "0.78rem"
            }}
          >
            {CUSTOM_EPHEMERAL_UNITS.map((u) => (
              <option key={u.key} value={u.key}>{u.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyCustomEphemeral}
            className="option-btn"
            style={{ width: "auto", padding: "6px 12px", justifyContent: "center", fontWeight: 700, color: "#ff6b72" }}
          >
            Set
          </button>
        </div>
      )}
    </>
  );

  // ── Voice Notes ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // ── Chat Pagination ──
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesContainerRef = useRef(null);

  const lastMessageIdRef = useRef(null);

  // ── Scheduled Messages ──
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  // ── Bookmarks / Saved Messages ──
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cheprabai:bookmarks") || "[]"); } catch { return []; }
  });
  const [showBookmarks, setShowBookmarks] = useState(false);

  const [stealthToken, setStealthToken] = useState(() => {
    return new URLSearchParams(window.location.search).get("stealth") || "";
  });
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [requireRoomApproval, setRequireRoomApproval] = useState(false);
  const [features, setFeatures] = useState(() => {
    const defaults = {
      fileSharing: true, voiceCalls: true, videoCalls: true, screenSharing: true,
      whiteboard: true, polls: true, scheduledMessages: true, reactions: true,
      messageEditing: true, giphySearch: true, profiles: true, linkPreviews: true,
      voiceRecordings: true, bookmarks: true, ephemeralMessages: true,
      messageSearch: true, messageForwarding: true, pinnedMessages: true,
      typingIndicators: true, stealthMode: true, meetingRecording: true,
      handRaise: true, themes: true, keyboardShortcuts: true,
    };
    return defaults;
  });
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const [roomExists, setRoomExists] = useState(true);
  const [roomRequestPending, setRoomRequestPending] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const stealthTokenRef = useRef("");

  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const getJoinPayload = useCallback(() => {
    const rId = roomId.trim();
    let sessionToken = sessionStorage.getItem(`anonchat:session-token:${rId}`);
    if (!sessionToken) {
      sessionToken = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem(`anonchat:session-token:${rId}`, sessionToken);
    }
    return {
      roomId: rId,
      userName: userName.trim(),
      securityCode,
      avatar: userAvatarRef.current,
      stealthToken: stealthTokenRef.current || undefined,
      ownerToken: sessionStorage.getItem(`cheprabai:owner-token:${rId}`) || undefined,
      sessionToken,
    };
  }, [roomId, userName, securityCode]);

  const handleJoinResult = useCallback((result) => {
    if (result?.error) {
      if (result.code === "NEEDS_APPROVAL") {
        setShowApprovalConfirm(true);
        setJoined(false);
        setAuthenticated(false);
        setRoomKey(null);
        toast.info("This room does not exist yet. Please request creation approval.");
        return;
      }
      toast.error(result.error);
      setJoined(false);
      setAuthenticated(false);
      setRoomKey(null);
      return;
    }
    if (result?.success) {
      try {
        sessionStorage.setItem(`anonchat:join:${roomId.trim()}`, JSON.stringify({
          userName: userName.trim(),
          securityCode: securityCode.trim(),
          joinedAt: Date.now()
        }));
      } catch { /* storage may be unavailable (private mode) — skip persistence */ }
      setIsStealthMode(Boolean(result.isStealth));
      setOnlineUsers((users) => users.length ? users : [{ id: socketRef.current?.id || "local", name: userName }]);
      if (!result.isStealth && roomId.trim()) {
        navigate(`/room/${encodeURIComponent(roomId.trim())}`, { replace: true });
      }
      setAuthenticated(true);
    }
  }, [roomId, userName, securityCode, navigate]);

  useEffect(() => { getJoinPayloadRef.current = getJoinPayload; }, [getJoinPayload]);
  useEffect(() => { handleJoinResultRef.current = handleJoinResult; }, [handleJoinResult]);

  // Auto-reconnect after the user reopens the app at /room/:id: restore the
  // stored join credentials and rejoin silently, instead of stranding them on
  // a dead socket or an empty join form. The form is still shown if no session
  // exists. Guarded to run at most once per page load.
  useEffect(() => {
    const tryRestore = () => {
      if (autoJoinTriedRef.current) return;
      if (stealthTokenRef.current) return;
      const rid = roomIdRef.current && roomIdRef.current.trim();
      if (!rid) return;
      let sess;
      try {
        const raw = sessionStorage.getItem(`anonchat:join:${rid}`);
        sess = raw ? JSON.parse(raw) : null;
      } catch { return; }
      if (!sess || !sess.userName || !sess.securityCode) return;
      autoJoinTriedRef.current = true;
      setUserName(sess.userName);
      setSecurityCode(sess.securityCode);
      const fireWhenConnected = () => {
        if (socketRef.current?.connected) attemptJoinRef.current?.();
        else setTimeout(fireWhenConnected, 500);
      };
      typeof window !== "undefined" && setTimeout(fireWhenConnected, 200);
    };
    tryRestoreRef.current = tryRestore;
    const t = typeof window !== "undefined" ? setTimeout(tryRestore, 1000) : null;
    return () => { if (t) clearTimeout(t); };
  }, []);

  const attemptJoin = useCallback(async () => {
    const code = securityCode.trim();
    const trimmedRoom = roomId.trim();
    const trimmedName = userName.trim();

    if (!trimmedRoom) {
      toast.error("Please enter a room ID.");
      return;
    }
    if (!trimmedName) {
      toast.error("Please enter a display name.");
      return;
    }
    if (!code) {
      toast.error("Please enter a security code.");
      return;
    }

    if (!socketRef.current || !socketRef.current.connected) {
      toast.error("Connecting to server. Please wait a moment and try again.");
      return;
    }

    try {
      const key = await generateKeyFromSecret(code + trimmedRoom, trimmedRoom);
      try {
        sessionStorage.setItem(`anonchat:join:${trimmedRoom}`, JSON.stringify({
          userName: trimmedName,
          securityCode: code,
          joinedAt: Date.now()
        }));
      } catch { /* storage may be unavailable (private mode) — skip persistence */ }
      setRoomId(trimmedRoom);
      setRoomKey(key);
      setJoined(true);
    } catch {
      toast.error("Failed to initialize secure session keys");
    }
  }, [roomId, userName, securityCode]);

  useEffect(() => { attemptJoinRef.current = attemptJoin; }, [attemptJoin]);

  const submitRoomRequest = useCallback(() => {
    const trimmedRoom = roomId.trim();
    const trimmedName = userName.trim();
    const trimmedCode = securityCode.trim();
    if (!trimmedRoom || !trimmedName || !trimmedCode) {
      toast.error("Room ID, display name, and security code are required.");
      return;
    }
    if (!socketRef.current?.connected) {
      toast.error("Connecting to server. Please wait a moment.");
      return;
    }
    socketRef.current.emit("requestRoomCreation", {
      roomId: trimmedRoom,
      userName: trimmedName,
      personalPassword: trimmedCode,
    }, (result) => {
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setRoomRequestPending(true);
      setPendingRequestId(result.requestId || "");
      setShowApprovalConfirm(false);
      toast.success("Creation request submitted successfully.");
    });
  }, [roomId, userName, securityCode]);

  const handleShareRoomLink = useCallback(async () => {
    if (!roomId.trim()) return;
    const shareUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId.trim())}`;
    const code = (securityCode || "").trim();
    const shareText = code
      ? `Join my secure room "${roomId.trim()}" on Cheprabai:\nLink: ${shareUrl}\nSecurity Code: ${code}`
      : `Join my secure room "${roomId.trim()}" on Cheprabai:\nLink: ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my secure chat room on Cheprabai",
          text: shareText,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(shareText);
            } else {
              await copyRoomShareLink(roomId.trim());
            }
            toast.success("Invite info copied!");
          } catch {
            toast.error("Could not share link.");
          }
        }
      }
    } else {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareText);
        } else {
          await copyRoomShareLink(roomId.trim());
        }
        toast.success("Invite info copied!");
      } catch {
        toast.error("Could not copy link. Try again.");
      }
    }
  }, [roomId, securityCode]);

  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareQr = async (url, rootEl) => {
    // Capture the QR as an image. We ALWAYS resolve to the QR image (download or
    // native file-share) — never fall back to copying the room text, which is
    // what made tapping the QR look like it "copied the room details" instead of
    // sharing the QR itself.
    const svg = (rootEl && rootEl.querySelector("svg")) || document.querySelector(".qr-container-el svg");
    if (!svg) {
      toast.error("Could not find the QR code to share.");
      return;
    }

    const svgString = new XMLSerializer().serializeToString(svg);
    // Inject a white background + explicit dimensions into the SVG so the PNG is
    // never blank and renders at a crisp, shareable size regardless of layout.
    const vb = (svg.getAttribute("viewBox") || "0 0 250 250").split(" ").map(Number);
    const width = Math.max(256, Math.round(vb[2]) || 250);
    const height = Math.max(256, Math.round(vb[3]) || 250);
    const decorated =
      svgString.startsWith("<svg")
        ? svgString.replace(/^<svg([^>]*)/, `<svg$1 width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff"`)
        : svgString;

    const svgBlob = new Blob([decorated], { type: "image/svg+xml;charset=utf-8" });
    const SVGURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(SVGURL);
        canvas.toBlob((blob) => {
          if (!blob) {
            toast.error("Could not generate the QR image.");
            return;
          }
          const file = new File([blob], "anonchat-qr.png", { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: "Join AnonChat Room", text: `Join my secure AnonChat room: ${url}` })
              .catch((shareErr) => {
                if (shareErr && shareErr.name !== "AbortError") downloadBlob(blob);
              });
          } else {
            downloadBlob(blob);
            toast.success("QR code downloaded!");
          }
        }, "image/png");
      } catch (err) {
        console.error("Error rasterizing QR code:", err);
        toast.error("Could not generate the QR image.");
      }
    };
    image.onerror = () => {
      console.error("QR SVG failed to load for rasterization");
      URL.revokeObjectURL(SVGURL);
      toast.error("Could not generate the QR image.");
    };
    image.src = SVGURL;
  };
  const isScrollingRef = useRef(false);

  // ── Drag & Drop ──
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);


  useEffect(() => {
    if (ownerToken || isStealthMode) {
      setScreenLocked(false);
      return;
    }

    const handleBlur = () => {
      setScreenLocked(true);
    };

    const handleFocus = () => {
      setScreenLocked(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setScreenLocked(true);
      } else {
        setScreenLocked(false);
      }
    };

    const handleKeyDown = (e) => {
      if (
        e.key === "PrintScreen" ||
        (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5"))
      ) {
        setScreenLocked(true);
        toast.warning("🔒 Screenshot attempt blocked. Content is protected.");
        navigator.clipboard?.writeText?.("");
        e.preventDefault();
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [ownerToken, isStealthMode]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      // 1. Close emoji picker
      if (showEmojiPicker) {
        const isPicker = e.target.closest(".emoji-picker-container");
        const isToggle = e.target.closest(".emoji-picker-toggle-btn");
        if (!isPicker && !isToggle) {
          setShowEmojiPicker(false);
        }
      }

      // 2. Close message reaction picker
      if (reactionPickerFor !== null) {
        const isReactionPicker = e.target.closest(`.reaction-picker-${reactionPickerFor}`);
        const isReactionToggle = e.target.closest(`.reaction-btn-${reactionPickerFor}`);
        if (!isReactionPicker && !isReactionToggle) {
          setReactionPickerFor(null);
        }
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showEmojiPicker, reactionPickerFor]);

  useEffect(() => {
    if (joined && roomId) {
      const bg = localStorage.getItem(`cheprabai:room-background:${roomId}`) || "";
      setRoomBackground(bg);
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") registerPushSubscription(roomId.trim());
        });
      } else if ("Notification" in window && Notification.permission === "granted") {
        registerPushSubscription(roomId.trim());
      }
    }

    async function registerPushSubscription(rid) {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const vapidRes = await fetch(`${backendUrl}/api/push/vapid`);
        if (!vapidRes.ok) return;
        const { publicKey } = await vapidRes.json();
        if (!publicKey) return;
        const urlBase64ToUint8Array = (base64String) => {
          const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
          const raw = atob(base64);
          const arr = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
          return arr;
        };
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }
        await fetch(`${backendUrl}/api/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub, roomId: rid, userName: userName.trim(), senderSocketId: socketRef.current?.id }),
        });
      } catch (_) { /* push registration is best-effort */ }
    }
  }, [joined, roomId, userName]);

  useEffect(() => {
    userAvatarRef.current = userAvatar;
  }, [userAvatar]);

  useEffect(() => { roomKeyRef.current = roomKey; }, [roomKey]);
  useEffect(() => { userNameRef.current = userName; }, [userName]);
  useEffect(() => { onlineNamesRef.current = new Set(onlineUsers.map((u) => u.name)); }, [onlineUsers]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { securityCodeRef.current = securityCode; }, [securityCode]);
  useEffect(() => { showMeetingRef.current = showMeeting; }, [showMeeting]);

  useEffect(() => {
    const { roomId: parsedRoomId, stealthToken: parsedStealth } = parseRoomRouteParams(
      { roomId: routeRoomId },
      searchParams
    );
    if (parsedRoomId) setRoomId(parsedRoomId);
    const parsedKey = searchParams.get("key") || "";
    if (parsedStealth) {
      setStealthToken(parsedStealth);
      stealthTokenRef.current = parsedStealth;
      if (parsedRoomId) {
        setUserName("Stealth Observer");
        if (parsedKey) {
          setSecurityCode(parsedKey);
          generateKeyFromSecret(parsedKey + parsedRoomId, parsedRoomId)
            .then((key) => {
              setRoomKey(key);
              setJoined(true);
            })
            .catch(() => {
              toast.error("Failed to generate secure keys for stealth mode.");
            });
        } else {
          setJoined(true);
        }
        const cleanUrl = `${window.location.origin}/room/${encodeURIComponent(parsedRoomId)}`;
        window.history.replaceState(null, "", cleanUrl);
      }
    }
  }, [routeRoomId, searchParams]);

  useEffect(() => {
    stealthTokenRef.current = stealthToken;
  }, [stealthToken]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${backendUrl}/api/platform/settings`)
      .then((res) => (res.ok ? res.json() : { requireRoomApproval: false }))
      .then((data) => {
        if (!cancelled) setRequireRoomApproval(Boolean(data.requireRoomApproval));
      })
      .catch(() => {
        if (!cancelled) setRequireRoomApproval(false);
      });
    fetch(`${backendUrl}/api/platform/features`)
      .then((res) => (res.ok ? res.json() : { features: {} }))
      .then((data) => {
        if (!cancelled && data.features) setFeatures((prev) => ({ ...prev, ...data.features }));
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, []);

  // Room subscription plan: fetched on join (retried until the backend has
  // registered the room), refreshed live via roomPlanUpdated socket events
  useEffect(() => {
    const trimmed = roomId.trim();
    if (!joined || !trimmed) return;
    let cancelled = false;
    let timer = null;
    let attempts = 0;
    const attempt = () => {
      if (cancelled) return;
      attempts += 1;
      fetch(`${backendUrl}/api/platform/rooms/${encodeURIComponent(trimmed)}/plan`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (data && data.plan) {
            setRoomPlan(data.plan);
            setRoomPlanLimits(data.limits || {});
            setPlanOverride(data.planOverride || null);
            if (data.plan === "free" && !planAutoOpenedRef.current) {
              planAutoOpenedRef.current = true;
              if (!showWhiteboardRef.current) setShowPlanModal(true);
            }
            return;
          }
          if (attempts < 8) timer = setTimeout(attempt, 1200);
        })
        .catch(() => {
          if (!cancelled && attempts < 8) timer = setTimeout(attempt, 1200);
        });
    };
    attempt();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [joined, roomId]);

  const isInitialCheckRef = useRef(true);

  useEffect(() => {
    const trimmed = roomId.trim();
    if (!trimmed) {
      setRoomExists(true);
      return;
    }
    const checkExistence = () => {
      fetch(`${backendUrl}/api/platform/rooms/${encodeURIComponent(trimmed)}/exists`)
        .then((res) => (res.ok ? res.json() : { exists: true }))
        .then((data) => {
          setRoomExists(Boolean(data.exists));
        })
        .catch(() => {
          setRoomExists(true);
        });
    };
    if (isInitialCheckRef.current) {
      isInitialCheckRef.current = false;
      checkExistence();
      return;
    }
    const delayDebounce = setTimeout(checkExistence, 300);
    return () => clearTimeout(delayDebounce);
  }, [roomId]);

  const getButtonText = () => {
    if (roomRequestPending) return "Request Pending...";
    if (!roomExists && requireRoomApproval) return "Request Create Secure Room";
    if (!roomExists && !requireRoomApproval) return "Create & Join Room";
    return "Join secure room";
  };

  const onResolved = async ({ status, roomId: resolvedRoomId, reason }) => {
    if (status === "approved" && resolvedRoomId) {
      setRoomRequestPending(false);
      setPendingRequestId("");
      setShowApprovalConfirm(false);
      toast.success(`Room "${resolvedRoomId}" approved! Joining now…`);
      // Auto-join: ensure roomId is set to the approved room, then trigger join
      setRoomId(resolvedRoomId);
      const code = securityCode.trim();
      const trimmedName = userName.trim();
      if (code && trimmedName) {
        try {
          const key = await generateKeyFromSecret(code + resolvedRoomId, resolvedRoomId);
          setRoomKey(key);
          setJoined(true);
        } catch {
          toast.error("Room approved but failed to initialize session. Please join manually.");
        }
      }
    } else if (status === "rejected") {
      setRoomRequestPending(false);
      setPendingRequestId("");
      setShowApprovalConfirm(false);
      setRoomExists(true); // Reset so the button reverts to normal state
      toast.error(
        reason
          ? `Request rejected: ${reason}`
          : "Your room creation request was declined.",
        { autoClose: 6000 }
      );
    }
  };
  onResolvedRef.current = onResolved;

  useEffect(() => {
    // Mobile-first reconnect kick. Browsers freeze backgrounded tabs, which
    // silently kills WebSockets. Rejoining right away isn't enough — the
    // client sits in its reconnection backoff (or never noticed the drop), so
    // the user is stuck on "Connecting…" until something pokes it. When the
    // tab comes back or the network returns, force a fresh connection now so
    // presence + messages resume immediately.
    const kickReconnect = () => {
      const s = socketRef.current;
      if (!s) return;
      if (s.connected) {
        setIsConnected(true);
        return;
      }
      s.connect();
    };
    const handleOnline = () => kickReconnect();
    const handleOffline = () => setIsConnected(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") kickReconnect();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);


  // Keep the current participant visible immediately while Socket.IO finishes
  // delivering the authoritative room presence list.
  useEffect(() => {
    if (joined && userName) {
      setOnlineUsers((users) => users.length ? users : [{ id: "local", name: userName }]);
    }
  }, [joined, userName]);


  // ── Manage blob URLs for pending files to prevent flickering ──
  useEffect(() => {
    const newUrls = {};
    pendingFiles.forEach((file, idx) => {
      const key = `${file.name}-${file.size}-${idx}`;
      if (!pendingFilesUrlsRef.current[key]) {
        newUrls[key] = URL.createObjectURL(file);
      } else {
        newUrls[key] = pendingFilesUrlsRef.current[key];
      }
    });

    const previousUrls = pendingFilesUrlsRef.current;
    pendingFilesUrlsRef.current = newUrls;
    setPendingFilesUrls(newUrls);

    return () => {
      // Only revoke URLs for files that are no longer in pendingFiles
      Object.entries(previousUrls).forEach(([key, url]) => {
        if (!newUrls[key]) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [pendingFiles]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // Check if the actual last message changed (i.e. new message received/sent)
    const isNewMessage = lastMessageIdRef.current !== lastMessage.id;
    lastMessageIdRef.current = lastMessage.id;

    if (isNewMessage) {
      const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 250;
      const isMyMessage = lastMessage.userName === userName;

      if (isNearBottom || isMyMessage) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [messages, userName]);

  const gifGridRef = useRef(null);
  const loadingGifsRef = useRef(false);
  const gifCacheRef = useRef(new Map());
  const gifRequestRef = useRef(null);
  const gifPageSizeRef = useRef(20);

  const fetchGifs = useCallback(async (query = "", offset = 0) => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const limit = connection?.saveData || /(^|-)2g/.test(connection?.effectiveType || "") ? 12 : 20;
    gifPageSizeRef.current = limit;
    const cacheKey = `${query.trim().toLowerCase()}:${offset}:${limit}`;
    const cached = gifCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < 10 * 60 * 1000) {
      if (offset === 0) setGifs(cached.data); else setGifs((previous) => [...previous, ...cached.data.filter((gif) => !previous.some((item) => item.id === gif.id))]);
      return;
    }
    loadingGifsRef.current = true;
    gifRequestRef.current?.abort();
    const controller = new AbortController();
    gifRequestRef.current = controller;

    const params = new URLSearchParams({ q: query.trim().slice(0, 100), limit: String(limit), offset: String(offset) });

    try {
      let res = await fetch(`${backendUrl}/api/gifs?${params}`, { signal: controller.signal });
      if (!res.ok && process.env.REACT_APP_GIPHY_API_KEY) {
        const upstream = query.trim() ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending";
        res = await fetch(`${upstream}?${params}&api_key=${encodeURIComponent(process.env.REACT_APP_GIPHY_API_KEY)}`, { signal: controller.signal });
      }
      if (!res.ok) throw new Error(`GIF service returned ${res.status}`);
      const data = await res.json();
      gifCacheRef.current.set(cacheKey, { data: data.data, savedAt: Date.now() });
      if (gifCacheRef.current.size > 80) gifCacheRef.current.delete(gifCacheRef.current.keys().next().value);
      if (data.data.length < limit) setHasMoreGifs(false);
      if (offset === 0) {
        setGifs(data.data);
      } else {
        setGifs((prev) => {
          const existingIds = new Set(prev.map(g => g.id));
          const unique = data.data.filter(g => !existingIds.has(g.id));
          return [...prev, ...unique];
        });
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("GIF fetch error:", err);
      toast.error("GIFs are temporarily unavailable. Please try again.");
    } finally {
      loadingGifsRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleShortcuts = (e) => {
      const isInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        setShowEmojiPicker(false);
        setShowGifPicker(false);
        setShowRoomInfo(false);
        setReplyTo(null);
        setForwardTarget(null);
        setConfirmation(null);
        setShowEphemeralMenu(false);
        setShowShortcutsHelp(false);
        return;
      }

      if (isInput) return;

      if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
        return;
      }

      const hasMeta = e.metaKey || e.ctrlKey;

      if (hasMeta && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setEphemeralMode(prev => !prev);
        toast.info(!ephemeralMode ? "💨 Disappearing messages enabled" : "💨 Disappearing messages disabled");
      }

      if (hasMeta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }

      if (e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setShowGifPicker(prev => !prev);
        if (!showGifPicker) fetchGifs();
      }

      if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setShowEmojiPicker(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [ephemeralMode, showGifPicker, fetchGifs]);

  useEffect(() => {
    if (!showGifPicker) return undefined;
    const timer = setTimeout(() => {
      setGifOffset(0);
      setHasMoreGifs(true);
      fetchGifs(gifQuery, 0);
    }, gifQuery ? 280 : 0);
    return () => clearTimeout(timer);
  }, [showGifPicker, gifQuery, fetchGifs]);

  useEffect(() => {
    if (showGifPicker) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showGifPicker]);

  useEffect(() => {
    if (!showGifPicker) return;
    const grid = gifGridRef.current;
    if (!grid) return;

    const handleScroll = () => {
      if (
        grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 100 &&
        hasMoreGifs &&
        !loadingGifsRef.current
      ) {
        const nextOffset = gifOffset + gifPageSizeRef.current;
        setGifOffset(nextOffset);
        fetchGifs(gifQuery, nextOffset);
      }
    };

    grid.addEventListener("scroll", handleScroll, { passive: true });
    return () => grid.removeEventListener("scroll", handleScroll);
  }, [showGifPicker, gifOffset, gifQuery, hasMoreGifs, fetchGifs]);

  /* ================= HELPERS ================= */

  const getColor = (name) => {
    if (!userColorsRef.current[name]) {
      userColorsRef.current[name] =
        colorPalette[
        Object.keys(userColorsRef.current).length % colorPalette.length
        ];
    }
    return userColorsRef.current[name];
  };

  const getEmbedData = (url) => {
    try {
      const u = new URL(url);

      // YouTube
      if (u.hostname.includes("youtu.be")) return { type: "youtube", src: `https://www.youtube.com/embed/${u.pathname.slice(1)}` };
      if (u.hostname.includes("youtube.com")) {
        if (u.pathname.startsWith("/shorts/")) return { type: "youtube", src: `https://www.youtube.com/embed/${u.pathname.split("/")[2]}` };
        if (u.pathname.startsWith("/live/")) return { type: "youtube", src: `https://www.youtube.com/embed/${u.pathname.split("/")[2]}` };
        if (u.searchParams.get("v")) return { type: "youtube", src: `https://www.youtube.com/embed/${u.searchParams.get("v")}` };
      }

      // Spotify
      if (u.hostname.includes("spotify.com")) {
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          return { type: "spotify", src: `https://open.spotify.com/embed/${parts[0]}/${parts[1]}` };
        }
      }

      // TikTok
      if (u.hostname.includes("tiktok.com")) {
        const videoId = u.pathname.split("/video/")[1];
        if (videoId) return { type: "tiktok", src: `https://www.tiktok.com/embed/v2/${videoId.split("?")[0]}` };
      }

      // Instagram — posts (/p/), reels (/reel/, /reels/) and IGTV (/tv/) each need
      // their own embed path; forcing a reel into /p/ makes IG show "post removed".
      if (u.hostname.includes("instagram.com")) {
        const segs = u.pathname.split("/").filter(Boolean);
        let igKind = null;
        let igId = null;
        for (let s = 0; s < segs.length - 1; s++) {
          if (["p", "reel", "reels", "tv"].includes(segs[s])) {
            igKind = segs[s] === "reels" ? "reel" : segs[s];
            igId = segs[s + 1];
            break;
          }
        }
        if (igKind && igId) {
          return { type: "instagram", src: `https://www.instagram.com/${igKind}/${igId.split("?")[0]}/embed/captioned/` };
        }
      }

      // Twitter / X
      if (u.hostname.includes("twitter.com") || u.hostname.includes("x.com")) {
        const tweetId = u.pathname.split("/status/")[1];
        if (tweetId) {
          return { type: "twitter", src: `https://twitframe.com/show?url=${encodeURIComponent(`https://twitter.com/i/status/${tweetId.split("?")[0]}`)}` };
        }
      }

      // Vimeo
      if (u.hostname.includes("vimeo.com")) {
        const id = u.pathname.split("/").filter(Boolean).pop();
        if (/^\d+$/.test(id || "")) return { type: "vimeo", src: `https://player.vimeo.com/video/${id}` };
      }

      // Dailymotion
      if (u.hostname.includes("dailymotion.com") || u.hostname.includes("dai.ly")) {
        const id = u.hostname.includes("dai.ly")
          ? u.pathname.slice(1)
          : (u.pathname.match(/\/video\/([^_/?]+)/) || [])[1];
        if (id) return { type: "dailymotion", src: `https://www.dailymotion.com/embed/video/${id.split("?")[0]}` };
      }

      // Twitch (clips, VODs, live channels — player requires the parent host)
      if (u.hostname.includes("twitch.tv") || u.hostname.includes("clips.twitch.tv")) {
        const parent = window.location.hostname;
        const clip = u.hostname.startsWith("clips")
          ? u.pathname.slice(1)
          : (u.pathname.split("/clip/")[1] || "").split("?")[0];
        if (clip) return { type: "twitch", src: `https://clips.twitch.tv/embed?clip=${clip}&parent=${parent}` };
        const vid = (u.pathname.match(/\/videos\/(\d+)/) || [])[1];
        if (vid) return { type: "twitch", src: `https://player.twitch.tv/?video=v${vid}&parent=${parent}` };
        const channel = u.pathname.replace(/\//g, "");
        if (channel) return { type: "twitch", src: `https://player.twitch.tv/?channel=${channel}&parent=${parent}` };
      }

      // Reddit posts & media
      if (u.hostname.includes("reddit.com")) {
        const id = (u.pathname.match(/\/comments\/([a-z0-9]+)/i) || [])[1];
        if (id) return { type: "reddit", src: `https://www.redditmedia.com/mediaembed/${id.split("?")[0]}` };
      }

      // Pinterest pins
      if (u.hostname.includes("pinterest.")) {
        const id = (u.pathname.match(/\/pin\/(\d+)/) || [])[1];
        if (id) return { type: "pinterest", src: `https://assets.pinterest.com/ext/embed.html?id=${id}` };
      }

      // SoundCloud tracks & playlists
      if (u.hostname.includes("soundcloud.com")) {
        return { type: "soundcloud", src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&color=%236366f1&auto_play=false&hide_related=true&show_comments=false&visual=true` };
      }

      // Streamable
      if (u.hostname.includes("streamable.com")) {
        const id = u.pathname.replace(/\//g, "");
        if (id) return { type: "streamable", src: `https://streamable.com/e/${id.split("?")[0]}` };
      }

      // Facebook posts, videos, reels, watch
      if (u.hostname.includes("facebook.com") || u.hostname.includes("fb.watch")) {
        const enc = encodeURIComponent(u.href);
        if (/\/(videos|reel|watch|fb.watch)/.test(u.href)) {
          return { type: "facebook", src: `https://www.facebook.com/plugins/video.php?href=${enc}&show_text=false` };
        }
        return { type: "facebook", src: `https://www.facebook.com/plugins/post.php?href=${enc}&show_text=true` };
      }

      // Facebook public videos/posts
      if (u.hostname.includes("facebook.com") || u.hostname.includes("fb.watch")) {
        return { type: "facebook", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false` };
      }

      // SoundCloud
      if (u.hostname.includes("soundcloud.com")) {
        return { type: "soundcloud", src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&visual=true` };
      }

      // Loom recordings
      if (u.hostname.includes("loom.com") && u.pathname.includes("share/")) {
        const id = u.pathname.split("share/")[1]?.split("/")[0];
        if (id) return { type: "loom", src: `https://www.loom.com/embed/${id}` };
      }

    } catch { }
    return null;
  };

  const handleDestroyRoom = () => {
    if (!roomId || !ownerToken) return;
    setConfirmation({
      title: "Delete this room?", body: "This permanently removes this room and its available message history for everyone.", confirmLabel: "Delete room", onConfirm: () => {
        socketRef.current.emit("destroyRoom", { roomId, token: ownerToken });
        setMessages([]);
        setJoined(false);
        setAuthenticated(false);
      }
    });
  };

  const leaveRoomNow = () => {
    toast.dismiss();
    if (socketRef.current) {
      socketRef.current.emit("leaveRoom", { roomId, userName });
    }

    // Forgetting the stored session means a later reopen of this room goes back
    // to the join form instead of silently rejoining after an intentional exit.
    try { sessionStorage.removeItem(`anonchat:join:${roomId.trim()}`); } catch { /* noop */ }

    // Reset local state completely
    setJoined(false);
    setAuthenticated(false);
    setMessages([]);
    setRoomId("");
    setUserName("");
    setSecurityCode("");
    setRoomKey(null);
    setOwnerToken(null);
    setPendingFiles([]);
    setOnlineUsers([]);
    setShowMeeting(false);
    setShowWhiteboard(false);
    setIncomingCall(null);
    if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    setLatency(0);
    setIsStealthMode(false);
    setStealthToken("");
    stealthTokenRef.current = "";
    setShowApprovalConfirm(false);
    setRoomRequestPending(false);
    setPendingRequestId("");
    navigate("/", { replace: true });
  };
  leaveRoomNowRef.current = leaveRoomNow;

  // ── Panic exit hotkey: triple-tap Escape to instantly leave ──
  const panicEscTimestamps = useRef([]);
  useEffect(() => {
    const onPanicKey = (e) => {
      if (e.key !== "Escape") return;
      const now = Date.now();
      panicEscTimestamps.current = [...panicEscTimestamps.current.filter(t => now - t < 1500), now];
      if (panicEscTimestamps.current.length >= 3 && leaveRoomNowRef.current) {
        panicEscTimestamps.current = [];
        toast.info("🚨 Emergency exit triggered");
        leaveRoomNowRef.current();
      }
    };
    window.addEventListener("keydown", onPanicKey);
    return () => window.removeEventListener("keydown", onPanicKey);
  }, []);

  const handleLeaveRoom = () => setConfirmation({ title: "Leave this room?", body: "You can rejoin later with the room credentials.", confirmLabel: "Leave room", onConfirm: leaveRoomNow });

  const handleKickFromRoom = (targetSocketId, targetName) => {
    setConfirmation({
      title: "Remove participant?",
      body: `Are you sure you want to remove "${targetName}" from the room? They will be immediately disconnected.`,
      confirmLabel: "Remove participant",
      onConfirm: () => {
        if (socketRef.current) {
          socketRef.current.emit("kick-from-room", {
            roomId,
            targetSocketId,
            targetName,
            adminName: userName
          });
          socketRef.current.emit("admin-kick-user", {
            roomId,
            peerId: targetSocketId,
            name: targetName,
            adminName: userName,
            isRoomKick: true
          });
        }
        toast.info(`Removal command sent for ${targetName}`);
      }
    });
  };
  /* ================= SOCKET ================= */

  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      upgrade: true,
      rememberUpgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000
    });
    socketRef.current = socket;

    socket.on("roomRequestResolved", (data) => {
      onResolvedRef.current?.(data);
    });

    return () => socket.disconnect();
  }, []);

  // ── Force re-connect when the app is resumed from the background ──
  // On mobile, when the screen is off / the OS suspends the page, JS is paused
  // and socket.io's reconnection timer stalls. Returning to the app then leaves
  // the socket dead until some unrelated event fires, so the user sees the room
  // UI but live features (whiteboard sync, messages, presence) stay frozen.
  // Listen for the page becoming visible/focused/online and force an immediate
  // reconnect, which re-runs the "connect" handler below and re-joins the room.
  useEffect(() => {
    const forceReconnect = () => {
      const s = socketRef.current;
      // Only auto-reconnect while we're actually inside a room, so a deliberate
      // leave or a force-disconnect (kicked from another tab) is never undone.
      if (!s || !roomKeyRef.current) return;
      if (s.connected) return; // already live, nothing to do
      // s.disconnected is true whenever we're not connected (including during a
      // reconnect backoff); s.connect() then forces an immediate attempt.
      if (s.disconnected) {
        try { s.connect(); } catch (e) { /* ignore */ }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") forceReconnect();
    };
    const onFocus = () => forceReconnect();
    const onOnline = () => forceReconnect();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // ── Ephemeral message auto-delete timer (runs every 2s, only updates if needed) ──
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => {
        const now = Date.now();
        const hasEphemeral = prev.some(m => m.ephemeral);
        if (!hasEphemeral) return prev; // no state update if no ephemeral messages
        const filtered = prev.filter(m => {
          if (!m.ephemeral) return true;
          const duration = m.ephemeralDuration || DEFAULT_EPHEMERAL_DURATION;
          return now - m.ts < duration * 1000;
        });
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!joined) return;

    // Read current values from refs so handlers don't depend on closure values.
    // This lets us register handlers once (on join) without re-registering
    // when roomKey, userName, roomId, etc. change.
    const rk = roomKeyRef.current;
    const un = userNameRef.current;
    const rid = roomIdRef.current;
    const gjp = getJoinPayloadRef.current;
    const hjr = handleJoinResultRef.current;

    // Register every room listener before joining: localhost can respond quickly
    // enough for the initial presence event to otherwise be missed.
    socketRef.current.on("chatHistory", async (history) => {
      const formatted = (await Promise.all(history.map(async msg => {
        if (msg?.payload?.__livefile) return null;
        const item = { ...msg, ...msg.payload };
        if (item.encryptedPayload && rk) {
          try {
            const decryptedText = await decryptMessage(rk, item.encryptedPayload);
            try {
              const decryptedPayload = JSON.parse(decryptedText);
              Object.assign(item, decryptedPayload);
              // Background-synced files: prefer the upgraded outer URL over the stale local one inside encryptedPayload
              if (item.file?.url?.includes("/uploads/") && msg.file?.url && !msg.file.url.includes("/uploads/")) {
                item.file = { ...item.file, url: msg.file.url };
              }
            } catch {
              item.text = decryptedText;
            }
          } catch (e) {
            item.text = "🔒 Decryption failed (invalid key or corrupted)";
            item.decryptionError = true;
          }
        }
        if (item.__livefile) return null;
        return item;
      })).then(r => r.filter(Boolean)));
      // History reloads (initial join OR a post-reconnect rejoin) must never
      // wipe an in-flight transfer: keep local placeholder bubbles that don't
      // exist server-side yet (uploading/liveshare sender temp, live rx temp).
      // Merge + dedupe by id so a reconnect re-sending history can't duplicate
      // messages either.
      setMessages(prev => {
        // If the server returned no history (e.g. its room queue was wiped by a
        // serverless cold start/instance swap between a quick leave & rejoin),
        // fall back to this browser's last-known chat for the room so the view
        // isn't lost. Filled in only as a gap-fill, never overriding server data.
        const rid = roomId.trim();
        const cached = formatted.length === 0 && historyCacheRoomRef.current === rid
          ? readHistoryCache(rid)
          : [];
        const historicIds = new Set(formatted.map(f => f.id).filter(Boolean));
        const keepLocal = prev.filter(m => !historicIds.has(m.id) &&
          /^(uploading|liveshare|rx)-/.test(m.id) &&
          m.file && (m.file.loading || m.file.progress !== undefined));
        const seen = new Set();
        return [...keepLocal, ...cached, ...formatted].filter(m => {
          if (!m.id) return true;
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      });
      formatted.filter((item) => item.id && item.userName !== un).forEach((item) => socketRef.current.emit("messageViewed", { messageId: item.id }));
    });

    socketRef.current.on("hasMoreMessages", () => setHasMoreMessages(true));

    socketRef.current.on("olderMessages", async ({ messages: older, hasMore }) => {
      const formatted = (await Promise.all(older.map(async msg => {
        if (msg?.payload?.__livefile) return null;
        const item = { ...msg, ...msg.payload };
        if (item.encryptedPayload && rk) {
          try {
            const decryptedText = await decryptMessage(rk, item.encryptedPayload);
            try {
              const decryptedPayload = JSON.parse(decryptedText);
              Object.assign(item, decryptedPayload);
              // Background-synced files: prefer the upgraded outer URL over the stale local one inside encryptedPayload
              if (item.file?.url?.includes("/uploads/") && msg.file?.url && !msg.file.url.includes("/uploads/")) {
                item.file = { ...item.file, url: msg.file.url };
              }
            } catch {
              item.text = decryptedText;
            }
          } catch (e) {
            item.text = "🔒 Decryption failed (invalid key or corrupted)";
            item.decryptionError = true;
          }
        }
        if (item.__livefile) return null;
        return item;
      })).then(r => r.filter(Boolean)));
      setMessages(prev => {
        const have = new Set(prev.map(m => m.id).filter(Boolean));
        const fresh = formatted.filter(f => !f.id || !have.has(f.id));
        return [...fresh, ...prev];
      });
      setHasMoreMessages(hasMore);
      setLoadingMore(false);
    });

    socketRef.current.on("newMessage", async (msg) => {
      const formattedMsg = { ...msg, ...msg.payload };
      if (formattedMsg.encryptedPayload && rk) {
        try {
          const decryptedText = await decryptMessage(rk, formattedMsg.encryptedPayload);
          try {
            const decryptedPayload = JSON.parse(decryptedText);
            Object.assign(formattedMsg, decryptedPayload);
            // Background-synced files: prefer the upgraded outer URL over the stale local one inside encryptedPayload
            if (formattedMsg.file?.url?.includes("/uploads/") && msg.file?.url && !msg.file.url.includes("/uploads/")) {
              formattedMsg.file = { ...formattedMsg.file, url: msg.file.url };
            }
          } catch {
            formattedMsg.text = decryptedText;
          }
        } catch (e) {
          formattedMsg.text = "🔒 Decryption failed (invalid key or corrupted)";
          formattedMsg.decryptionError = true;
        }
      }
      if (formattedMsg.__livefile) {
        try { handleIncomingLiveFile(formattedMsg); } catch (e) { console.error("livefile rx:", e); }
        return;
      }
      // My own just-uploaded E2EE file: render instantly from the local blob URL
      // (keyed by IV) instead of re-downloading + decrypting the whole file — that
      // was the second "Loading / 100%" the sender saw after the upload finished.
      if (msg.userName === un && formattedMsg.file?.iv) {
        const localObj = localFileObjectsRef.current.get(formattedMsg.file.iv);
        if (localObj) {
          formattedMsg.file = {
            ...formattedMsg.file,
            url: localObj.url,
            name: localObj.name,
            type: localObj.type,
            local: true,
            iv: undefined,
            keyB64: undefined
          };
        }
      }
      setMessages((m) => m.some((x) => formattedMsg.id && x.id === formattedMsg.id) ? m : [...m, formattedMsg]);
      if (formattedMsg.id && formattedMsg.userName !== un) socketRef.current.emit("messageViewed", { messageId: formattedMsg.id });
      if (msg.userName !== un) {
        if (!muteSoundsRef.current) {
          playNotificationSound(soundChoiceRef.current, notificationSound);
        }

        // Update unread count if scrolled up
        const container = messagesContainerRef.current;
        if (container) {
          const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 250;
          if (!isNearBottom) {
            setUnreadCount(prev => prev + 1);
          }
        }

        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          const bodyText = formattedMsg.file
            ? `📎 File: ${formattedMsg.file.name}`
            : formattedMsg.poll
              ? `📊 Poll: ${formattedMsg.poll.question}`
              : formattedMsg.text;
          new Notification(formattedMsg.userName || "New Message", {
            body: bodyText,
            tag: "cheprabai-message",
            renotify: true
          });
        }
      }
    });

    socketRef.current.on("presence", ({ online, count }) => {
      setOnlineUsers(online);
    });
    socketRef.current.on("all-users", (online = []) => {
      setOnlineUsers(online);
    });
    socketRef.current.on("user-joined", ({ id, name }) => {
      setOnlineUsers((users) => users.some((user) => user.id === id) ? users : [...users, { id, name }]);
    });
    socketRef.current.on("user-left", ({ id }) => {
      setOnlineUsers((users) => {
        const gone = users.find((user) => user.id === id);
        if (gone?.name) {
          typingFirstSeenRef.current.delete(gone.name);
          setTypingUsers((prev) => prev.filter((n) => n !== gone.name));
        }
        return users.filter((user) => user.id !== id);
      });
    });
    socketRef.current.on("typing", (users) => {
      const me = userNameRef.current?.trim();
      const online = onlineNamesRef.current;
      const incoming = (Array.isArray(users) ? users : [])
        .filter((n) => n && n !== me && online.has(n));
      const seen = typingFirstSeenRef.current;
      const fresh = new Set(incoming);
      for (const name of [...seen.keys()]) if (!fresh.has(name)) seen.delete(name);
      const now = Date.now();
      incoming.forEach((n) => { if (!seen.has(n)) seen.set(n, now); });
      setTypingUsers(incoming);
    });
    socketRef.current.on("roomDestroyed", () => {
      toast.info("This room was deleted.");
      leaveRoomNowRef.current?.();
    });
    socketRef.current.on("kicked-from-room", ({ targetSocketId, targetName, adminName }) => {
      if (socketRef.current?.id === targetSocketId || targetName === un) {
        toast.error(`🚫 You have been removed from this room by ${adminName || 'the room owner'}.`);
        leaveRoomNowRef.current?.();
      } else {
        toast.info(`ℹ️ ${targetName} was removed from the room.`);
        setOnlineUsers((users) => users.filter((u) => u.id !== targetSocketId && u.name !== targetName));
      }
    });
    socketRef.current.on("admin-kick-user", ({ peerId, name, adminName, isRoomKick }) => {
      if (peerId === socketRef.current?.id || name === un) {
        toast.error(`🚫 You have been removed from this room by ${adminName || 'the room owner'}.`);
        leaveRoomNowRef.current?.();
      } else {
        setOnlineUsers((users) => users.filter((u) => u.id !== peerId && u.name !== name));
      }
    });

    socketRef.current.on("roomOwner", (token) => {
      setOwnerToken(token);
      if (token && rid) {
        sessionStorage.setItem(`cheprabai:owner-token:${rid}`, token);
      }
    });
    socketRef.current.on("messageViewUpdated", ({ messageId, viewedBy }) => {
      setMessages((items) => items.map((item) => item.id === messageId ? { ...item, viewedBy } : item));
    });
    socketRef.current.on("messageReactionUpdated", ({ messageId, reactions }) => {
      setMessages((items) => items.map((item) => item.id === messageId ? { ...item, reactions } : item));
    });
    socketRef.current.on("roomBackgroundUpdated", ({ background }) => {
      localStorage.setItem(`cheprabai:room-background:${rid}`, background || "");
      setRoomBackground(background || "");
    });
    socketRef.current.on("roomBackgroundPolicy", ({ locked }) => setBackgroundLocked(Boolean(locked)));
    socketRef.current.on("profileUpdated", ({ socketId, avatar, name }) => {
      setParticipantProfiles((profiles) => ({ ...profiles, [socketId]: { avatar, name } }));
    });
    socketRef.current.on("roomProfiles", (profiles = {}) => {
      setParticipantProfiles(profiles);
    });
    socketRef.current.on("roomPlanUpdated", ({ plan, planOverride: override, limits }) => {
      setRoomPlan(plan);
      setRoomPlanLimits(limits || {});
      setPlanOverride(override || null);
    });

    // ── Screen Capture & Screenshot Protection ──
    const handleBlur = () => {
      if (!stealthTokenRef.current) {
        setIsScreenProtected(true);
      }
    };
    const handleFocus = () => {
      setIsScreenProtected(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        if (!stealthTokenRef.current) {
          setIsScreenProtected(true);
          setTimeout(() => setIsScreenProtected(false), 1200);
        }
      }
    };
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("keydown", handleKeyDown);

    // Completion ack for a realtime file relay: resolves the sender's pending
    // handshake (see livefileAckRef) once the receiver has assembled the file.
    socketRef.current.on("livefile-received", ({ fileId }) => {
      const resolve = livefileAckRef.current.get(fileId);
      if (resolve) {
        livefileAckRef.current.delete(fileId);
        resolve();
      }
    });

    socketRef.current.on("connect", () => {
      setIsConnected(true);
      liveTxAbortRef.current = false;
      if ((joined && rid && un) || reconnectRef.current.droppedInRoom) {
        // Only re-issue joinRoom on connect if we were already inside the room
        // and got dropped mid-session (or the reconnect lost in-room state).
        // On a fresh join the joined-effect emits joinRoom itself, so we don't
        // re-emit here — that double-emit is what re-triggered a full history
        // reload and the "double loading" flicker.
        reconnectRef.current.droppedInRoom = false;
        socketRef.current.emit("joinRoom", gjp(), hjr);
      } else {
        // Fresh page (or a reconnect that lost its in-room state): if we have a
        // stored session for this room, silently rejoin instead of stranding
        // the user on a dead connection.
        tryRestoreRef.current?.();
      }
    });

    socketRef.current.on("disconnect", () => {
      setIsConnected(false);
      // Abort any in-flight realtime relay fast — retrying into a dropped socket
      // is what makes transfers look stuck for minutes. Will be cleared on the
      // next connect / before a new shareFileLive.
      liveTxAbortRef.current = true;
      // A dropped connection kills any partially-received relay: purge the
      // placeholder so it doesn't sit stuck at "receiving" for minutes.
      const rxMap = liveFileRxRef.current;
      if (rxMap.size) {
        const tempIds = [...rxMap.values()].map((e) => e.tempId).filter(Boolean);
        rxMap.clear();
        if (tempIds.length) setMessages((prev) => prev.filter((m2) => !tempIds.includes(m2.id)));
      }
      if (roomKeyRef.current) reconnectRef.current.droppedInRoom = true;
    });

    // Server force-disconnected us (e.g. the same identity rejoined from another
    // tab with the same session token). Reset to the join form and never fight
    // back with auto-rejoin, or the two tabs would ping-pong each other out.
    socketRef.current.on("force-disconnect", () => {
      autoJoinTriedRef.current = true;
      setJoined(false);
      setAuthenticated(false);
      setRoomKey(null);
      setIsConnected(false);
      setShowWhiteboard(false);
      setShowMeeting(false);
      try { sessionStorage.removeItem(`anonchat:join:${roomIdRef.current?.trim()}`); } catch { /* noop */ }
      toast.info("You were signed out of this room from another tab/connection.");
    });

    socketRef.current.on("fileUrlUpdated", ({ localUrl, newUrl }) => {
      setMessages(prev => prev.map(msg => {
        if (msg.file && msg.file.url === localUrl) {
          return { ...msg, file: { ...msg.file, url: newUrl } };
        }
        return msg;
      }));
    });

    socketRef.current.on("messageDeleted", ({ messageId }) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    });

    // ── Disappearing Messages & Pinned Messages Sync ──
    socketRef.current.on("syncRoomMetadata", async ({ ephemeralDuration, pinnedMessages: rawPinned, allowedIps, auditLogs, bannedWords: initialBanned }) => {
      if (initialBanned) {
        setBannedWords(initialBanned);
      }
      if (ephemeralDuration !== undefined) {
        setRoomEphemeralDuration(ephemeralDuration);
        setEphemeralMode(ephemeralDuration > 0);
      }
      if (allowedIps) {
        setAllowedIpsText(allowedIps.join(", "));
      }
      if (auditLogs) {
        setAuditLogs(auditLogs);
      }
      if (rawPinned) {
        const formatted = await Promise.all(rawPinned.map(async msg => {
          const item = { ...msg, ...msg.payload };
          if (item.encryptedPayload && rk) {
            try {
              const decryptedText = await decryptMessage(rk, item.encryptedPayload);
              try {
                const decryptedPayload = JSON.parse(decryptedText);
                Object.assign(item, decryptedPayload);
              } catch {
                item.text = decryptedText;
              }
            } catch (e) {
              item.text = "🔒 Decryption failed";
              item.decryptionError = true;
            }
          }
          return item;
        }));
        setPinnedMessages(formatted);
      }
    });

    socketRef.current.on("auditLogUpdated", (logs) => {
      setAuditLogs(logs || []);
    });

    socketRef.current.on("roomContentFilterUpdated", ({ bannedWords: updatedBanned }) => {
      setBannedWords(updatedBanned || []);
    });

    socketRef.current.on("pinnedMessagesUpdated", async ({ pinnedMessages: rawPinned }) => {
      const formatted = await Promise.all((rawPinned || []).map(async msg => {
        const item = { ...msg, ...msg.payload };
        if (item.encryptedPayload && rk) {
          try {
            const decryptedText = await decryptMessage(rk, item.encryptedPayload);
            try {
              const decryptedPayload = JSON.parse(decryptedText);
              Object.assign(item, decryptedPayload);
              // Background-synced files: prefer the upgraded outer URL over the stale local one inside encryptedPayload
              if (item.file?.url?.includes("/uploads/") && msg.file?.url && !msg.file.url.includes("/uploads/")) {
                item.file = { ...item.file, url: msg.file.url };
              }
            } catch {
              item.text = decryptedText;
            }
          } catch (e) {
            item.text = "🔒 Decryption failed";
            item.decryptionError = true;
          }
        }
        return item;
      }));
      setPinnedMessages(formatted);
    });

    socketRef.current.on("scheduledMessagesUpdated", async (scheduledMsgs) => {
      const formatted = await Promise.all((scheduledMsgs || []).map(async msg => {
        const item = { ...msg, ...msg.payload };
        if (item.encryptedPayload && rk) {
          try {
            const decryptedText = await decryptMessage(rk, item.encryptedPayload);
            try {
              const decryptedPayload = JSON.parse(decryptedText);
              Object.assign(item, decryptedPayload);
              // Background-synced files: prefer the upgraded outer URL over the stale local one inside encryptedPayload
              if (item.file?.url?.includes("/uploads/") && msg.file?.url && !msg.file.url.includes("/uploads/")) {
                item.file = { ...item.file, url: msg.file.url };
              }
            } catch {
              item.text = decryptedText;
            }
          } catch (e) {
            item.text = "🔒 Decryption failed";
            item.decryptionError = true;
          }
        }
        return item;
      }));
      setScheduledMessages(formatted);
    });

    socketRef.current.on("messageEdited", async ({ messageId, payload: newPayload, editedAt }) => {
      let formatted = { ...newPayload };
      if (newPayload.encryptedPayload && rk) {
        try {
          const decryptedText = await decryptMessage(rk, newPayload.encryptedPayload);
          try {
            const decryptedPayload = JSON.parse(decryptedText);
            Object.assign(formatted, decryptedPayload);
            // Background-synced files: prefer the upgraded outer URL over the stale local one inside encryptedPayload
            if (formatted.file?.url?.includes("/uploads/") && newPayload.file?.url && !newPayload.file.url.includes("/uploads/")) {
              formatted.file = { ...formatted.file, url: newPayload.file.url };
            }
          } catch {
            formatted.text = decryptedText;
          }
        } catch (e) {
          formatted.text = "🔒 Decryption failed (invalid key or corrupted)";
          formatted.decryptionError = true;
        }
      }
      setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, ...formatted, editedAt } : msg));
      setPinnedMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, ...formatted, editedAt } : msg));
    });

    socketRef.current.on("pollVotesUpdated", ({ messageId, pollVotes }) => {
      setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, pollVotes } : msg));
      setPinnedMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, pollVotes } : msg));
    });

    socketRef.current.on("roomEphemeralUpdated", ({ ephemeralDuration, userName: settingUser }) => {
      setRoomEphemeralDuration(ephemeralDuration);
      setEphemeralMode(ephemeralDuration > 0);
      setMessages(prev => [
        ...prev,
        {
          id: `ephemeral-change-${Date.now()}`,
          type: "system",
          action: "ephemeral-change",
          userName: settingUser,
          ephemeralDuration,
          ts: Date.now()
        }
      ]);
    });

    socketRef.current.emit("joinRoom", gjp(), hjr);



    // ── Incoming Call Signaling ──
    socketRef.current.on("incoming-call", ({ callerName, callerAvatar }) => {
      if (showMeetingRef.current) return; // already in a call
      setIncomingCall({ callerName, callerAvatar });
      // Start ringtone
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = "sine";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        // Ring cadence: 2s on, 3s off
        const ringCadence = () => {
          const t = ctx.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
          gain.gain.setValueAtTime(0.3, t + 2.0);
          gain.gain.linearRampToValueAtTime(0, t + 2.05);
        };
        ringCadence();
        const ringInterval = setInterval(ringCadence, 5000);
        ringtoneRef.current = {
          stop: () => {
            clearInterval(ringInterval);
            try { osc1.stop(); osc2.stop(); ctx.close(); } catch { }
          }
        };
      } catch { }
    });

    socketRef.current.on("call-ended", () => {
      setIncomingCall(null);
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    });

    // ── Ringtone failsafe: never ring forever ──
    // Auto-dismiss + stop after 45s (covers callers who close without signaling),
    // and stop instantly the moment you join any call.
    const ringFailsafe = setTimeout(() => {
      setIncomingCall(null);
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    }, 45000);

    // Latency Tracking (Ping-Pong)
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        const start = Date.now();
        socketRef.current.emit("ping", () => {
          setLatency(Date.now() - start);
        });
      }
    }, 5000);

    return () => {
      const registeredEvents = [
        "chatHistory", "hasMoreMessages", "olderMessages", "newMessage", "presence",
        "all-users", "typing", "user-joined", "user-left", "roomDestroyed",
        "kicked-from-room", "admin-kick-user", "roomOwner", "messageViewUpdated",
        "messageReactionUpdated", "roomBackgroundUpdated", "roomBackgroundPolicy",
        "profileUpdated", "roomProfiles", "connect", "disconnect", "fileUrlUpdated",
        "messageDeleted", "syncRoomMetadata", "pinnedMessagesUpdated",
        "scheduledMessagesUpdated", "messageEdited", "pollVotesUpdated",
        "roomEphemeralUpdated", "incoming-call", "call-ended"
      ];
      if (socketRef.current) {
        registeredEvents.forEach(evt => socketRef.current.off(evt));
      }
      clearTimeout(ringFailsafe);
      clearInterval(pingInterval);
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    };
    // Socket handlers are registered once per join; they close over the latest
    // render's helpers, so re-subscribing on every helper identity change would
    // drop in-flight events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  // Stop ringing instantly when you join any call (accept button also handles this,
  // but joining from elsewhere — rejoin, active session, etc. — must silence it too)
  useEffect(() => {
    if (showMeeting && ringtoneRef.current) {
      ringtoneRef.current.stop();
      ringtoneRef.current = null;
      setIncomingCall(null);
    }
  }, [showMeeting]);

  useEffect(() => {
    if (!joined) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to leave the room? Your current session and chat history will be lost.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [joined]);

  /* ================= FILE HANDLING ================= */

  /* ── Realtime large-file relay: chunks ride the room's encrypted message
     channel peer-to-peer-in-room; never touches storage. Only people who
     are online right now receive it — by design. ── */
  const liveFileTxRef = useRef(false);
  const liveTxQueueRef = useRef([]);
  // Mirror of the realtime transfer queue, kept in state so the UI can render
  // the pending files while a transfer is active (liveTxQueueRef is mutated
  // imperatively, so we sync a snapshot into state for re-renders).
  const [liveQueue, setLiveQueue] = useState([]);
  // Files I just uploaded: keyed by the encrypt IV so my own echoed message can
  // render instantly from the local blob URL instead of re-downloading/decrypting
  // (which showed the upload hit 100% then go back to a second loading phase).
  const localFileObjectsRef = useRef(new Map());
  const shareFileLive = async (file, viewOnce = false) => {
    if (liveFileTxRef.current) {
      // A realtime transfer is already running. Queue this one so it starts
      // automatically once the current transfer finishes — don't just reject it.
      liveTxQueueRef.current.push({ file, viewOnce });
      setLiveQueue(liveTxQueueRef.current.map((it) => it.file.name));
      toast.info(`"${file.name}" queued — it will share once the current realtime transfer finishes.`);
      return;
    }
    if (file.size > LIVE_SHARE_PRACTICAL_MAX_BYTES) {
      toast.error(`"${file.name}" is too large for realtime sharing (max ${LIVE_SHARE_PRACTICAL_MAX_BYTES >= 1024 * 1024 * 1024 ? `${Math.round(LIVE_SHARE_PRACTICAL_MAX_BYTES / (1024 * 1024 * 1024))} GB` : `${Math.round(LIVE_SHARE_PRACTICAL_MAX_BYTES / (1024 * 1024))} MB`}). Use a direct upload instead — big realtime relays can drop other participants.`);
      return;
    }
    if (file.size > LIVE_SHARE_MAX_BYTES) {
      toast.error(`"${file.name}" is too large even for realtime sharing (max ${Math.round(LIVE_SHARE_MAX_BYTES / (1024 * 1024 * 1024))} GB).`);
      return;
    }
    if (!onlineUsers.length || onlineUsers.length < 2) {
      toast.error("No one else is online right now — realtime sharing needs a live recipient. Ask them to join, then resend.");
      return;
    }
    liveFileTxRef.current = true;
    // A stale disconnect-flag from an earlier aborted transfer must not kill a
    // fresh share; only a disconnect DURING this transfer should abort it.
    liveTxAbortRef.current = false;
    const tempId = `liveshare-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileId = `lf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let previewUrl = null;
    try {
      const looksMedia = /^(image|video|audio)\//.test(file.type);
      if (looksMedia) { try { previewUrl = URL.createObjectURL(file); } catch { previewUrl = null; } }
      const totalChunks = Math.ceil(file.size / LIVE_SHARE_CHUNK_BYTES);
      setMessages(m => [...m, {
        id: tempId, userName,
        file: {
          name: file.name, type: file.type, size: file.size,
          loading: true, phase: "sharing-live", progress: 0,
          loaded: 0, total: file.size, speed: 0,
          ...(previewUrl && { previewUrl })
        },
        ts: Date.now()
      }]);
      const updateTempFile = (patch) => setMessages(msgs => msgs.map(msg => msg.id === tempId ? { ...msg, file: { ...msg.file, ...patch } } : msg));

      // ---- Prefer P2P WebRTC first (zero server involvement, fastest) ------
      // If a real peer socket is online, open a direct DataChannel and stream
      // the file browser-to-browser. On any failure (no peer, NAT needs TURN,
      // timeout, closed channel) we fall back to the chunked socket relay below.
      try {
        const meId = socketRef.current?.id;
        const peer = (onlineUsers || []).find(u => u.id && u.id !== meId && u.id !== "local");
        if (peer?.id) {
          await sendFileP2P({
            socket: socketRef.current,
            peerId: peer.id,
            file,
            viewOnce: viewOnce && /^(image|video)\//.test(file.type),
            fromName: userName,
            onProgress: ({ progress, loaded, total }) => updateTempFile({ progress, loaded, total })
          });
          const localUrl = previewUrl || URL.createObjectURL(file);
          setMessages(m => m.map(msg => msg.id === tempId ? {
            ...msg,
            file: { name: file.name, type: file.type, size: file.size, url: localUrl, local: true, loading: false, ...(viewOnce && /^(image|video)\//.test(file.type) && { viewOnce: true }) }
          } : msg));
          toast.success(`Shared "${file.name}" P2P`);
          return; // finally resets the lock and runs the next queued transfer
        }
      } catch (p2pErr) {
        console.warn("P2P send failed, falling back to relay:", p2pErr && p2pErr.message);
      }

      const isEphemeral = ephemeralMode || roomEphemeralDuration > 0;
      // Per-chunk send with a hard ack timeout. If the recipient drops mid-flight
      // (or a sendMessage ack never returns), a chunk can otherwise hang forever
      // and leave liveFileTxRef stuck, blocking every future transfer with
      // "A realtime transfer is already in progress." Timeouting turns that hang
      // into a rejection so the finally block resets the lock.
      // Large 2MB chunks (→ ~2.7MB base64) make per-chunk round-trips slower,
      // especially when a connection falls back to socket.io polling (each chunk
      // is a full HTTP request). Give them a realistic window so the ack isn't
      // treated as a dropped peer.
      const CHUNK_ACK_TIMEOUT_MS = 30000;
      // Robust chunk send: transient drops (a reconnect, a slow polling frame,
      // a Vercel function recycle) must NOT kill the whole transfer. If an ack
      // times out or errors, retry a few times with backoff so the transfer
      // self-heals once the socket reconnects. Duplicate chunks are harmless —
      // the receiver skips any part index it already holds — so retries are
      // idempotent. Only after exhausting attempts do we give up.
      const CHUNK_MAX_RETRIES = 3;
      const CHUNK_RETRY_DELAYS = [2000, 4000, 8000];
      const emitChunkMsg = (payload) => new Promise((resolve, reject) => {
        const attempt = (tryCount) => {
          let settled = false;
          const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };
          if (liveTxAbortRef.current) {
            // Socket dropped mid-transfer: bail immediately, don't burn retries.
            done(reject, new Error("Connection dropped while sharing — the other participant may have left."));
            return;
          }
          const timer = setTimeout(() => {
            // Timed out — if we still have retries left, back off and retry.
            // socket.io reconnects in the background, so this usually succeeds
            // right after the link comes back.
            if (tryCount < CHUNK_MAX_RETRIES) {
              const delay = CHUNK_RETRY_DELAYS[tryCount - 1] ?? 8000;
              setTimeout(() => attempt(tryCount + 1), delay);
            } else {
              done(reject, new Error("Realtime recipient stopped responding — the other participant may have left."));
            }
          }, CHUNK_ACK_TIMEOUT_MS);
          (async () => {
            let body = payload;
            if (roomKey) {
              try {
                const enc = await encryptMessage(roomKey, JSON.stringify(payload));
                body = { encryptedPayload: enc };
              } catch { body = payload; }
            }
            const s = socketRef.current;
            if (!s || !s.connected) {
              // Socket is down right now (reconnecting). Retry after backoff.
              clearTimeout(timer);
              if (tryCount < CHUNK_MAX_RETRIES) {
                const delay = CHUNK_RETRY_DELAYS[tryCount - 1] ?? 8000;
                setTimeout(() => attempt(tryCount + 1), delay);
              } else {
                done(reject, new Error("Connection dropped while sharing — the other participant may have left."));
              }
              return;
            }
            s.emit("sendMessage", {
              payload: body, userName, roomId, ts: Date.now(),
              liveRelay: true,
              ephemeral: isEphemeral,
              ephemeralDuration: roomEphemeralDuration > 0 ? roomEphemeralDuration : DEFAULT_EPHEMERAL_DURATION
            }, (res) => {
              clearTimeout(timer);
              if (res?.error || !res?.id) done(reject, new Error(res?.error || "Realtime send failed"));
              else done(resolve, res.id);
            });
          })();
        };
        attempt(1);
      });

      const sentIds = [];
      await emitChunkMsg({ __livefile: "meta", id: fileId, fid: fileId, name: file.name, mime: file.type, size: file.size, totalChunks, viewOnce: Boolean(viewOnce && /^(image|video)\//.test(file.type)) }).then((id) => sentIds.push(id));

      const startedAt = performance.now();
      const blobToBase64 = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Throttled so a transfer can never fire a burst that overwhelms the
      // recipient's socket/browser — high concurrency is what knocked peers off.
      const MAX_CONCURRENT_CHUNKS = 8;
      let inFlight = 0;
      let nextSeq = 0;
      let sendError = null;

      await new Promise((resolve, reject) => {
        const sendNext = () => {
          if (liveTxAbortRef.current) {
            sendError = new Error("Connection dropped while sharing — the other participant may have left.");
          }
          if (sendError) {
            reject(sendError);
            return;
          }
          if (nextSeq >= totalChunks) {
            if (inFlight === 0) {
              resolve();
            }
            return;
          }

          while (inFlight < MAX_CONCURRENT_CHUNKS && nextSeq < totalChunks) {
            const seq = nextSeq++;
            inFlight++;
            
            // eslint-disable-next-line no-loop-func
            (async () => {
              try {
                const sliceBlob = file.slice(seq * LIVE_SHARE_CHUNK_BYTES, (seq + 1) * LIVE_SHARE_CHUNK_BYTES);
                const b64Data = await blobToBase64(sliceBlob);
                const id2 = await emitChunkMsg({ __livefile: "chunk", id: fileId, fid: fileId, seq, data: b64Data });
                sentIds.push(id2);
                
                inFlight--;
                const loaded = Math.min(nextSeq * LIVE_SHARE_CHUNK_BYTES, file.size);
                const dt = performance.now() - startedAt;
                updateTempFile({
                  progress: Math.floor((loaded * 100) / file.size),
                  loaded,
                  speed: dt > 0 ? Math.round((loaded / dt) * 1000) : 0
                });
                
                sendNext();
              } catch (err) {
                sendError = err;
                inFlight--;
                reject(err);
              }
            })();
          }
        };

        sendNext();
      });
      await emitChunkMsg({ __livefile: "end", id: fileId, fid: fileId }).then((id) => sentIds.push(id));

      // Completion handshake: don't claim success until the receiver tells us it
      // actually assembled the full file. Otherwise we'd show "uploaded" while
      // the recipient is stuck at 95% (or disconnected). If no ack arrives in
      // time, we treat the transfer as interrupted instead of falsely done.
      const RECEIVED_ACK_TIMEOUT_MS = 20000;
      await new Promise((resolve, reject) => {
        if (liveTxAbortRef.current) {
          reject(new Error(`Realtime share of "${file.name}" may not have reached the recipient — they may have disconnected before it finished.`));
          return;
        }
        let settled = false;
        const finish = (fn) => { if (!settled) { settled = true; fn(); } };
        const timer = setTimeout(() => {
          livefileAckRef.current.delete(fileId);
          finish(() => reject(new Error(`Realtime share of "${file.name}" may not have reached the recipient — they may have disconnected before it finished.`)));
        }, RECEIVED_ACK_TIMEOUT_MS);
        livefileAckRef.current.set(fileId, () => { clearTimeout(timer); livefileAckRef.current.delete(fileId); finish(resolve); });
      });

      const localUrl = previewUrl || URL.createObjectURL(file);
      setMessages(m => m.map(msg => msg.id === tempId ? {
        ...msg,
        file: { name: file.name, type: file.type, size: file.size, url: localUrl, local: true, loading: false, ...(viewOnce && /^(image|video)\//.test(file.type) && { viewOnce: true }) }
      } : msg));
      toast.success(`Shared "${file.name}" in realtime`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Realtime share failed.");
      setMessages(m => m.filter(msg => msg.id !== tempId));
    } finally {
      liveFileTxRef.current = false;
      const next = liveTxQueueRef.current.shift();
      setLiveQueue(liveTxQueueRef.current.map((it) => it.file.name));
      if (next) {
        // Start the next queued transfer automatically.
        shareFileLive(next.file, next.viewOnce);
      }
    }
  };

  const handleIncomingLiveFile = (msg) => {
    if (!msg || msg.userName === userName?.trim()) return;
    const kind = msg.__livefile;
    const map = liveFileRxRef.current;
    if (kind === "meta") {
      const fid = msg.fid || msg.id; // stable sender transfer id (server overrides `id`)
      const tempId = `rx-${fid}`;
      map.set(fid, {
        key: fid,
        parts: new Array(msg.totalChunks).fill(null), got: 0,
        name: msg.name, mime: msg.mime, size: msg.size, totalChunks: msg.totalChunks,
        viewOnce: msg.viewOnce, from: msg.userName, tempId, lastAt: Date.now()
      });
      setMessages(m => [...m, {
        id: tempId, userName: msg.userName,
        file: { name: msg.name, type: msg.mime, size: msg.size, loading: true, phase: "receiving-live", progress: 0, loaded: 0, total: msg.size },
        ts: Date.now()
      }]);
      return;
    }
    const entry = map.get(msg.fid || msg.id);
    if (!entry) return;
    entry.lastAt = Date.now();
    if (kind === "chunk") {
      if (entry.parts[msg.seq] == null) {
        try {
          entry.parts[msg.seq] = b64ToBytes(msg.data);
          entry.got++;
        } catch (e) {
          console.error("Failed to decode chunk:", msg.seq, e);
        }
      }
      if (entry.got % 3 === 0 || entry.got === entry.totalChunks) {
        const loaded = Math.min(entry.got * LIVE_SHARE_CHUNK_BYTES, entry.size);
        setMessages(prev => prev.map(m2 => m2.id === entry.tempId ? { ...m2, file: { ...m2.file, progress: Math.floor((loaded * 100) / entry.size), loaded } } : m2));
      }
      return;
    }
    if (kind === "end") {
      const fid = msg.fid || msg.id;
      map.delete(fid);
      try {
        const cleanParts = entry.parts.map(p => p || new Uint8Array(0));
        const url = URL.createObjectURL(new Blob(cleanParts, { type: entry.mime || "application/octet-stream" }));
        setMessages(prev => prev.map(m2 => m2.id === entry.tempId ? {
          ...m2,
          file: { name: entry.name, type: entry.mime, size: entry.size, url, local: true, loading: false, ...(entry.viewOnce && { viewOnce: true }) }
        } : m2));
        // Tell the sender the full file was received so it reports real success.
        socketRef.current.emit("livefile-received", { fileId: fid });
      } catch (e) {
        console.error("Live file assemble failed:", e);
        setMessages(prev => prev.filter(m2 => m2.id !== entry.tempId));
        toast.error(`Failed to assemble "${entry.name}".`);
      }
    }
  };

  useEffect(() => {
    const sweep = setInterval(() => {
      const map = liveFileRxRef.current;
      const now = Date.now();
      [...map.values()].forEach((entry) => {
        if (now - entry.lastAt > 180000) {
          map.delete(entry.key);
          setMessages(prev => prev.filter(m2 => m2.id !== entry.tempId));
        }
      });
    }, 30000);
    return () => clearInterval(sweep);
  }, []);

  // ---- P2P WebRTC DataChannel file receive -------------------------------
  // Registers one inbound handler per socket connect. When a peer opens a
  // DataChannel, meta/chunks/end are assembled in the module (pure P2P, no
  // server involved) and we just mirror it into the same placeholder message +
  // progress UI used by the socket relay, then finalize on DONE.
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return undefined;
    const cleanup = registerP2PReceiver({
      socket: s,
      onMeta: ({ fid, meta, tempId }) => {
        setMessages(m => [...m, {
          id: tempId, userName: meta.fromName || "",
          file: { name: meta.name, type: meta.mime, size: meta.size, loading: true, phase: "receiving-live", progress: 0, loaded: 0, total: meta.size },
          ts: Date.now()
        }]);
        return ({ data, got, totalChunks, size }) => {
          const loaded = Math.min(got * P2P_CHUNK_BYTES, size);
          setMessages(prev => prev.map(m2 => m2.id === tempId ? { ...m2, file: { ...m2.file, progress: Math.floor((loaded * 100) / size), loaded } } : m2));
        };
      },
      onProgress: ({ fid, progress, loaded, total }) => {
        const tempId = `p2p-${fid}`;
        setMessages(prev => prev.map(m2 => m2.id === tempId ? { ...m2, file: { ...m2.file, progress, loaded } } : m2));
      },
      onDone: ({ url, name, mime, size, viewOnce, error, fid }) => {
        const tempId = `p2p-${fid}`;
        if (error) {
          toast.error(`P2P file failed to assemble: ${error}`);
          setMessages(prev => prev.filter(m2 => m2.id !== tempId));
          return;
        }
        setMessages(prev => prev.map(m2 => m2.id === tempId ? {
          ...m2,
          file: { name, type: mime, size, url, local: true, loading: false, ...(viewOnce && { viewOnce: true }) }
        } : m2));
      }
    });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef.current]);

  const compressImageIfNeeded = (file) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return Promise.resolve(file);
    if (file.size <= 1.5 * 1024 * 1024) return Promise.resolve(file);

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 1920;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.82
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const uploadFile = async (rawFile, viewOnce = false, scheduleTime = null) => {
    let file = rawFile;
    if (rawFile.type.startsWith("image/") && rawFile.type !== "image/gif") {
      try {
        file = await compressImageIfNeeded(rawFile);
      } catch (err) {
        // Fallback to original
      }
    }

    let tempId;
    let previewUrl = null;
    let shouldBypassCloudinary = false;
    try {
      // Effective upload cap = the room's plan maxFileSize (per-room override
      // wins; -1/unset means the 1 GB multer hard ceiling). Enforced client-side
      // for a fast error, and again server-side by /api/upload per room.
      const planMaxMB = roomPlanLimits?.maxFileSize;
      const planMaxBytes = planMaxMB == null || planMaxMB === -1 ? MAX_UPLOAD_BYTES : Math.min(planMaxMB * 1024 * 1024, MAX_UPLOAD_BYTES);
      if (file.size > planMaxBytes) {
        // A plan's file-size cap is ABSOLUTE — it must never be bypassed by the
        // realtime socket relay (that only exists as a fallback for a file that
        // is within-plan but the server can't store). Otherwise a free (5 MB)
        // plan could blast a 146 MB file over the socket and knock peers off.
        if (planMaxMB == null || planMaxMB === -1) {
          if (file.size > 1024 * 1024 * 1024) {
            toast.error(`"${file.name}" exceeds the maximum 1 GB upload limit.`);
            return;
          }
          shouldBypassCloudinary = true;
        } else {
          toast.error(`"${file.name}" exceeds this room's ${planMaxMB >= 1024 ? `${(planMaxMB / 1024).toFixed(0)} GB` : `${Math.round(planMaxMB)} MB`} upload limit. Contact the room owner to upgrade the plan.`);
          return;
        }
      }
      // Route by size UP-FRONT — no more guessing between two mechanisms.
      // The backend is on Vercel serverless (~4 MB body cap), so anything at or
      // above REALTIME_FLOOR_BYTES can never go through the HTTP /api/upload
      // (it would 413). Those files go straight to realtime sharing instead.
      const planAllowsSize = planMaxMB == null || planMaxMB === -1 || file.size <= planMaxMB * 1024 * 1024;
      const hasLiveRecipient = onlineUsers.length >= 2;
      const overHttpFloor = file.size >= REALTIME_FLOOR_BYTES && file.size <= LIVE_SHARE_PRACTICAL_MAX_BYTES;
      if (!scheduleTime && planAllowsSize && overHttpFloor) {
        if (hasLiveRecipient) {
          await shareFileLive(file, viewOnce);
          return;
        }
        // No recipient online — the socket relay can't carry it, and Vercel
        // would 413 on the HTTP path. Fail fast instead of a doomed upload.
        toast.error(`"${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB) is too large for this server to store directly. Ask someone to join the room, then send it again to share in realtime.`);
        return;
      }

      tempId = `uploading-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const looksMedia = /^(image|video)\//.test(file.type) ||
        /\.(png|jpe?g|gif|webp|avif|bmp|svg|mp4|mov|webm|mkv|m4v)$/i.test(file.name || "");
      if (looksMedia) {
        try { previewUrl = URL.createObjectURL(file); } catch { previewUrl = null; }
      }
      const willEncrypt = Boolean(roomKey && file.size <= 200 * 1024 * 1024);
      setMessages(m => [...m, {
        id: tempId,
        userName,
        file: {
          name: file.name, type: file.type, size: file.size,
          loading: true, progress: 0, speed: 0,
          loaded: 0, total: file.size,
          phase: willEncrypt ? "encrypting" : "uploading",
          ...(previewUrl && { previewUrl })
        },
        ts: Date.now()
      }]);

      const updateTempFile = (patch) => {
        setMessages(msgs => msgs.map(msg => msg.id === tempId ? { ...msg, file: { ...msg.file, ...patch } } : msg));
      };

      let fileToUpload = file;
      let ivString = null;
      let keyB64 = null;

      if (willEncrypt) {
        const fileBuffer = await file.arrayBuffer();
        const encrypted = await encryptBinary(roomKey, fileBuffer);
        const encryptedBlob = new Blob([encrypted.data], { type: "application/octet-stream" });
        fileToUpload = new File([encryptedBlob], file.name + ".enc", { type: "application/octet-stream" });
        ivString = btoa(String.fromCharCode(...new Uint8Array(encrypted.iv)));
        keyB64 = await exportKey(roomKey);
        updateTempFile({ phase: "uploading" });
      }


      const formData = new FormData();
      formData.append("file", fileToUpload);
      if (roomIdRef.current && roomIdRef.current.trim()) {
        formData.append("roomId", roomIdRef.current.trim());
      }

      // Real-time progress tracking: smooth % + live transfer speed
      let lastTickTime = performance.now();
      let lastTickLoaded = 0;
      let lastEmit = 0;
      const doUpload = () => axios.post(
        `${backendUrl}/api/upload`,
        formData,
        {
          headers: { 
            "Content-Type": "multipart/form-data",
            ...(shouldBypassCloudinary && { "bypass-cloudinary": "true" })
          },
          // Never let a dead connection spin forever: generous per-MB budget
          // with a 90s floor so slow mobile uploads still succeed.
          timeout: Math.max(90000, Math.round((fileToUpload.size / (1024 * 1024)) * 12000)),
          onUploadProgress: (progressEvent) => {
            // Some axios/browser combos never populate `total` for multipart —
            // fall back to the known payload size so progress ALWAYS works.
            const total = progressEvent.total || fileToUpload.size;
            if (!total) return;
            const now = performance.now();
            const loaded = Math.min(progressEvent.loaded, total);
            const percent = Math.min(100, (loaded * 100) / total);
            const dt = now - lastTickTime;
            if (dt >= 400) {
              const bytesSinceTick = loaded - lastTickLoaded;
              if (bytesSinceTick > 0) {
                updateTempFile({ speed: Math.round((bytesSinceTick / dt) * 1000) });
              }
              lastTickTime = now;
              lastTickLoaded = loaded;
            }
            // Throttle React updates to ~12fps for buttery-smooth reveal without re-render storms
            if (now - lastEmit >= 80 || percent >= 100) {
              lastEmit = now;
              updateTempFile({
                // True byte-level percentage — no artificial caps
                progress: Math.floor(percent),
                loaded,
                total,
                ...(percent >= 100 ? { phase: "finalizing" } : {})
              });
            }
          }
        }
      );
      // One giant POST through a PaaS proxy is fragile on mobile networks —
      // retry once on dropped connections / server hiccups before giving up.
      let res;
      for (let attempt = 1; ; attempt++) {
        try {
          res = await doUpload();
          break;
        } catch (upErr) {
          const status = upErr.response?.status;
          const retryable = !upErr.response || upErr.code === "ECONNABORTED" || (status >= 500 && status <= 599);
          if (attempt >= 2 || !retryable) throw upErr;
          updateTempFile({ phase: "uploading", progress: 0, loaded: 0 });
          lastTickTime = performance.now();
          lastTickLoaded = 0;
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      const fileData = {
        url: res.data.secure_url,
        name: file.name,
        type: file.type || res.data.format,
        publicId: res.data.public_id,
        resourceType: res.data.resource_type,
        ...(viewOnce && /^(image|video)\//.test(file.type) && { viewOnce: true }),
        ...(ivString && { iv: ivString })
      };
      if (!fileData.url) {
        throw new Error(res.data?.error || "Upload service did not return a file URL. Please try again.");
      }
      if (scheduleTime) {
        const plainPayload = {
          file: { ...fileData, ...(keyB64 && { keyB64 }) },
          ...(replyTo && { replyTo })
        };
        let payload = plainPayload;
        if (roomKey) {
          const encrypted = await encryptMessage(roomKey, JSON.stringify(plainPayload));
          payload = {
            encryptedPayload: encrypted,
            // Only include non-sensitive file refs for non-E2EE viewers; keyB64 stays inside encryptedPayload only
            file: { url: fileData.url, name: fileData.name, type: fileData.type }
          };
        }
        await new Promise((resolve, reject) => {
          socketRef.current.emit("scheduleMessage", {
            roomId,
            userName,
            senderAvatar: userAvatar,
            payload,
            sendAt: scheduleTime,
            ephemeral: ephemeralMode,
            ephemeralDuration: roomEphemeralDuration
          }, (res) => {
            if (res?.error) reject(new Error(res.error));
            else resolve(res);
          });
        });
      } else {
        // Register the local blob so my own echoed file message renders
        // instantly from the preview instead of re-downloading/decrypting.
        if (ivString && previewUrl) {
          localFileObjectsRef.current.set(ivString, { url: previewUrl, name: file.name, type: file.type });
        }
        await handleSend({ file: fileData }, keyB64);
      }
      setMessages(m => m.filter(msg => msg.id !== tempId));
      if (ivString) localFileObjectsRef.current.delete(ivString);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    } catch (err) {
      console.error(err);
      const status = err.response?.status;
      const detail = err.response?.data?.error || err.message;
      const planLimitRejected = err.response?.data?.planLimit === true;
      const tooLarge = status === 413 || /too large|file size/i.test(String(detail));
      if (planLimitRejected && !scheduleTime) {
        // A plan's explicit file-size cap is absolute — surface the upgrade
        // message instead of relaying the file over the socket (which would
        // bypass the plan and risk disconnecting peers).
        setMessages(m => m.filter(msg => msg.id !== tempId));
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        toast.error(detail || "File exceeds this room's plan upload limit.");
        return;
      }
      if (tooLarge && !scheduleTime) {
        setMessages(m => m.filter(msg => msg.id !== tempId));
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        if (onlineUsers.length >= 2) {
          toast.info(`"${file.name}" exceeds the server upload limit — falling back to realtime sharing.`);
          await shareFileLive(file, viewOnce);
        } else {
          toast.error(`"${file.name}" exceeds the server upload limit. Tip: Realtime sharing fallback needs someone else in the room.`);
        }
        return;
      }
      let errorMsg = "File upload failed!";
      if (tooLarge) {
        errorMsg = `"${file.name}" exceeds the ${formatUploadLimit()} upload limit.`;
      } else if (!err.response) {
        errorMsg = `Upload failed — network dropped while sending "${file.name}". Check your connection and retry.`;
      } else if (detail) {
        errorMsg = String(detail);
      }
      // Big files should never dead-end: an upload failure at size gets a
      // realtime-relay second chance — but only while the relay can carry it
      // safely. Beyond the practical cap the socket relay risks flooding peers,
      // so large files error cleanly (relying on the durable Cloudinary path).
      const bigFile = file.size >= REALTIME_FLOOR_BYTES;
      const peersOnline = onlineUsers.length >= 2;
      const relayable = file.size <= LIVE_SHARE_PRACTICAL_MAX_BYTES;
      if (bigFile && peersOnline && !scheduleTime && relayable) {
        setMessages(m => m.filter(msg => msg.id !== tempId));
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        toast.info(`Direct upload failed for "${file.name}" — switching to realtime sharing.`, { autoClose: 5000 });
        await shareFileLive(file, viewOnce);
        return;
      }
      if (bigFile && !peersOnline) {
        errorMsg += " Tip: realtime sharing fallback needs someone else in the room.";
      }
      toast.error(errorMsg);
      if (tempId) setMessages(m => m.filter(msg => msg.id !== tempId));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
  };

  /* ================= PASTE SUPPORT ================= */

  useEffect(() => {
    const onPaste = (e) => {
      // Only hijack pastes meant for the composer — never the search box or other fields
      const t = e.target;
      const isComposerField = t === composerRef.current || (t instanceof Element && t.closest?.("[data-composer='true']"));
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (!isComposerField) return; // let native paste happen in search/password/etc
      }
      const pastedFiles = [...e.clipboardData.items]
        .filter((i) => i.kind === "file")
        .map((i) => i.getAsFile())
        .filter(Boolean);
      if (pastedFiles.length > 0) {
        setPendingFiles((prev) => [...prev, ...pastedFiles]);
        return;
      }
      const text = e.clipboardData.getData("text");
      if (!text) return;
      const lines = text.split("\n");
      if (lines.length >= 3) {
        let codeLineCount = 0;
        for (const line of lines) {
          if (
            /^\s{2,}\S/.test(line) ||
            /[{}();]\s*$/.test(line) ||
            /=>/.test(line) ||
            /^\s*(import|export|const|let|var|function|class|def |if\s*\(|else|for\s*\(|while\s*\(|return |public |private |protected |static |void |int |String |package |from |require\()/.test(line)
          ) {
            codeLineCount++;
          }
        }
        if (codeLineCount / lines.length > 0.4) {
          e.preventDefault();
          const wrapped = "```\n" + text + "\n```";
          setMessage((prev) => (prev ? prev + "\n" + wrapped : wrapped));
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  /* ================= SEND ================= */

  const handleSend = async (customData = null, keyB64 = null) => {
    if (!customData && pendingFiles.length > 0) {
      const filesToUpload = [...pendingFiles];
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      filesToUpload.forEach((f) => uploadFile(f, sendAsViewOnce));
      setSendAsViewOnce(false);
      return;
    }
    if (!customData && !message.trim()) return;

    // ── /ai slash command ────────────────────────────────────────────────────
    if (!customData && message.trim().startsWith("/ai ")) {
      const aiPrompt = message.trim().slice(4).trim();
      if (!aiPrompt) { toast.info("Usage: /ai <your question>"); return; }
      setMessage("");
      // Show the user's question as their own message, then the AI response below it
      const userMsgId = `ai-q-${Date.now()}`;
      const aiMsgId = `ai-a-${Date.now()}`;
      setMessages(m => [...m,
        { id: userMsgId, userName, ts: Date.now(), text: aiPrompt },
        { id: aiMsgId, userName: "CheprabAI", ts: Date.now(), file: { name: "CheprabAI", type: "ai", loading: true } }
      ]);
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || (window.location.hostname === "localhost" ? "http://localhost:4000" : (process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.vercel.app"));
        const resp = await fetch(`${backendUrl}/api/ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: aiPrompt }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) throw new Error(data.error || "AI request failed");
        setMessages(m => m.map(msg => msg.id === aiMsgId ? { ...msg, file: { name: "CheprabAI", type: "ai", text: data.text, loading: false } } : msg));
      } catch (err) {
        setMessages(m => m.filter(msg => msg.id !== aiMsgId));
        toast.error(err.message || "AI request failed.");
      }
      return;
    }

    // Code block mode: fence the message unless the user already fenced it
    let textToSend = message;
    if (codeBlockMode && !message.includes("```")) {
      textToSend = "```\n" + message + "\n```";
    }

    // ── Owner-controlled Content Moderation Filter (runs pre-encryption) ──
    if (!customData && textToSend.trim() && !ownerToken) {
      if (bannedWords && bannedWords.length > 0) {
        let filtered = textToSend;
        bannedWords.forEach(word => {
          if (!word) return;
          const escaped = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(escaped, 'gi');
          filtered = filtered.replace(regex, '');
        });
        filtered = filtered.replace(/\s+/g, ' ').trim();
        if (!filtered) {
          toast.warning("⚠️ Message blocked by content filter.");
          return;
        }
        textToSend = filtered;
      }
    }

    let plainPayload = { ...(customData || { text: textToSend }), ...(replyTo && { replyTo }), ...(sendAsViewOnce && !customData && { viewOnce: true }) };
    if (plainPayload.file && keyB64) {
      plainPayload = {
        ...plainPayload,
        file: {
          ...plainPayload.file,
          keyB64
        }
      };
    }
    let payload = plainPayload;

    if (roomKey) {
      // Encrypt the entire payload object as a JSON string for complete E2EE (covers text, file metadata, and GIFs)
      const encrypted = await encryptMessage(roomKey, JSON.stringify(plainPayload));
      payload = {
        encryptedPayload: encrypted,
        // Only include unencrypted file URL reference for non-E2EE viewers; keyB64 stays inside encryptedPayload only
        ...(customData && customData.file && { file: { url: customData.file.url, name: customData.file.name, type: customData.file.type } })
      };
    }

    const isEphemeral = ephemeralMode || roomEphemeralDuration > 0;
    const outgoingMessage = {
      payload,
      userName,
      senderAvatar: userAvatar,
      roomId,
      ts: Date.now(),
      ephemeral: isEphemeral,
      ephemeralDuration: roomEphemeralDuration > 0 ? roomEphemeralDuration : DEFAULT_EPHEMERAL_DURATION,
    };

    try {
      await new Promise((resolve, reject) => {
        socketRef.current.emit("sendMessage", outgoingMessage, (result) => {
          if (result?.success) resolve(result);
          else reject(new Error(result?.error || "Message delivery was not confirmed."));
        });
      });
    } catch (sendErr) {
      // Server refused the message (room gone, rate limit, stealth block…).
      // Surface it as a toast — an unhandled rejection here crashes the dev
      // overlay and makes a normal server response look like the app broke.
      toast.error(sendErr?.message || "Message could not be delivered.");
      return;
    }

    if (!customData) {
      setMessage("");
      setCodeBlockMode(false);
      setSendAsViewOnce(false);
      stopTyping();
    }
    setReplyTo(null);
    localStorage.removeItem(`cheprabai:draft:${roomId}`);
  };

  const toggleReaction = (messageId, emoji) => {
    if (features.reactions === false) {
      toast.error("Reactions are currently disabled by the room owner.");
      return;
    }
    const localId = socketRef.current?.id || "local";
    setMessages((items) => items.map((item) => {
      if (item.id !== messageId) return item;
      const reactions = { ...(item.reactions || {}) };
      const users = { ...(reactions[emoji] || {}) };
      if (users[localId]) delete users[localId];
      else users[localId] = { name: userName || "You", timestamp: Date.now() };
      if (Object.keys(users).length) reactions[emoji] = users;
      else delete reactions[emoji];
      return { ...item, reactions };
    }));
    socketRef.current?.emit("messageReaction", { messageId, emoji }, (result) => {
      if (!result?.success) toast.error(result?.error || "Could not update reaction.");
    });
  };

  const lastTypingEmitRef = useRef(0);
  const handleTyping = (value) => {
    if (features.typingIndicators === false) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 500) return; // throttle to 500ms
    lastTypingEmitRef.current = now;
    socketRef.current.emit("typing", { isTyping: value.length > 0, roomId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () => socketRef.current.emit("typing", { isTyping: false, roomId }),
      2000,
    );
  };

  // Safety net: never trust a typing entry older than 12s, even if the server
  // keeps re-sending a stale name (frozen tab, dropped stop-event).
  useEffect(() => {
    if (!typingUsers.length) return undefined;
    const iv = setInterval(() => {
      const cutoff = Date.now() - 12000;
      const seen = typingFirstSeenRef.current;
      const expired = typingUsers.filter((n) => (seen.get(n) ?? 0) < cutoff);
      if (expired.length) {
        expired.forEach((n) => seen.delete(n));
        setTypingUsers((prev) => prev.filter((n) => !expired.includes(n)));
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [typingUsers]);

  const stopTyping = () => {
    clearTimeout(typingTimeout.current);
    if (features.typingIndicators === false) return;
    socketRef.current?.emit("typing", { isTyping: false, roomId });
  };

  /* ================= LOAD MORE MESSAGES ================= */
  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMoreMessages) return;
    setLoadingMore(true);
    socketRef.current.emit("loadMoreMessages", { offset: messages.length });
  }, [loadingMore, hasMoreMessages, messages.length]);

  // ── Swipe-to-reply (Telegram-style gesture) ─────────────────────────────
  // Drag a message bubble horizontally ~70px to set it as the reply target.
  // Vertical intent is detected first so normal scrolling is never hijacked.
  const swipeGesturesRef = useRef({});

  const buildReplyTarget = (m) => ({
    id: m.id,
    userName: m.userName,
    preview: m.file?.viewOnce
      ? "View-once media"
      : m.text || m.file?.name || (m.gif ? "GIF" : "Media"),
    file: m.file?.viewOnce ? { viewOnce: true } : m.file || null,
    gif: m.file?.viewOnce ? null : m.gif || null,
  });

  const SWIPE_THRESHOLD = 70;
  const SWIPE_MAX = 110;

  const handleBubbleTouchStart = (e, key) => {
    if (!swipeReplyEnabled) return;
    const t = e.touches[0];
    swipeGesturesRef.current[key] = { x: t.clientX, y: t.clientY, locked: false, dx: 0 };
  };

  const handleBubbleTouchMove = (e, key) => {
    const g = swipeGesturesRef.current[key];
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (!g.locked) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dy) > Math.abs(dx)) { delete swipeGesturesRef.current[key]; return; }
      g.locked = true;
    }
    g.dx = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx));
    const el = e.currentTarget;
    el.style.transition = "none";
    el.style.transform = `translateX(${g.dx}px)`;
    const armed = Math.abs(g.dx) >= SWIPE_THRESHOLD;
    el.style.boxShadow = armed
      ? "0 0 0 2px rgba(129,140,248,0.75), 0 8px 24px rgba(99,102,241,0.25)"
      : "";
  };

  const handleBubbleTouchEnd = (e, key, m) => {
    const g = swipeGesturesRef.current[key];
    delete swipeGesturesRef.current[key];
    if (!g) return;
    const el = e.currentTarget;
    el.style.transition = "transform 0.22s cubic-bezier(0.16,1,0.3,1)";
    el.style.transform = "translateX(0)";
    el.style.boxShadow = "";
    if (g.locked && Math.abs(g.dx) >= SWIPE_THRESHOLD) {
      navigator.vibrate?.(15);
      setReplyTo(buildReplyTarget(m));
    }
  };

  const handleScroll = () => {
    if (isScrollingRef.current) return;
    isScrollingRef.current = true;
    requestAnimationFrame(() => {
      isScrollingRef.current = false;
      const container = messagesContainerRef.current;
      if (!container) return;
      const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 250;

      setShowScrollPill(prev => {
        if (isNearBottom && prev) return false;
        if (!isNearBottom && !prev) return true;
        return prev;
      });

      if (isNearBottom) {
        setUnreadCount(0);
      }
    });
  };

  /* ================= DRAG & DROP FILE UPLOAD ================= */
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer?.items?.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;
    if (features.fileSharing === false) {
      toast.error("File sharing is currently disabled by the room owner.");
      return;
    }
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files]);
    }
  };

  /* ================= LOCAL DRAFT RETENTION ================= */
  const draftKey = `cheprabai:draft:${roomId}`;

  // Restore draft on mount
  useEffect(() => {
    if (!roomId) return;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      setMessage(savedDraft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Auto-save draft as user types
  useEffect(() => {
    if (!roomId) return;
    if (message.trim()) {
      localStorage.setItem(draftKey, message);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [message, draftKey, roomId]);


  /* ================= SCHEDULED MESSAGES ================= */
  const handleScheduleMessage = async () => {
    if (!message.trim() && !pendingFiles.length) {
      toast.error("Type a message or select files to schedule");
      return;
    }
    if (!scheduleDateTime) {
      toast.error("Pick a date and time");
      return;
    }
    const sendAt = new Date(scheduleDateTime).getTime();
    if (sendAt <= Date.now()) {
      toast.error("Schedule time must be in the future");
      return;
    }

    const filesToUpload = [...pendingFiles];
    const textMsg = message.trim();

    // Clear input states
    setPendingFiles([]);
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowScheduler(false);

    // 1. If there are files, upload and schedule each
    if (filesToUpload.length > 0) {
      filesToUpload.forEach((f) => {
        uploadFile(f, sendAsViewOnce, sendAt);
      });
      setSendAsViewOnce(false);
      toast.success(`⏰ Scheduling ${filesToUpload.length} file(s) for ${new Date(sendAt).toLocaleString()}`);
    }

    // 2. If there is text, schedule it
    if (textMsg) {
      const plainPayload = { text: textMsg, ...(replyTo && { replyTo }) };
      let payload = plainPayload;
      if (roomKey) {
        const encrypted = await encryptMessage(roomKey, JSON.stringify(plainPayload));
        payload = { encryptedPayload: encrypted };
      }

      socketRef.current.emit("scheduleMessage", {
        roomId,
        userName,
        senderAvatar: userAvatar,
        payload,
        sendAt,
        ephemeral: ephemeralMode,
        ephemeralDuration: roomEphemeralDuration
      }, (res) => {
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success(`⏰ Message scheduled for ${new Date(sendAt).toLocaleString()}`);
        }
      });
      setReplyTo(null);
    }

    setScheduleDateTime("");
  };

  const handleCancelScheduled = (messageId) => {
    socketRef.current.emit("cancelScheduledMessage", { roomId, messageId }, (res) => {
      if (res?.error) toast.error(res.error);
      else toast.success("Scheduled message cancelled");
    });
  };

  /* ================= BOOKMARKS / SAVED MESSAGES ================= */
  const toggleBookmark = (msg) => {
    setBookmarks(prev => {
      const exists = prev.some(b => b.id === msg.id);
      let next;
      if (exists) {
        next = prev.filter(b => b.id !== msg.id);
        toast.info("🔖 Bookmark removed");
      } else {
        next = [...prev, { id: msg.id, text: msg.text, userName: msg.userName, ts: msg.ts, roomId }];
        toast.success("🔖 Message bookmarked!");
      }
      localStorage.setItem("cheprabai:bookmarks", JSON.stringify(next));
      return next;
    });
  };

  const bookmarkIds = useMemo(() => new Set(bookmarks.map(b => b.id)), [bookmarks]);
  const pinnedIds = useMemo(() => new Set(pinnedMessages.map(pm => pm.id)), [pinnedMessages]);

  /* ================= VOICE NOTES ================= */
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        await uploadFile(file);
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
      };
      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      toast.error("Microphone access denied");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  /* ================= EXPORT CHAT ================= */
  const exportChat = async () => {
    const userColorMap = {};
    let colorIdx = 0;
    const getExportColor = (name) => {
      if (!userColorMap[name]) {
        userColorMap[name] = colorPalette[colorIdx % colorPalette.length];
        colorIdx++;
      }
      return userColorMap[name];
    };

    const payloadMessages = messages
      .filter(m => m.type !== "system" && !m.__livefile)
      .map(m => {
        const isOwn = m.userName === userName;
        const text = m.text || (m.file ? `[File: ${m.file.name}]` : m.gif ? "[GIF]" : m.poll ? m.poll.question : "");
        return {
          userName: m.userName || "Unknown User",
          isOwn,
          color: getExportColor(m.userName),
          text,
          ts: m.ts,
          ...(m.file && { file: { name: m.file.name, type: m.file.type || "Unknown type", url: m.file.url || "" } }),
          ...(m.gif && m.gif.url && { gif: { url: m.gif.url } }),
          ...(m.poll && { poll: { question: m.poll.question, options: m.poll.options, votes: m.poll.votes || {}, totalVotes: Object.values(m.poll.votes || {}).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0) } }),
          ...(m.reactions && Object.keys(m.reactions).length > 0 && { reactions: m.reactions }),
          ...(m.replyTo && { replyTo: { userName: m.replyTo.userName, text: m.replyTo.preview || m.replyTo.text || "Attachment" } }),
          ...(m.forwarded && { forwarded: true, forwardedFrom: m.forwardedFrom || "" }),
          ...(m.viewOnce && { viewOnce: true }),
          ...(m.ephemeralDuration > 0 && { ephemeral: true }),
        };
      });
    if (!payloadMessages.length) {
      toast.info("Nothing to export yet.");
      return;
    }

    const downloadBlob = (blob, name) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    };
    const stamp = `chat_${roomId}_${Date.now()}`;

    // Encrypted self-contained HTML archive (PBKDF2 + AES-GCM, decrypted
    // in-browser by the file itself). Falls back to plain text if WebCrypto
    // or the password modal is unavailable.
    let password = null;
    if (window.isSecureContext && crypto?.subtle) {
      password = await new Promise((resolve) => {
        exportPwdResolveRef.current = resolve;
        setExportPwdValue("");
        setExportPwdErr("");
        setExportPwdOpen(true);
      });
      if (!password) return;
    }
    try {
      const enc = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
      const aesKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
      );
      const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(JSON.stringify({ messages: payloadMessages })));
      const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
      const html = createDecryptionHtmlTemplate(roomId, toB64(cipherBuf), toB64(salt), toB64(iv));
      downloadBlob(new Blob([html], { type: "text/html" }), `${stamp}.html`);
      toast.success("Encrypted chat archive exported!");
    } catch (err) {
      console.warn("HTML export failed, falling back to text:", err);
      const textContent = payloadMessages.map(m => {
        const time = new Date(m.ts).toLocaleString();
        return `[${time}] ${m.userName}: ${m.text || ""}`;
      }).join("\n");
      downloadBlob(new Blob([`Chat Export — Room: ${roomId}\nExported: ${new Date().toLocaleString()}\n${"─".repeat(50)}\n\n${textContent}`], { type: "text/plain" }), `${stamp}.txt`);
      toast.success("Chat exported as text.");
    }
  };

  const importChat = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const text = evt.target.result;
        
        // Extract base64 constants from the HTML template script block
        const dataMatch = text.match(/const\s+B64_DATA\s*=\s*"(.*?)"/);
        const saltMatch = text.match(/const\s+B64_SALT\s*=\s*"(.*?)"/);
        const ivMatch = text.match(/const\s+B64_IV\s*=\s*"(.*?)"/);
        
        if (!dataMatch || !saltMatch || !ivMatch) {
          toast.error("Invalid backup file. Could not find cryptographic signatures.");
          return;
        }
        
        const b64Data = dataMatch[1];
        const b64Salt = saltMatch[1];
        const b64Iv = ivMatch[1];
        
        const password = window.prompt("Enter the backup password to decrypt history:");
        if (!password) return;
        
        const b64ToUint8 = (b64) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i);
          }
          return bytes;
        };
        
        try {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          
          const salt = b64ToUint8(b64Salt);
          const iv = b64ToUint8(b64Iv);
          const ciphertext = b64ToUint8(b64Data);
          
          const baseKey = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
          );
          
          const aesKey = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
          );
          
          const decryptedBuf = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            aesKey,
            ciphertext
          );
          
          const parsed = JSON.parse(decoder.decode(decryptedBuf));
          if (!parsed.messages || !Array.isArray(parsed.messages)) {
            toast.error("Invalid backup structure.");
            return;
          }
          
          const imported = parsed.messages.map(m => ({
            id: m.id || `imported-${m.ts}-${Math.random()}`,
            userName: m.userName,
            text: m.text,
            ts: m.ts,
            file: m.file,
            isImported: true
          }));
          
          setMessages(prev => {
            const existing = new Set(prev.map(msg => `${msg.userName}-${msg.text}-${msg.ts}`));
            const filtered = imported.filter(msg => !existing.has(`${msg.userName}-${msg.text}-${msg.ts}`));
            return [...prev, ...filtered].sort((a, b) => a.ts - b.ts);
          });
          
          toast.success(`Successfully imported ${imported.length} messages!`);
        } catch (err) {
          toast.error("Cryptographic Decryption Failed. Check password.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const fetchAdminDiagnostics = () => {
    socketRef.current?.emit("getAdminDiagnostics", (res) => {
      if (res?.success) {
        setDiagnosticsData(res);
        setDiagnosticsError("");
      } else {
        setDiagnosticsError(res?.error || "Failed to fetch server metrics");
      }
    });
  };

  useEffect(() => {
    if (showDiagnostics) {
      fetchAdminDiagnostics();
      diagnosticsIntervalRef.current = setInterval(fetchAdminDiagnostics, 5000);
    } else {
      if (diagnosticsIntervalRef.current) {
        clearInterval(diagnosticsIntervalRef.current);
      }
    }
    return () => {
      if (diagnosticsIntervalRef.current) {
        clearInterval(diagnosticsIntervalRef.current);
      }
    };
  }, [showDiagnostics]);

  const requestAvatarChange = (value) => {
    if (features.profiles === false) return;
    if (!value) return;
    setConfirmation({
      title: "Update your profile photo?",
      body: "Your new photo will be visible to people currently in this room.",
      confirmLabel: "Update photo",
      tone: "primary",
      onConfirm: () => {
        try {
          localStorage.setItem("cheprabai:user-avatar", value);
          setUserAvatar(value);
          socketRef.current?.emit("updateProfile", { avatar: value });
          toast.success("Profile photo updated.");
        } catch { toast.error("Browser storage is full. Choose a smaller image."); }
      }
    });
  };

  const openAvatarCrop = (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAvatarCrop({ file, previewUrl, zoom: 1 });
  };

  const confirmAvatarCrop = () => {
    if (!avatarCrop) return;
    const imageElement = new Image();
    imageElement.onload = () => {
      const sourceSize = Math.min(imageElement.naturalWidth, imageElement.naturalHeight) / avatarCrop.zoom;
      const startX = (imageElement.naturalWidth - sourceSize) / 2;
      const startY = (imageElement.naturalHeight - sourceSize) / 2;
      const canvas = document.createElement("canvas");
      const renderAvatar = (size, quality) => {
        canvas.width = canvas.height = size;
        canvas.getContext("2d").drawImage(imageElement, startX, startY, sourceSize, sourceSize, 0, 0, size, size);
        return canvas.toDataURL("image/webp", quality);
      };
      let avatar = renderAvatar(512, .86);
      // Optimise automatically for real-time sync; the selected source image is never rejected up-front.
      if (avatar.length > 1_350_000) avatar = renderAvatar(384, .78);
      URL.revokeObjectURL(avatarCrop.previewUrl);
      setAvatarCrop(null);
      requestAvatarChange(avatar);
    };
    imageElement.onerror = () => toast.error("This image could not be prepared. Please choose another one.");
    imageElement.src = avatarCrop.previewUrl;
  };

  const renderAvatarCropDialog = () => avatarCrop && (
    <div role="dialog" aria-modal="true" aria-label="Crop profile photo" style={{ position: "fixed", inset: 0, zIndex: 22000, display: "grid", placeItems: "center", padding: 16, background: "rgba(0,0,0,.72)", backdropFilter: "blur(10px)" }}>
      <section style={{ width: "min(100%, 400px)", borderRadius: 22, padding: "clamp(18px, 5vw, 26px)", background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.13)", boxShadow: "0 24px 80px rgba(0,0,0,.55)" }}>
        <div style={{ fontSize: ".72rem", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 800, color: "var(--chakra-colors-brandPrimary)" }}>Profile photo</div>
        <h2 style={{ margin: "6px 0 5px", fontSize: "1.25rem" }}>Crop your avatar</h2>
        <p style={{ margin: "0 0 18px", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.45, fontSize: ".87rem" }}>Position the center of your photo inside the circle.</p>
        <div style={{ width: "min(62vw, 238px)", aspectRatio: "1", margin: "0 auto 20px", overflow: "hidden", borderRadius: "50%", border: "3px solid rgba(255,255,255,.18)", background: "#0b0c10", boxShadow: "0 0 0 8px rgba(255,255,255,.035)" }}><img src={avatarCrop.previewUrl} alt="Avatar crop preview" style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${avatarCrop.zoom})`, transition: "transform .18s ease" }} /></div>
        <label style={{ display: "grid", gap: 8, fontSize: ".82rem", fontWeight: 700 }}>Zoom<input type="range" min="1" max="2.5" step="0.05" value={avatarCrop.zoom} onChange={(event) => setAvatarCrop((crop) => ({ ...crop, zoom: Number(event.target.value) }))} /></label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}><button type="button" onClick={() => { URL.revokeObjectURL(avatarCrop.previewUrl); setAvatarCrop(null); }} style={{ minHeight: 44, padding: "0 15px", borderRadius: 11, border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "inherit", cursor: "pointer" }}>Cancel</button><button type="button" onClick={confirmAvatarCrop} style={{ minHeight: 44, padding: "0 15px", border: 0, borderRadius: 11, color: "white", background: "var(--chakra-colors-brandPrimary)", fontWeight: 800, cursor: "pointer" }}>Use this photo</button></div>
      </section>
    </div>
  );

  const applyBackgroundChange = (file, scope) => {
    if (!file) return;
    setConfirmation({
      title: scope === "everyone" ? "Set this background for everyone?" : "Change your chat background?",
      body: scope === "everyone" ? "This also locks background changes for other people in this room." : "This changes the appearance on this device only.",
      confirmLabel: scope === "everyone" ? "Apply for everyone" : "Apply to my chat",
      tone: "primary",
      onConfirm: () => {
        // Paint the chosen image immediately; the durable data URL is prepared in the background.
        const localPreview = URL.createObjectURL(file);
        setRoomBackground(localPreview);
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const value = String(reader.result);
            localStorage.setItem(`cheprabai:room-background:${roomId}`, value);
            setRoomBackground(value);
            if (scope === "everyone") socketRef.current?.emit("setRoomBackground", { background: value, scope }, (result) => { if (!result?.success) toast.error(result?.error || "Could not update the shared background."); });
            URL.revokeObjectURL(localPreview);
            toast.success("Room background updated.");
          } catch { URL.revokeObjectURL(localPreview); toast.error("Browser storage is full. Choose a smaller image."); }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleSaveEdit = async (messageId) => {
    if (!editInput.trim()) return;

    // Send the raw text — trimming would destroy indentation in pasted code
    let payload = { text: editInput };
    if (roomKey) {
      const encrypted = await encryptMessage(roomKey, JSON.stringify(payload));
      payload = { encryptedPayload: encrypted };
    }

    socketRef.current?.emit("editMessage", { messageId, newPayload: payload }, (res) => {
      if (res.error) {
        toast.error(res.error);
      } else {
        setEditingMessageId(null);
        toast.success("Message edited");
      }
    });
  };

  const handleForwardMessage = async () => {
    const targetRoomId = forwardRoomId.trim();
    const code = forwardSecurityCode.trim();
    if (!targetRoomId || !code) return toast.warn("Please enter target Room ID and Security Code.");
    // Server validates per-room passwords; client only checks non-empty

    try {
      let fileData = null;
      if (forwardTarget.file) {
        let keyB64 = forwardTarget.file.keyB64;
        if (!keyB64 && roomKey) {
          keyB64 = await exportKey(roomKey);
        }
        fileData = {
          ...forwardTarget.file,
          ...(keyB64 && { keyB64 })
        };
      }

      const plainPayload = {
        text: forwardTarget.text || "",
        ...(fileData && { file: fileData }),
        ...(forwardTarget.gif && { gif: forwardTarget.gif }),
        forwarded: true,
        forwardedFrom: forwardTarget.userName
      };

      const targetKey = await generateKeyFromSecret(forwardSecurityCode.trim() + forwardRoomId.trim(), forwardRoomId.trim());
      const encrypted = await encryptMessage(targetKey, JSON.stringify(plainPayload));

      let outerFile = null;
      if (fileData) {
        const { keyB64: _, ...rest } = fileData;
        outerFile = rest;
      }

      const outgoingMessage = {
        payload: {
          encryptedPayload: encrypted,
          ...(outerFile && { file: outerFile })
        },
        userName: userName,
        senderAvatar: userAvatar,
        roomId: forwardRoomId.trim(),
        securityCode: forwardSecurityCode.trim(),
        ts: Date.now(),
        ephemeral: false
      };

      socketRef.current.emit("sendMessage", outgoingMessage, (result) => {
        if (result?.success) {
          toast.success(`Message forwarded to room ${forwardRoomId}!`);
          setForwardTarget(null);
          setForwardRoomId("");
          setForwardSecurityCode("");
        } else {
          toast.error(result?.error || "Forwarding failed.");
        }
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to forward securely.");
    }
  };

  const renderPoll = (m) => {
    if (!m.poll) return null;
    const totalVotes = Object.values(m.pollVotes || {}).reduce((acc, optVotes) => acc + Object.keys(optVotes || {}).length, 0);

    return (
      <div style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: 16,
        margin: "8px 0",
        minWidth: 260,
        maxWidth: 400
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.2rem" }}>📊</span>
          <strong style={{ color: "var(--chakra-colors-textPrimary)", fontSize: "1.05rem" }}>{m.poll.question}</strong>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {m.poll.options.map((opt, idx) => {
            const votes = m.pollVotes?.[idx] ? Object.keys(m.pollVotes[idx]).length : 0;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const hasVoted = m.pollVotes?.[idx]?.[socketRef.current?.id] !== undefined;

            return (
              <div
                key={idx}
                onClick={() => {
                  socketRef.current?.emit("votePoll", { messageId: m.id, optionIndex: idx }, (res) => {
                    if (res?.error) toast.error(res.error);
                  });
                }}
                style={{
                  position: "relative",
                  background: "rgba(255,255,255,0.055)",
                  border: hasVoted ? "1px solid var(--chakra-colors-brandPrimary)" : "1px solid rgba(255,255,255,0.055)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  overflow: "hidden",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${pct}%`,
                  background: hasVoted ? "rgba(255, 63, 94, 0.12)" : "rgba(255,255,255,0.07)",
                  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  zIndex: 0
                }} />

                <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: hasVoted ? 700 : 500, color: "var(--chakra-colors-textPrimary)" }}>{opt}</span>
                  <span style={{ fontSize: "0.85rem", opacity: 0.8, fontWeight: 700, color: "var(--chakra-colors-textSecondary)" }}>
                    {votes} {votes === 1 ? "vote" : "votes"} ({pct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: "0.75rem", opacity: 0.6, textAlign: "right", color: "var(--chakra-colors-textSecondary)" }}>
          Total: {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        </div>
      </div>
    );
  };

  const renderPollCreator = () => {
    if (!showPollCreator) return null;

    return (
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 22000,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(0,0,0,.75)",
        backdropFilter: "blur(12px)"
      }}>
        <div style={{
          width: "min(100%, 450px)",
          borderRadius: 22,
          padding: 24,
          background: "var(--chakra-colors-surface)",
          border: "1px solid rgba(255,255,255,.13)",
          boxShadow: "0 24px 80px rgba(0,0,0,.55)",
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}>
          <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>Create group poll</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, opacity: 0.8 }}>Question</label>
            <input
              type="text"
              placeholder="What are we deciding?"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, opacity: 0.8 }}>Options</label>
            {pollOptions.map((opt, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...pollOptions];
                    newOpts[idx] = e.target.value;
                    setPollOptions(newOpts);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.07)",
                    color: "#fff",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPollOptions(pollOptions.filter((_, i) => i !== idx));
                    }}
                    style={{
                      background: "rgba(255, 71, 87, 0.1)",
                      border: "none",
                      borderRadius: 10,
                      color: "#ff4757",
                      width: 40,
                      cursor: "pointer"
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 6 && (
              <button
                type="button"
                onClick={() => setPollOptions([...pollOptions, ""])}
                style={{
                  alignSelf: "flex-start",
                  background: "transparent",
                  border: "none",
                  color: "var(--chakra-colors-brandPrimary)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 4
                }}
              >
                + Add Option
              </button>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => {
                setShowPollCreator(false);
                setPollQuestion("");
                setPollOptions(["", ""]);
              }}
              style={{
                minHeight: 44,
                padding: "0 20px",
                borderRadius: 11,
                border: "1px solid rgba(255,255,255,.15)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!pollQuestion.trim()) return toast.warn("Please enter a question.");
                const activeOpts = pollOptions.filter(o => o.trim());
                if (activeOpts.length < 2) return toast.warn("Please add at least 2 options.");

                await handleSend({
                  poll: {
                    question: pollQuestion.trim(),
                    options: activeOpts
                  }
                });

                setShowPollCreator(false);
                setPollQuestion("");
                setPollOptions(["", ""]);
                toast.success("Poll created!");
              }}
              style={{
                minHeight: 44,
                padding: "0 20px",
                border: 0,
                borderRadius: 11,
                color: "white",
                background: "var(--chakra-colors-brandPrimary)",
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              Launch Poll
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPinnedMessagesBanner = () => {
    if (!pinnedMessages || pinnedMessages.length === 0) return null;
    const latestPin = pinnedMessages[pinnedMessages.length - 1];

    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: "rgba(255, 255, 255, 0.02)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        color: "var(--chakra-colors-textPrimary)",
        fontSize: "0.85rem",
        zIndex: 5,
        gap: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", cursor: "pointer" }} onClick={() => jumpToMessage(latestPin.id)}>
          <span style={{ fontSize: "1.1rem", color: "var(--chakra-colors-brandPrimary)" }}>📌</span>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <strong>Pinned: </strong>
            {latestPin.poll ? `Poll: ${latestPin.poll.question}` : (latestPin.text || "Attachment")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pinnedMessages.length > 1 && (
            <span style={{ fontSize: "0.75rem", opacity: 0.6, color: "var(--chakra-colors-textSecondary)" }}>
              (+{pinnedMessages.length - 1} more)
            </span>
          )}
          {ownerToken && (
            <button
              onClick={() => {
                socketRef.current?.emit("unpinMessage", { messageId: latestPin.id });
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#ff4757",
                cursor: "pointer",
                padding: "2px 6px",
                fontSize: "0.8rem",
                fontWeight: 700
              }}
            >
              Unpin
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderForwardDialog = () => {
    if (!forwardTarget) return null;

    return (
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 22000,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(0,0,0,.75)",
        backdropFilter: "blur(12px)"
      }}>
        <div style={{
          width: "min(100%, 420px)",
          borderRadius: 20,
          padding: 24,
          background: "var(--chakra-colors-surface)",
          border: "1px solid rgba(255,255,255,.05)",
          boxShadow: "0 24px 70px rgba(0,0,0,.55)",
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>Forward Message</h3>
            <p style={{ margin: "4px 0 0 0", color: "var(--chakra-colors-textSecondary)", fontSize: "0.85rem" }}>
              Decrypt and forward this payload to another room.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, opacity: 0.8 }}>Target Room ID</label>
              <input
                type="text"
                placeholder="Target Room, e.g. 1000"
                value={forwardRoomId}
                onChange={(e) => setForwardRoomId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, opacity: 0.8 }}>Target Security Code</label>
              <input
                type="password"
                placeholder="Target security code"
                value={forwardSecurityCode}
                onChange={(e) => setForwardSecurityCode(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => {
                setForwardTarget(null);
                setForwardRoomId("");
                setForwardSecurityCode("");
              }}
              style={{
                minHeight: 44,
                padding: "0 20px",
                borderRadius: 11,
                border: "1px solid rgba(255,255,255,.15)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleForwardMessage}
              style={{
                minHeight: 44,
                padding: "0 20px",
                border: 0,
                borderRadius: 11,
                color: "white",
                background: "var(--chakra-colors-brandPrimary)",
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              Forward Securely
            </button>
          </div>
        </div>
      </div>
    );
  };

  const requestBackgroundChange = (file) => {
    if (!file || (backgroundLocked && !ownerToken)) return;
    if (ownerToken) { setBackgroundTarget(file); return; }
    applyBackgroundChange(file, "personal");
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    const selectionStart = e.target.selectionStart;
    setMessage(value);
    handleTyping?.(value);

    // Check for @mention trigger
    const textBeforeCursor = value.slice(0, selectionStart);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      const query = lastWord.slice(1).toLowerCase();
      setCursorPosition(selectionStart);

      const matches = onlineUsers.filter(u => u.name && u.name.toLowerCase().startsWith(query) && u.name !== userName);
      setMentionSuggestions(matches);
      setShowMentionSuggestions(matches.length > 0);
      setMentionIndex(0);
    } else {
      setShowMentionSuggestions(false);
    }

    // Check for / slash command trigger
    if (lastWord.startsWith("/") && !lastWord.includes("@")) {
      const query = lastWord.toLowerCase();
      const matches = SLASH_COMMANDS.filter(c => c.cmd.startsWith(query));
      setSlashSuggestions(matches);
      setShowSlashSuggestions(matches.length > 0 && value.length <= 50);
      setSlashIndex(0);
    } else {
      setShowSlashSuggestions(false);
    }
  };

  const handleInputKeyDown = (e) => {
    if (showMentionSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(mentionIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionSuggestions(false);
      }
    } else if (showSlashSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex(prev => (prev + 1) % slashSuggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex(prev => (prev - 1 + slashSuggestions.length) % slashSuggestions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectSlash(slashIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowSlashSuggestions(false);
      }
    } else {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const selectMention = (index) => {
    if (index < 0 || index >= mentionSuggestions.length) return;
    const selectedUser = mentionSuggestions[index];

    const textBeforeCursor = message.slice(0, cursorPosition);
    const textAfterCursor = message.slice(cursorPosition);

    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    const newText = textBeforeCursor.slice(0, lastAtIndex) + "@" + selectedUser.name + " " + textAfterCursor;
    setMessage(newText);
    setShowMentionSuggestions(false);
  };

  const selectSlash = (index) => {
    if (index < 0 || index >= slashSuggestions.length) return;
    const cmd = slashSuggestions[index].cmd;
    setMessage(cmd + " ");
    setShowSlashSuggestions(false);
    // Focus the input so the user can immediately start typing their prompt
    setTimeout(() => {
      const input = document.querySelector('#message-input') || document.querySelector('textarea');
      if (input) { input.focus(); const len = input.value.length; try { input.setSelectionRange(len, len); } catch {} }
    }, 0);
  };

  /* ================= UI ================= */

  const filteredMessages = useMemo(() => {
    if (!searchQuery) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => {
      if (m.type === "system") return false;
      // Search across text, file names/captions, poll questions and options
      const haystacks = [
        m.text,
        m.file?.name,
        m.file?.caption,
        m.poll?.question,
        ...(Array.isArray(m.poll?.options) ? m.poll.options.map(o => o.text ?? o) : [])
      ];
      return haystacks.some(h => typeof h === "string" && h.toLowerCase().includes(q));
    });
  }, [messages, searchQuery]);

  if (!joined || !authenticated) {
    return (
      <>
        <LandingWrapper>
          <ToastContainer position="top-center" autoClose={3000} limit={3} theme="dark" />
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse at 50% -5%, rgba(99,102,241,0.09) 0%, transparent 55%)"
          }} />
          <LandingBrandbar>
            <div className="lb-brand">
              <span className="lb-mark"><MessagesSquare size={16} strokeWidth={2.4} /></span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="lb-name">AnonChat</span>
                  <span className="lb-version">Beta</span>
                </span>
                <span className="lb-tag">Private encrypted workspace</span>
              </span>
            </div>
          </LandingBrandbar>
          <LandingGrid>
            <FeatureExplorer />
            <JoinContainer>
              <CardHalo />
              <div style={{ textAlign: "center", marginBottom: 6 }}>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(129,140,248,0.22)",
                  background: "rgba(99,102,241,0.08)",
                  color: "var(--chakra-colors-brandPrimary)",
                  fontSize: ".66rem",
                  fontWeight: 800,
                  letterSpacing: ".13em",
                  textTransform: "uppercase",
                  marginBottom: 18
                }}>
                  <ShieldCheck size={13} strokeWidth={2.5} />
                  Private · Encrypted · No sign-up
                </div>
                <h2 style={{ color: "var(--chakra-colors-textPrimary)", margin: 0, fontSize: "clamp(1.45rem, 4vw, 1.85rem)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.15 }}>
                  <ShimmerTitle>{roomId.trim() ? `Join room ${roomId.trim()}` : "Private rooms, minus the setup."}</ShimmerTitle>
                </h2>
                <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "clamp(.82rem, 2vw, .9rem)", margin: "10px auto 0", maxWidth: 320, lineHeight: 1.55 }}>
                  {roomId.trim()
                    ? "You've been invited. Enter your details to join this encrypted room."
                    : "Chats, calls and files — sealed with end-to-end encryption. No account, no traces."}
                </p>
              </div>

              {requireRoomApproval && !roomRequestPending && !showApprovalConfirm && (
                <div style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 183, 3, 0.25)",
                  background: "rgba(255, 183, 3, 0.05)",
                  color: "var(--chakra-colors-textSecondary)",
                  fontSize: "0.74rem",
                  lineHeight: 1.4,
                }}>
                  <span style={{ color: "#ffb703", fontWeight: 700 }}>Note:</span> New rooms require admin approval before creation.
                </div>
              )}

              {roomRequestPending && (
                <div style={{
                  padding: "10px 12px",
                  borderRadius: 9,
                  border: "1px solid rgba(76, 201, 240, 0.25)",
                  background: "rgba(76, 201, 240, 0.06)",
                  textAlign: "center",
                }}>
                  <div style={{ fontWeight: 800, marginBottom: 2, color: "var(--chakra-colors-brandPrimary)", fontSize: "0.82rem" }}>Request pending</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.4 }}>
                    Waiting for admin approval{pendingRequestId ? ` (${pendingRequestId.slice(0, 8)}…)` : ""}. You'll be notified here.
                  </div>
                </div>
              )}

              {showApprovalConfirm && (
                <div style={{
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,183,3,0.25)",
                  background: "rgba(255,183,3,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}>
                  <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#ffb703" }}>Room Creation Approval</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.45 }}>
                    Room <strong>{roomId}</strong> does not exist yet. Submit a creation request using your display name and security code?
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowApprovalConfirm(false)}
                      style={{
                        flex: 1, minHeight: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)",
                        background: "transparent", color: "inherit", cursor: "pointer", fontSize: "0.78rem"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitRoomRequest}
                      style={{
                        flex: 1, minHeight: 34, borderRadius: 8, border: 0,
                        background: "var(--chakra-colors-brandPrimary)", color: "white", fontWeight: 700, cursor: "pointer", fontSize: "0.78rem"
                      }}
                    >
                      Request
                    </button>
                  </div>
                </div>
              )}

              <JoinField style={{ animation: "fade-in-up .55s ease-out both", animationDelay: "120ms" }}>
                <JoinLabel htmlFor="room-id">Room ID</JoinLabel>
                <JoinInput id="room-id" autoComplete="off" placeholder="For example, 1000" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
                <FieldIcon><Hash size={18} /></FieldIcon>
              </JoinField>

              <JoinField style={{ animation: "fade-in-up .55s ease-out both", animationDelay: "200ms" }}>
                <JoinLabel htmlFor="display-name">Display name</JoinLabel>
                <JoinInput id="display-name" autoComplete="name" placeholder="How should people see you?" value={userName} onChange={(e) => setUserName(e.target.value)} />
                <FieldIcon><UserRound size={18} /></FieldIcon>
              </JoinField>

              {features.profiles !== false && (
              <JoinField style={{ animation: "fade-in-up .55s ease-out both", animationDelay: "280ms" }}>
                <JoinLabel>Profile photo <span style={{ opacity: .65, fontWeight: 500 }}>(optional)</span></JoinLabel>
                <AvatarPicker>
                  {userAvatar ? <img src={userAvatar} alt="Selected profile" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,.17)" }} /> : <span style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(255,255,255,.04)", color: "var(--chakra-colors-textSecondary)" }}><UserRound size={17} /></span>}
                  <span style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block", fontWeight: 750, fontSize: ".82rem" }}>{userAvatar ? "Photo selected" : "Add a profile photo"}</span><span style={{ display: "block", marginTop: 1, fontSize: ".7rem", color: "var(--chakra-colors-textSecondary)" }}>Any image · crop and optimise before sharing</span></span>
                  <Upload size={16} aria-hidden="true" color="var(--chakra-colors-brandPrimary)" />
                  <input type="file" accept="image/*" hidden onChange={(e) => openAvatarCrop(e.target.files?.[0])} />
                </AvatarPicker>
              </JoinField>
              )}

              <JoinField style={{ animation: "fade-in-up .55s ease-out both", animationDelay: "360ms" }}>
                <JoinLabel htmlFor="security-code">Security code</JoinLabel>
                <PasswordInputContainer>
                  <PasswordInput
                    id="security-code"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter the room security code"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        if (!roomExists && requireRoomApproval) {
                          submitRoomRequest();
                        } else {
                          await attemptJoin();
                        }
                      }
                    }}
                  />
                  <EyeButton
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide security code" : "Show security code"}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </EyeButton>
                </PasswordInputContainer>
                <FieldIcon><KeyRound size={18} /></FieldIcon>
              </JoinField>

              <JoinButton
                type="button"
                style={{ animation: "fade-in-up .55s ease-out both", animationDelay: "440ms" }}
                onClick={!roomExists && requireRoomApproval ? submitRoomRequest : attemptJoin}
              >
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>{getButtonText()} <ArrowRight size={18} /></span>
              </JoinButton>

              <div style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px 18px",
                color: "var(--chakra-colors-textSecondary)",
                fontSize: ".72rem",
                fontWeight: 600,
                lineHeight: 1.4,
                textAlign: "center"
              }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><LockKeyhole size={12} aria-hidden="true" /> AES-256 GCM</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><UserRound size={12} aria-hidden="true" /> No sign-up required</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Timer size={12} aria-hidden="true" /> Auto-expiring rooms</span>
              </div>

              {roomId.trim() && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 14, animation: "fade-in-up .55s ease-out both", animationDelay: "560ms" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <button
                      type="button"
                      onClick={() => setShowLandingQr(!showLandingQr)}
                      style={{
                        border: 0,
                        background: showLandingQr ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                        color: "var(--chakra-colors-textPrimary)",
                        padding: "6px 14px",
                        borderRadius: 18,
                        fontSize: "0.75rem",
                        fontWeight: 650,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.2s"
                      }}
                    >
                      <span>📷</span> {showLandingQr ? "Hide QR" : "Show QR"}
                    </button>
                    <button
                      type="button"
                      onClick={handleShareRoomLink}
                      style={{
                        border: 0,
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--chakra-colors-textPrimary)",
                        padding: "6px 14px",
                        borderRadius: 18,
                        fontSize: "0.75rem",
                        fontWeight: 650,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.2s"
                      }}
                    >
                      <span>🔗</span> Share Link
                    </button>
                  </div>
                  {showLandingQr && (
                    <div 
                      className="qr-container-el"
                      onClick={(e) => handleShareQr(window.location.href, e.currentTarget)}
                      style={{
                        background: "#ffffff",
                        padding: 16,
                        borderRadius: 16,
                        boxShadow: "0 12px 36px rgba(0,0,0,0.25)",
                        marginTop: 12,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        width: "min(100%, 280px)",
                        margin: "12px auto 0",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        transition: "transform 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                    >
                      <QRCodeSVG value={window.location.href} style={{ width: "100%", height: "auto", maxWidth: "250px", display: "block" }} />
                      <div style={{ fontSize: "0.7rem", color: "#6366f1", marginTop: 8, fontWeight: 700, letterSpacing: "0.02em" }}>✨ Tap to Share or Save</div>
                    </div>
                  )}
                </div>
              )}

            </JoinContainer>
          </LandingGrid>
          <FeatureCatalog />
          {renderAvatarCropDialog()}
          {confirmation && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 23000, background: "rgba(0,0,0,.68)", display: "grid", placeItems: "center", padding: 20 }}><div style={{ width: "min(420px, 100%)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.05)" }}><h3 style={{ margin: "0 0 8px" }}>{confirmation.title}</h3><p style={{ margin: "0 0 22px", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.5 }}>{confirmation.body}</p><div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><button type="button" onClick={() => setConfirmation(null)} style={{ minHeight: 44, padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "inherit", cursor: "pointer" }}>Cancel</button><button type="button" onClick={() => { confirmation.onConfirm(); setConfirmation(null); }} style={{ minHeight: 44, padding: "9px 14px", borderRadius: 10, border: 0, background: "var(--chakra-colors-brandPrimary)", color: "white", fontWeight: 700, cursor: "pointer" }}>{confirmation.confirmLabel}</button></div></div></div>}
        </LandingWrapper>
      </>
    );
  }

  const renderSmartMessage = (text) => {
    // First, split by URLs and process each part
    return text.split(urlRegex).map((part, i) => {
      if (!part.startsWith("http")) {
        return <React.Fragment key={i}>{renderTextContent(part)}</React.Fragment>;
      }

      // Images
      if (/\.(png|jpe?g|gif|webp|svg)$/i.test(part)) {
        return (
          <div key={i} style={{ marginTop: 10 }}>
            <img
              src={part}
              alt={part}
              style={{
                width: "100%",
                maxHeight: 450,
                objectFit: "cover",
                borderRadius: 12
              }}
            />

            {renderLinkActions(part)}
          </div>
        );
      }

      // Videos
      if (/\.(mp4|mov|webm|mkv)$/i.test(part)) {
        return (
          <div key={i} style={{ marginTop: 10 }}>
            <video
              src={part}
              controls
              playsInline
              style={{
                width: "100%",
                borderRadius: 12
              }}
            />

            {renderLinkActions(part)}
          </div>
        );
      }

      // Audio
      if (/\.(mp3|wav|ogg)$/i.test(part)) {
        return (
          <div key={i}>
            <audio controls src={part} />

            {renderLinkActions(part)}
          </div>
        );
      }

      // PDF
      if (/\.pdf$/i.test(part)) {
        return (
          <div key={i}>
            <iframe
              title={i}
              src={part}
              width="100%"
              height="550"
              style={{
                border: 0,
                borderRadius: 12
              }}
            />

            {renderLinkActions(part)}
          </div>
        );
      }

      // Existing embeds — click-to-play poster instead of auto-loading iframe
      const embed = getEmbedData(part);

      if (embed) {
        return (
          <div key={i}>
            <ClickToPlayEmbed embed={embed} aspectRatio={getMediaAspectRatio(embed.src, embed.fileType)} />
            {renderLinkActions(part)}
          </div>
        );
      }

      // Direct media files (.mp4/.jpg/.mp3…) — open in the native viewer, not an iframe
      const DIRECT_MEDIA_RE = /\.(mp4|webm|ogv|mov|m4v|mp3|wav|ogg|m4a|flac|jpg|jpeg|png|gif|webp|avif|bmp)(\?|#|$)/i;
      if (/^https?:\/\//i.test(part) && DIRECT_MEDIA_RE.test(part)) {
        const fileName = decodeURIComponent((part.split("/").pop() || "media").split("?")[0]);
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setViewer({ url: part, name: fileName })}
              style={{
                width: "100%", minHeight: 64, display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                background: "linear-gradient(135deg, #141625 0%, #1c1f33 100%)",
                border: "1px solid rgba(255,255,255,0.07)", color: "#fff", fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>🎬</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
                <span style={{ display: "block", fontSize: "0.7rem", opacity: 0.55, marginTop: 2 }}>Tap to view in full screen</span>
              </span>
              <span style={{ fontSize: "1rem", opacity: 0.7 }}>⛶</span>
            </button>
            {renderLinkActions(part)}
          </div>
        );
      }

      // Generic link card with rich preview
      if (features.linkPreviews === false) {
        return (
          <span key={i}>
            <a href={part} target="_blank" rel="noopener noreferrer" style={{ color: "var(--chakra-colors-brandPrimary)", wordBreak: "break-all" }}>{part}</a>
            {renderLinkActions(part)}
          </span>
        );
      }
      return <LinkPreviewCard key={i} url={part} renderLinkActions={renderLinkActions} />;
    });
  };

  const escapeHtml = (str) => {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const formatTextHtml = (rawText) => {
    if (!rawText) return "";

    // 1. Extract triple-backtick code blocks first to protect them from other formatting
    const codeBlocks = [];
    let textWithPlaceholders = rawText.replace(/```(\w*)\r?\n?([\s\S]+?)\r?\n?```/g, (match, lang, code) => {
      const placeholder = `QCHEPRABAICB${codeBlocks.length}ZQ`;
      codeBlocks.push({ placeholder, lang: lang ? lang.trim().toLowerCase() : "", code });
      return placeholder;
    });

    // 1b. Auto-detect pasted code that isn't wrapped in backticks
    // Checks: multi-line text with code-like patterns (indentation, braces, semicolons, arrows, keywords)
    if (codeBlocks.length === 0 && textWithPlaceholders.includes('\n')) {
      const lines = textWithPlaceholders.split('\n');
      // Only auto-detect if: 2+ lines AND enough code-like lines
      if (lines.length >= 2) {
        let codeLineCount = 0;
        for (const line of lines) {
          if (/^\s{2,}\S/.test(line) || /[{}();]\s*$/.test(line) || /=>/.test(line) || /^\s*(import|export|const|let|var|function|class|def |if\s*\(|else|for\s*\(|while\s*\(|return |public |private |protected |static |void |int |String |package |from |require\()/.test(line)) {
            codeLineCount++;
          }
        }
        // If more than 40% of lines look like code, treat as a code block
        if (codeLineCount / lines.length > 0.4) {
          const placeholder = `QCHEPRABAICB${codeBlocks.length}ZQ`;
          codeBlocks.push({ placeholder, lang: "", code: textWithPlaceholders });
          textWithPlaceholders = placeholder;
        }
      }
    }

    // 2. Escape HTML for the rest of the text
    let escaped = escapeHtml(textWithPlaceholders);

    // 3. Apply standard search query highlighting and markdown formatting to the escaped text
    if (searchQuery && searchQuery.trim()) {
      try {
        const regex = new RegExp(`(${searchQuery.replace(new RegExp('[-/\\\\^$*+?.()|[\\]{}]', 'g'), '\\$&')})`, "gi");
        escaped = escaped.replace(regex, `<mark style="background: #ffa500; color: #000; padding: 0 2px; border-radius: 2px; font-weight: bold">$1</mark>`);
      } catch (e) { }
    }

    escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<strong>$1</strong>");
    escaped = escaped.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");
    escaped = escaped.replace(/~(.+?)~/g, "<del>$1</del>");
    escaped = escaped.replace(/`([^`]+)`/g, (match, code) => {
      const escapedInline = encodeURIComponent(code);
      const copyHelper = INLINE_CLIPBOARD_FALLBACK;
      const copyInlineJs = `${copyHelper}(decodeURIComponent('${escapedInline}')); var btn = this.querySelector('.inline-copy-btn'); if(btn){ btn.textContent = '✓'; btn.style.color = '#00bfa5'; setTimeout(function(){ btn.textContent = '📋'; btn.style.color = 'rgba(255,255,255,0.35)'; }, 1500); }`;
      return `<span onclick="${copyInlineJs}" style="background:rgba(255,255,255,.04);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:.85em;cursor:pointer;position:relative;display:inline-flex;align-items:center;gap:4px;transition:background .2s" onmouseover="this.style.background='rgba(255,255,255,.14)'" onmouseout="this.style.background='rgba(255,255,255,.04)'"><code style="font-family:inherit">${code}</code><span class="inline-copy-btn" style="font-size:.7em;color:rgba(255,255,255,0.35);flex-shrink:0">📋</span></span>`;
    });

    const uniqueNames = new Set();
    if (userName) uniqueNames.add(userName);
    if (onlineUsers) {
      onlineUsers.forEach(u => {
        if (u.name) uniqueNames.add(u.name);
      });
    }
    if (participantProfiles) {
      Object.values(participantProfiles).forEach(p => {
        if (p.name) uniqueNames.add(p.name);
      });
    }
    const sortedNames = Array.from(uniqueNames).sort((a, b) => b.length - a.length);
    const escapedNames = sortedNames.map(name => name.replace(new RegExp('[-/\\\\^$*+?.()|[\\]{}]', 'g'), '\\$&'));
    const pattern = escapedNames.length > 0
      ? `@(${escapedNames.join("|")}|\\w+)`
      : `@(\\w+)`;
    const mentionRegex = new RegExp(pattern, "gi");

    escaped = escaped.replace(mentionRegex, (match, mentioned) => {
      const isMe = mentioned.toLowerCase() === userName?.toLowerCase();
      const style = isMe
        ? "background:rgba(255, 63, 94, 0.2);color:var(--chakra-colors-brandPrimary);font-weight:700;padding:1px 5px;border-radius:4px"
        : "background:rgba(100, 181, 246, 0.15);color:#64b5f6;font-weight:700;padding:1px 5px;border-radius:4px";
      return `<span style="${style}">@${mentioned}</span>`;
    });

    // 4. Re-insert the protected code blocks with beautiful styling
    codeBlocks.forEach((block) => {
      const escapedCodeForHtml = escapeHtml(block.code);
      const regId =
        typeof window !== "undefined" && typeof window.__cheprabaiRegisterCode === "function"
          ? window.__cheprabaiRegisterCode(block.code, block.lang || "")
          : null;
      const copyCodeJs = `window.__cheprabaiCopyCodeById && window.__cheprabaiCopyCodeById('${regId}',this)`;
      const expandJs = `window.__cheprabaiOpenCodeById && window.__cheprabaiOpenCodeById('${regId}')`;

      // HTML blocks get a live rendered preview with a UI/Code switch —
      // they're documents, not just text.
      const isHtmlBlock =
        block.lang === "html" ||
        /^\s*<!doctype\s+html/i.test(block.code) ||
        /^\s*<html[\s>]/i.test(block.code);

      const segBtnBase =
        "cursor:pointer; font-size:0.72rem; font-weight:700; padding:4px 12px; border-radius:999px; outline:none; transition:all 0.2s; border:1px solid transparent;";
      const uiOn = `background:rgba(129,140,248,.25); color:#a5b4fc; ${segBtnBase}`;
      const segOff = `background:transparent; color:rgba(255,255,255,0.55); ${segBtnBase} border-color:rgba(255,255,255,0.07);`;
      const showPaneJs = (pane) =>
        `const w=this.closest('.cbx'); w.querySelectorAll('.cbx-seg').forEach(b=>{b.style.background='transparent';b.style.color='rgba(255,255,255,.55)';b.style.borderColor='rgba(255,255,255,.07)'}); this.style.background='rgba(129,140,248,.25)'; this.style.color='#a5b4fc'; this.style.borderColor='transparent'; w.querySelector('.cbx-pv').style.display='${pane === "pv" ? "block" : "none"}'; w.querySelector('.cbx-cd').style.display='${pane === "cd" ? "block" : "none"}'`;

      const codePre = `<pre class="cbx-cd" style="display:${isHtmlBlock ? "none" : "block"}; margin:0; padding:14px; overflow:auto; max-height:min(46vh, 380px); line-height:1.55; color:#c9d1d9; background:#0d0e15; font-family:inherit; box-sizing:border-box; -webkit-overflow-scrolling:touch;"><code style="font-family:inherit; white-space:pre; word-break:normal; word-wrap:normal;">${escapedCodeForHtml}</code></pre>`;

      const htmlPreview = isHtmlBlock
        ? `<div class="cbx-pv" style="display:block; height:min(52vh, 420px); background:#fff;"><iframe class="html-live-preview" sandbox="allow-scripts" srcdoc="${escapedCodeForHtml}" title="HTML preview" style="width:100%; height:100%; border:0; display:block; background:#fff;"></iframe></div>`
        : "";

      const segButtons = isHtmlBlock
        ? `<button class="cbx-seg" onclick="${showPaneJs("pv")}" style="${uiOn}">UI</button>
       <button class="cbx-seg" onclick="${showPaneJs("cd")}" style="${segOff}">Code</button>
       <span style="width:6px"></span>`
        : "";

      const blockHtml = `
<div class="cbx" style="background:#0b0c10; border:1px solid rgba(255,255,255,0.07); border-radius:12px; margin:12px 0; overflow:hidden; font-family:'SF Mono','Fira Code',Consolas,monospace; font-size:0.85rem; box-shadow:0 8px 24px rgba(0,0,0,0.3); max-width: 100%; text-align: left; box-sizing: border-box;">
  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.055); padding:8px 14px; border-bottom:1px solid rgba(255,255,255,0.055); box-sizing: border-box;">
    <span style="font-size:0.72rem; color:var(--chakra-colors-brandPrimary); text-transform:uppercase; font-weight:bold; letter-spacing:0.05em;">💻 ${escapeHtml(block.lang) || 'code'}</span>
    <span style="display:flex; align-items:center; gap:6px;">
    ${segButtons}
    <button onclick="${expandJs}" style="background:rgba(255,255,255,0.055); border:1px solid rgba(255,255,255,0.07); color:rgba(255,255,255,0.55); cursor:pointer; font-size:0.73rem; font-weight:600; padding:4px 10px; border-radius:6px; outline:none; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.055)';this.style.color='rgba(255,255,255,0.55)'">⤢ Expand</button>
    <button onclick="${copyCodeJs}" style="background:rgba(255,255,255,0.055); border:1px solid rgba(255,255,255,0.07); color:rgba(255,255,255,0.55); cursor:pointer; font-size:0.73rem; font-weight:600; padding:4px 10px; border-radius:6px; outline:none; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff';this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.055)';this.style.color='rgba(255,255,255,0.55)';this.style.borderColor='rgba(255,255,255,0.07)'">📋 Copy</button>
    </span>
  </div>
  ${htmlPreview}
  ${codePre}
</div>`.trim();

      escaped = escaped.replace(block.placeholder, blockHtml);
    });

    return escaped;
  };

  const renderTextContent = (text) => {
    const formattedHtml = formatTextHtml(text);
    return <span dangerouslySetInnerHTML={{ __html: formattedHtml }} />;
  };

  const renderLinkActions = (url) => (
    <div className="chakra-link-actions">
      <button
        onClick={() => safeCopyText(url).then(ok => ok ? toast.success("📋 Link copied!") : toast.error("Failed to copy link"))}
        style={actionBtnStyle}
      >
        📋 Copy
      </button>

      <button
        onClick={() => setViewer(url)}
        style={actionBtnStyle}
      >
        ↗ Open
      </button>
    </div>
  );

  const actionBtnStyle = {
    padding: "3px 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.05)",
    background: "rgba(255,255,255,.05)",
    color: "rgba(255,255,255,.82)",
    cursor: "pointer",
    fontSize: ".72rem",
    fontWeight: 600,
    lineHeight: 1.5
  };


  return (
    <>
      <style>{`
        @media print {
          body { display: none !important; }
        }
      `}</style>

      {showDiagnostics && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999998,
          background: "rgba(4,5,10,.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div style={{
            width: "min(480px, 100%)", background: "#0b0c10", border: "1px solid rgba(123, 97, 255, 0.25)",
            borderRadius: 18, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.6)", color: "#fff"
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8, color: "#a5b4fc" }}>
              📊 Platform Server Diagnostics
            </h3>
            {diagnosticsError ? (
              <div style={{ color: "#ff4757", fontSize: "0.82rem", margin: "16px 0" }}>{diagnosticsError}</div>
            ) : diagnosticsData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: "0.8rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.05)", paddingBottom: 6 }}>
                  <span style={{ opacity: 0.7 }}>Server Uptime:</span>
                  <span style={{ fontWeight: 700 }}>{Math.round(diagnosticsData.uptime)}s</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.05)", paddingBottom: 6 }}>
                  <span style={{ opacity: 0.7 }}>Total Connections:</span>
                  <span style={{ fontWeight: 700, color: "#818cf8" }}>{diagnosticsData.totalSockets}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.05)", paddingBottom: 6 }}>
                  <span style={{ opacity: 0.7 }}>Active Rooms:</span>
                  <span style={{ fontWeight: 700 }}>{diagnosticsData.activeRoomsCount}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.05)", paddingBottom: 6 }}>
                  <span style={{ opacity: 0.7 }}>Active Video Calls:</span>
                  <span style={{ fontWeight: 700, color: "#10b981" }}>{diagnosticsData.activeCallCount}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ opacity: 0.7, fontSize: "0.74rem" }}>Memory Allocation:</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, background: "rgba(255,255,255,.02)", padding: 10, borderRadius: 8, textAlign: "center", border: "1px solid rgba(255,255,255,.04)" }}>
                    <div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>RSS</div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{diagnosticsData.memory?.rss}MB</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>Heap Used</div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#10b981" }}>{diagnosticsData.memory?.heapUsed}MB</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>Heap Total</div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{diagnosticsData.memory?.heapTotal}MB</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 20, opacity: 0.6 }}>Loading metrics...</div>
            )}
            <button
              type="button"
              onClick={() => setShowDiagnostics(false)}
              style={{
                width: "100%", padding: "10px 0", marginTop: 24, borderRadius: 10,
                background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)",
                color: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isScreenProtected && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999999,
          background: "#0a0b10", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 15,
          color: "#8f95b2", fontFamily: "inherit"
        }}>
          <span style={{ fontSize: "2rem" }}>🔒</span>
          <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.05em" }}>Screen Capture Protected</span>
          <span style={{ fontSize: "0.78rem", opacity: 0.6 }}>Recording and screenshotting is disabled for security.</span>
        </div>
      )}

      {codeViewer && (
        <div
          onClick={() => setCodeViewer(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 999998,
            background: "rgba(4,5,10,.78)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 3vw, 40px)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1100px, 100%)", height: "min(86vh, 800px)",
              display: "flex", flexDirection: "column",
              background: "#0b0c10", border: "1px solid rgba(255,255,255,.1)", borderRadius: 18,
              overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,.6)",
              fontFamily: "'SF Mono','Fira Code',Consolas,monospace"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,.055)", borderBottom: "1px solid rgba(255,255,255,.07)", flexWrap: "wrap" }}>
              <span style={{ fontSize: ".74rem", color: "#818cf8", textTransform: "uppercase", fontWeight: 700, letterSpacing: ".05em" }}>💻 {codeViewer.lang || "code"}</span>
              {codeViewer.html && (
                <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,.35)", padding: 3, borderRadius: 999 }}>
                  <button
                    onClick={() => setCodePane("ui")}
                    style={{
                      border: codePane === "ui" ? "1px solid transparent" : "1px solid rgba(255,255,255,.08)",
                      background: codePane === "ui" ? "rgba(129,140,248,.3)" : "transparent",
                      color: codePane === "ui" ? "#c7d2fe" : "rgba(255,255,255,.6)",
                      cursor: "pointer", fontSize: ".72rem", fontWeight: 800,
                      padding: "4px 14px", borderRadius: 999
                    }}
                  >
                    UI
                  </button>
                  <button
                    onClick={() => setCodePane("code")}
                    style={{
                      border: codePane === "code" ? "1px solid transparent" : "1px solid rgba(255,255,255,.08)",
                      background: codePane === "code" ? "rgba(129,140,248,.3)" : "transparent",
                      color: codePane === "code" ? "#c7d2fe" : "rgba(255,255,255,.6)",
                      cursor: "pointer", fontSize: ".72rem", fontWeight: 800,
                      padding: "4px 14px", borderRadius: 999
                    }}
                  >
                    Code
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(codeViewer.code)
                      .then(() => toast.success("📋 All code copied!"))
                      .catch(() => toast.error("Could not copy code"));
                  } else if (window.__cheprabaiCopyCodeById) {
                    // Reuse the registry path so the fallback also confirms
                    const id = window.__cheprabaiRegisterCode(codeViewer.code, "");
                    window.__cheprabaiCopyCodeById(id, null);
                  }
                }}
                style={{ marginLeft: "auto", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#c9d1d9", cursor: "pointer", fontSize: ".74rem", fontWeight: 600, padding: "5px 12px", borderRadius: 7 }}
              >
                📋 Copy all
              </button>
              <button
                onClick={() => setCodeViewer(null)}
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#c9d1d9", cursor: "pointer", fontSize: ".74rem", fontWeight: 700, padding: "5px 12px", borderRadius: 7 }}
              >
                ✕ Close
              </button>
            </div>
            {codeViewer.html && codePane === "ui" ? (
              <iframe
                srcDoc={codeViewer.code}
                title="HTML preview"
                sandbox="allow-scripts"
                style={{ flex: 1, minHeight: 0, width: "100%", border: 0, background: "#fff", display: "block" }}
              />
            ) : (
              <pre style={{ flex: 1, minHeight: 0, margin: 0, padding: 18, overflow: "auto", lineHeight: 1.6, color: "#c9d1d9", background: "#0d0e15", fontSize: ".88rem", WebkitOverflowScrolling: "touch" }}>
                <code style={{ whiteSpace: "pre" }}>{codeViewer.code}</code>
              </pre>
            )}
          </div>
        </div>
      )}
      <ToastContainer position="top-center" autoClose={2600} limit={3} theme="dark" newestOnTop closeOnClick pauseOnHover={false} icon={false} />
      {!ownerToken && !isStealthMode && (
        <style>{`
          @media print {
            body {
              display: none !important;
            }
          }
        `}</style>
      )}
      {screenLocked && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          zIndex: 999999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "20px"
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "15px" }}>🔒</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "10px" }}>Protected Content</h2>
          <p style={{ opacity: 0.7, maxWidth: "350px", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Screenshots, video recordings, and background tab viewing are disabled for security.
          </p>
        </div>
      )}
      {shoulderSurfingProtection && isWindowBlurred && joined && (
        <div
          onClick={() => setIsWindowBlurred(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 21999,
            background: "rgba(8, 9, 13, 0.6)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            cursor: "pointer",
            padding: 20,
            color: "#fff",
            fontFamily: "inherit"
          }}
        >
          <div style={{ fontSize: "2.8rem", marginBottom: "12px" }}>👁️‍🗨️</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Stealth Mode Active</h3>
          <p style={{ opacity: 0.6, maxWidth: "280px", fontSize: "0.8rem", lineHeight: 1.45, margin: 0 }}>
            Shoulder-surfing protection is on. Click anywhere to reveal your chat.
          </p>
        </div>
      )}
      <ChatContainer
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={roomBackground ? { backgroundImage: `linear-gradient(rgba(8,9,13,.78), rgba(8,9,13,.88)), url(${roomBackground})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: isMobile ? "scroll" : "fixed" } : undefined}
      >
        {isStealthMode && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 14px",
            background: "rgba(123, 97, 255, 0.12)",
            borderBottom: "1px solid rgba(123, 97, 255, 0.25)",
            color: "#c9beff",
            fontSize: "0.78rem",
            fontWeight: 700,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FaEyeSlash size={12} aria-hidden="true" />
              Stealth observer — invisible to other participants
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDiagnostics(true);
                fetchAdminDiagnostics();
              }}
              style={{
                background: "rgba(123, 97, 255, 0.2)",
                border: "1px solid rgba(123, 97, 255, 0.4)",
                color: "#c9beff",
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: "0.72rem",
                fontWeight: 700
              }}
            >
              📊 Server Diagnostics
            </button>
          </div>
        )}
        <Header>
          <Avatar src={userAvatar || image} alt={userAvatar ? `${userName || "User"} avatar` : "Logo"} />
          <RoomInfoTrigger
            type="button"
            aria-label={showRoomInfo ? "Hide room insights" : "Show room insights"}
            aria-expanded={showRoomInfo}
            aria-controls="room-insights-panel"
            onClick={() => setShowRoomInfo((isOpen) => !isOpen)}
          >
            <div style={{ fontWeight: "bold", fontSize: "clamp(1rem, 2.5vw, 1.1rem)", display: "flex", alignItems: "center", gap: 4, minWidth: 0 }} >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "clamp(60px, 25vw, 300px)" }}>{roomId}</span>
              <span aria-hidden="true" style={{ fontSize: "0.9rem", opacity: 0.8, flexShrink: 0, lineHeight: 1 }} onClick={() => setShowRoomInfo((isOpen) => !isOpen)}>
                {showRoomInfo ? "▲" : "▼"}
              </span>
            </div>
            <div style={{ fontSize: "clamp(0.65rem, 1.8vw, 0.8rem)", color: isConnected ? "#aaa" : "#ff4757", display: "flex", alignItems: "center", gap: 5, justifyContent: isMobile ? "center" : "flex-start" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: isConnected ? "#2ed573" : "#ff4757", display: "inline-block" }} />
              {isConnected ? `${onlineUsers.length} online` : "Connecting…"}
            </div>

            {showRoomInfo && createPortal(
              <>
                <RoomInfoBackdrop type="button" aria-label="Close room insights" onClick={(e) => { e.stopPropagation(); setShowRoomInfo(false); }} />
                <RoomInfoDropdown id="room-insights-panel" role="dialog" aria-label="Room insights" onClick={(e) => e.stopPropagation()}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "#888" }}>Room Insights</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span>Active Session</span>
                      <span style={{ color: (showWhiteboard || showMeeting) ? "#ff4757" : "#4CAF50" }}>
                        {(showWhiteboard || showMeeting) ? "● Collaborative" : "● Idle"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span>Network Latency</span>
                      <span style={{ color: latency < 100 ? "#4CAF50" : "#FFC107" }}>
                        {latency}ms
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span>Security</span>
                      <span style={{ color: "#2196F3" }}>AES-256 GCM</span>
                    </div>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
                      <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 8 }}>Participants ({onlineUsers.length})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                        {onlineUsers.map(u => {
                          const isMe = u.id === socketRef.current?.id;
                          return (
                            <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.055)", padding: "6px 12px", borderRadius: 10, fontSize: "0.75rem", border: "1px solid rgba(255,255,255,0.08)" }}>
                              <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: isMe ? "#10b981" : "#3b82f6" }} />
                                {u.name} {isMe && <span style={{ opacity: 0.5, fontSize: "0.65rem" }}>(You)</span>}
                              </span>
                              {ownerToken && !isMe && (
                                <button
                                  type="button"
                                  onClick={() => handleKickFromRoom(u.id, u.name)}
                                  style={{
                                    border: 0,
                                    background: "var(--chakra-colors-dangerBg)",
                                    color: "var(--chakra-colors-danger)",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"}
                                  onMouseLeave={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {features.profiles !== false && (
                      <label onClick={(e) => e.stopPropagation()} style={{ display: "flex", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, cursor: "pointer", fontSize: ".8rem", fontWeight: 700, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.04)" }}>Change avatar<input type="file" accept="image/*" hidden onChange={(e) => openAvatarCrop(e.target.files?.[0])} /></label>
                      )}
                      <label onClick={(e) => e.stopPropagation()} style={{ display: "flex", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, cursor: backgroundLocked && !ownerToken ? "not-allowed" : "pointer", opacity: backgroundLocked && !ownerToken ? .45 : 1, fontSize: ".8rem", fontWeight: 700, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.04)" }}>{backgroundLocked && !ownerToken ? "Background managed by owner" : "Change chat background"}<input type="file" disabled={backgroundLocked && !ownerToken} accept="image/*" hidden onChange={(e) => requestBackgroundChange(e.target.files?.[0])} /></label>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowDropdownQr(!showDropdownQr); }}
                        style={{
                          display: "flex", minHeight: 44, alignItems: "center", justifyContent: "center",
                          borderRadius: 10, cursor: "pointer", fontSize: ".8rem", fontWeight: 700,
                          background: showDropdownQr ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,.03)",
                          border: `1px solid ${showDropdownQr ? "rgba(129,140,248,0.3)" : "rgba(255,255,255,.04)"}`,
                          color: "var(--chakra-colors-textPrimary)", width: "100%", gap: 8, outline: "none"
                        }}
                      >
                        📷 {showDropdownQr ? "Hide QR Code Invite" : "Show QR Code Invite"}
                      </button>
                      {showDropdownQr && (
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 10,
                          marginTop: 8,
                          background: "rgba(255,255,255,0.02)",
                          padding: 16,
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,0.04)",
                          boxSizing: "border-box"
                        }} onClick={(e) => e.stopPropagation()}>
                          <div 
                            className="qr-container-el"
                            onClick={(e) => handleShareQr(window.location.href, e.currentTarget)}
                            style={{
                              background: "#ffffff",
                              padding: 16,
                              borderRadius: 16,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              width: "min(100%, 280px)",
                              boxSizing: "border-box",
                              cursor: "pointer",
                              transition: "transform 0.2s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                          >
                            <QRCodeSVG value={window.location.href} style={{ width: "100%", height: "auto", maxWidth: "250px", display: "block" }} />
                            <div style={{ fontSize: "0.7rem", color: "#6366f1", marginTop: 8, fontWeight: 700, letterSpacing: "0.02em" }}>✨ Tap to Share or Save</div>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--chakra-colors-textSecondary)", textAlign: "center", fontWeight: 500 }}>Scan this code to join this room instantly</div>
                        </div>
                      )}

                      {/* ── Settings ── */}
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#7a7f95", marginBottom: 8 }}>Settings</div>
                        <div
                          role="switch"
                          aria-checked={swipeReplyEnabled}
                          tabIndex={0}
                          onClick={toggleSwipeReply}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSwipeReply(); } }}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderRadius: 12,
                            background: swipeReplyEnabled ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.07)",
                            border: `1px solid ${swipeReplyEnabled ? "rgba(129,140,248,0.35)" : "rgba(255,255,255,0.07)"}`,
                            cursor: "pointer", transition: "all 0.2s ease",
                            userSelect: "none", WebkitUserSelect: "none",
                          }}
                        >
                          <span style={{ fontSize: "1rem", lineHeight: 1 }}>↔️</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 700 }}>Swipe to reply</span>
                            <span style={{ display: "block", fontSize: "0.68rem", opacity: 0.55, marginTop: 2 }}>Drag a message sideways to answer it</span>
                          </span>
                          <span style={{
                            width: 42, height: 24, borderRadius: 999, flexShrink: 0,
                            position: "relative",
                            background: swipeReplyEnabled ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.14)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            transition: "background 0.22s ease",
                          }}>
                            <span style={{
                              position: "absolute", top: 2, left: swipeReplyEnabled ? 20 : 2,
                              width: 18, height: 18, borderRadius: "50%",
                              background: "#fff",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                              transition: "left 0.22s cubic-bezier(0.16,1,0.3,1)",
                            }} />
                          </span>
                        </div>

                        <div
                          role="switch"
                          aria-checked={muteSounds}
                          tabIndex={0}
                          onClick={toggleMuteSounds}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleMuteSounds(); } }}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderRadius: 12,
                            background: muteSounds ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.07)",
                            border: `1px solid ${muteSounds ? "rgba(129,140,248,0.35)" : "rgba(255,255,255,0.07)"}`,
                            cursor: "pointer", transition: "all 0.2s ease",
                            userSelect: "none", WebkitUserSelect: "none",
                            marginTop: 8
                          }}
                        >
                          <span style={{ fontSize: "1rem", lineHeight: 1 }}>🔔</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 700 }}>Mute sounds</span>
                            <span style={{ display: "block", fontSize: "0.68rem", opacity: 0.55, marginTop: 2 }}>Mute incoming message sound alerts</span>
                          </span>
                          <span style={{
                            width: 42, height: 24, borderRadius: 999, flexShrink: 0,
                            position: "relative",
                            background: muteSounds ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.14)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            transition: "background 0.22s ease",
                          }}>
                            <span style={{
                              position: "absolute", top: 2, left: muteSounds ? 20 : 2,
                              width: 18, height: 18, borderRadius: "50%",
                              background: "#fff",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                              transition: "left 0.22s cubic-bezier(0.16,1,0.3,1)",
                            }} />
                          </span>
                        </div>

                        {/* Notification sound picker — choose which sound plays for
                            incoming messages (silent option included). */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px", borderRadius: 12,
                          background: "rgba(255,255,255,0.07)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          marginTop: 8,
                        }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 700 }}>Notification sound</span>
                          <button
                            type="button"
                            onClick={() => playNotificationSound(soundChoice, notificationSound)}
                            title="Preview this sound"
                            style={{
                              marginRight: 8, padding: "5px 10px", borderRadius: 8,
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: "rgba(255,255,255,0.06)",
                              color: "#fff", fontSize: "0.7rem", fontWeight: 700,
                              cursor: "pointer", lineHeight: 1
                            }}
                          >
                            ▶ Test
                          </button>
                          <select
                            value={soundChoice}
                            onChange={(e) => setSoundChoice(e.target.value)}
                            title="Choose the sound played for incoming messages"
                            style={{
                              background: "rgba(0,0,0,0.35)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 8,
                              padding: "5px 8px",
                              color: "#fff",
                              fontSize: "0.76rem",
                              outline: "none",
                              cursor: "pointer",
                              maxWidth: 130
                            }}
                          >
                            {SOUND_CHOICES.map((s) => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                        </div>

                        <div
                          role="switch"
                          aria-checked={shoulderSurfingProtection}
                          tabIndex={0}
                          onClick={toggleShoulderSurfing}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleShoulderSurfing(); } }}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderRadius: 12,
                            background: shoulderSurfingProtection ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.07)",
                            border: `1px solid ${shoulderSurfingProtection ? "rgba(129,140,248,0.35)" : "rgba(255,255,255,0.07)"}`,
                            cursor: "pointer", transition: "all 0.2s ease",
                            userSelect: "none", WebkitUserSelect: "none",
                            marginTop: 8
                          }}
                        >
                          <span style={{ fontSize: "1rem", lineHeight: 1 }}>👁️‍🗨️</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 700 }}>Shoulder-surfing blur</span>
                            <span style={{ display: "block", fontSize: "0.68rem", opacity: 0.55, marginTop: 2 }}>Blur chat feed when browser window is inactive</span>
                          </span>
                          <span style={{
                            width: 42, height: 24, borderRadius: 999, flexShrink: 0,
                            position: "relative",
                            background: shoulderSurfingProtection ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.14)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            transition: "background 0.22s ease",
                          }}>
                            <span style={{
                              position: "absolute", top: 2, left: shoulderSurfingProtection ? 20 : 2,
                              width: 18, height: 18, borderRadius: "50%",
                              background: "#fff",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                              transition: "left 0.22s cubic-bezier(0.16,1,0.3,1)",
                            }} />
                          </span>
                        </div>
                      </div>

                      {/* ── Owner Access Control ── */}
                      {ownerToken && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10, marginTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#f59e0b", marginBottom: 2 }}>Owner Controls</div>

                          <div>
                            <div style={{ fontSize: "0.75rem", fontWeight: 700, marginBottom: 4 }}>IP Whitelist Restrictions</div>
                            <div style={{ fontSize: "0.65rem", color: "var(--chakra-colors-textSecondary)", marginBottom: 6, lineHeight: 1.35 }}>
                              Enter comma-separated IPs/patterns (e.g. 192.168.1.*). Leave blank to allow any IP.
                            </div>
                            <input
                              type="text"
                              value={allowedIpsText}
                              onChange={(e) => setAllowedIpsText(e.target.value)}
                              onBlur={() => {
                                const ips = allowedIpsText.split(",").map(ip => ip.trim()).filter(Boolean);
                                socketRef.current?.emit("updateRoomIpRestrictions", { allowedIps: ips }, (res) => {
                                  if (res?.success) toast.success("IP restrictions updated!");
                                  else toast.error(res?.error || "Failed to update IP restrictions");
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="e.g. 127.0.0.1, 192.168.1.*"
                              style={{
                                width: "100%", padding: "8px 10px", borderRadius: 8,
                                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                                color: "var(--chakra-colors-textPrimary)", fontSize: "0.75rem",
                                outline: "none", boxSizing: "border-box"
                              }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              socketRef.current?.emit("getRoomAuditLogs", (res) => {
                                if (res?.success) {
                                  setAuditLogs(res.auditLogs);
                                  setShowAuditLogs(true);
                                } else {
                                  toast.error(res?.error || "Failed to load audit logs");
                                }
                              });
                            }}
                            style={{
                              width: "100%", padding: "10px 12px", borderRadius: 10,
                              background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.35)",
                              color: "#f59e0b", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(245, 158, 11, 0.2)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(245, 158, 11, 0.1)"}
                          >
                            📜 View Room Audit Logs ({auditLogs.length})
                          </button>
                        </div>
                      )}

                      {(userAvatar || roomBackground) && <button type="button" onClick={() => setConfirmation({ title: "Reset your appearance?", body: ownerToken ? "Your profile photo and the owner-managed room background will be removed." : "Your profile photo and local chat background will be removed from this device.", confirmLabel: "Reset appearance", onConfirm: () => { localStorage.removeItem("cheprabai:user-avatar"); localStorage.removeItem(`cheprabai:room-background:${roomId}`); setUserAvatar(""); setRoomBackground(""); socketRef.current?.emit("updateProfile", { avatar: "" }); if (ownerToken) socketRef.current?.emit("setRoomBackground", { background: "", scope: "everyone" }); toast.success("Appearance reset."); } })} style={{ minHeight: 44, borderRadius: 10, border: "1px solid rgba(255,107,107,.35)", color: "#ff9aa2", background: "rgba(255,71,87,.08)", cursor: "pointer", fontSize: ".8rem", fontWeight: 700 }}>Reset appearance</button>}
                      <button
                        onClick={exportChat}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          width: "100%", padding: "8px 12px", borderRadius: 10,
                          background: "rgba(33, 150, 243, 0.1)", border: "1px solid rgba(33, 150, 243, 0.3)",
                          color: "#2196F3", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                          transition: "all 0.2s"
                        }}
                      >
                        <FaDownload /> Export Chat History
                      </button>
                      <button
                        onClick={importChat}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          width: "100%", padding: "8px 12px", borderRadius: 10,
                          background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)",
                          color: "#10B981", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                          transition: "all 0.2s"
                        }}
                      >
                        <FaUpload /> Import Chat Backup
                      </button>
                      <button
                        type="button"
                        onClick={handleShareRoomLink}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          width: "100%", padding: "8px 12px", borderRadius: 10,
                          background: "rgba(76, 201, 240, 0.08)", border: "1px solid rgba(76, 201, 240, 0.25)",
                          color: "#4cc9f0", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                          transition: "all 0.2s"
                        }}
                      >
                        <Copy size={14} aria-hidden="true" /> Share Room Invite
                      </button>

                      {/* ── Content Moderation Filter (Controlled by the Owner) ── */}
                      {ownerToken && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10, marginTop: 4 }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#7a7f95", marginBottom: 8 }}>Content Filter</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--chakra-colors-textSecondary)", marginBottom: 8, lineHeight: 1.4 }}>
                            Add comma-separated words to filter. Banned words will be automatically stripped from members' messages.
                          </div>
                          <textarea
                            key={bannedWords.join(",")}
                            defaultValue={bannedWords.join(", ")}
                            placeholder="e.g. spam, bad, test"
                            onBlur={(e) => {
                              const words = e.target.value.split(",").map(w => w.trim().toLowerCase()).filter(Boolean);
                              socketRef.current?.emit("updateRoomContentFilter", {
                                roomId,
                                token: ownerToken,
                                bannedWords: words
                              }, (res) => {
                                if (res?.success) {
                                  setBannedWords(res.bannedWords || []);
                                  toast.success("Content filter updated!");
                                } else {
                                  toast.error(res?.error || "Failed to update content filter");
                                }
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: "100%", minHeight: 50, padding: "8px 10px", borderRadius: 8,
                              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                              color: "var(--chakra-colors-textPrimary)", fontSize: "0.75rem",
                              resize: "vertical", outline: "none", boxSizing: "border-box",
                              fontFamily: "inherit"
                            }}
                          />
                        </div>
                      )}
                      {/* <Link
                        to="/admin"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          width: "100%", padding: "8px 12px", borderRadius: 10,
                          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.07)",
                          color: "var(--chakra-colors-textSecondary)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                          textDecoration: "none", boxSizing: "border-box", transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)"; e.currentTarget.style.color = "var(--chakra-colors-textPrimary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "var(--chakra-colors-textSecondary)"; }}
                      >
                        <ShieldCheck size={14} aria-hidden="true" /> Admin Panel
                      </Link> */}
                      {ownerToken && (
                        <button
                          type="button"
                          onClick={() => { setShowRoomInfo(false); handleDestroyRoom(); }}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            width: "100%", padding: "10px 12px", borderRadius: 10,
                            background: "rgba(255, 71, 87, 0.15)", border: "1px solid rgba(255, 71, 87, 0.5)",
                            color: "#ff4757", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                            transition: "all 0.2s", marginTop: 4
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,71,87,0.28)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,71,87,0.15)"; }}
                        >
                          🗑️ Delete Room
                        </button>
                      )}
                    </div>
                  </div>
                </RoomInfoDropdown>
              </>,
              document.body
            )}
          </RoomInfoTrigger>

          <RoomActions>
            {features.themes !== false && <ThemeSwitcher />}
            {(showWhiteboard || showMeeting) && (
              <LiveBadge>
                <div style={{ width: 6, height: 6, background: "white", borderRadius: "50%" }} />
                LIVE
              </LiveBadge>
            )}

            {features.voiceCalls !== false && (
              <ActionButton onClick={() => {
                if (!socketRef.current || !socketRef.current.connected) {
                  toast.error("Connecting to server. Please wait a moment before starting the call.");
                  return;
                }
                socketRef.current.emit("start-call", { roomId, userName, avatar: userAvatar });
                setShowPlanModal(false);
                setShowMeeting(true);
              }} title="Start Video Call">
                <FaVideo />
              </ActionButton>
            )}

            {features.whiteboard !== false && (
              <ActionButton onClick={() => { setShowPlanModal(false); setShowWhiteboard(true); }} title="Open Whiteboard">
                <FaPenNib />
              </ActionButton>
            )}

            {features.messageSearch !== false && (
              <ActionButton onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }} title="Search Messages">
                <FaSearch />
              </ActionButton>
            )}

            <ActionButton
              onClick={() => setShowPlanModal(true)}
              title={`Room Subscription Plan${roomPlan ? ` — ${roomPlan}` : ""}`}
              style={{ color: roomPlan === "pro" ? "#818cf8" : roomPlan === "enterprise" ? "#f59e0b" : undefined }}
            >
              <FaCrown />
            </ActionButton>

            <ActionButton onClick={handleShareRoomLink} title="Copy Invite Link">
              <FaShare />
            </ActionButton>

            <ActionButton onClick={handleLeaveRoom} title="Leave Room" style={{ color: "var(--chakra-colors-brandPrimary)" }}>
              <FaSignOutAlt color="white" />
            </ActionButton>

            {features.bookmarks !== false && (
              <ActionButton onClick={() => setShowBookmarks(!showBookmarks)} title="Saved messages / Bookmarks" style={{ color: showBookmarks ? "var(--chakra-colors-brandPrimary)" : "inherit" }}>
                🔖
              </ActionButton>
            )}

            {!isMobile && features.keyboardShortcuts !== false && (
              <ActionButton onClick={() => setShowShortcutsHelp(true)} title="Keyboard Shortcuts Guide" style={{ fontSize: "1.1rem" }}>
                ⌨️
              </ActionButton>
            )}

            {showSearch && (
              <SearchPopup onClick={(e) => e.stopPropagation()}>
                <FaSearch style={{ opacity: 0.5 }} />
                <SearchInput
                  autoFocus
                  placeholder="Filter messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} style={{ background: "none", border: "none", color: "var(--chakra-colors-textPrimary)", cursor: "pointer", opacity: 0.5 }}>✕</button>
              </SearchPopup>
            )}

          </RoomActions>
        </Header>
        {renderPinnedMessagesBanner()}
        {Object.entries(features).some(([, v]) => v === false) && (
          <div style={{
            background: "var(--chakra-colors-surface, rgba(255,255,255,0.07))",
            border: "1px solid var(--chakra-colors-border, rgba(255,255,255,0.07))",
            borderRadius: 10,
            padding: "8px 14px",
            margin: "0 16px 4px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.78rem",
            color: "var(--chakra-colors-textSecondary, #999)",
          }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>ℹ</span>
            <span>Some features are limited. <span style={{ color: "var(--chakra-colors-brandPrimary, #818cf8)", cursor: "pointer", fontWeight: 600 }}>Contact admin</span> to enable more.</span>
          </div>
        )}
        {editingMessageId && createPortal(
          <div
            onClick={() => setEditingMessageId(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 100000,
              background: "rgba(4,5,10,0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(760px, 100%)", maxHeight: "88vh",
                display: "flex", flexDirection: "column", gap: 14,
                background: "#12141f", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18, padding: 20, boxSizing: "border-box",
                boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
                fontFamily: "inherit", color: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>✏️ Edit message</h3>
                <button
                  type="button"
                  onClick={() => setEditingMessageId(null)}
                  aria-label="Cancel editing"
                  style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)", width: 32, height: 32, borderRadius: 9, cursor: "pointer", fontSize: "0.85rem" }}
                >
                  ✕
                </button>
              </div>

              <textarea
                value={editInput}
                onChange={(e) => setEditInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSaveEdit(editingMessageId);
                  if (e.key === "Escape") setEditingMessageId(null);
                }}
                autoFocus
                spellCheck={false}
                style={{
                  flex: 1, minHeight: 220, resize: "vertical",
                  padding: "14px 16px", borderRadius: 12,
                  border: "1px solid rgba(99,102,241,0.45)",
                  background: "rgba(0,0,0,0.35)", color: "#fff",
                  outline: "none", boxSizing: "border-box",
                  fontFamily: "'SF Mono','Fira Code',Consolas,monospace",
                  fontSize: "0.88rem", lineHeight: 1.6,
                  whiteSpace: "pre-wrap", overflowWrap: "break-word",
                }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.7rem", opacity: 0.55 }}>
                  Formatting, indentation & code blocks are preserved · Ctrl+Enter to save · Esc to cancel
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setEditingMessageId(null)}
                    style={{ background: "rgba(255,255,255,0.07)", border: "none", color: "inherit", padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: "0.82rem", fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(editingMessageId)}
                    style={{ background: "linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary))", border: "none", color: "#fff", padding: "9px 22px", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: "0.82rem" }}
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {viewer && (
          <ChunkErrorBoundary>
            <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#06070b", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8", fontWeight: 700 }}>Loading preview…</div>}>
              {(() => {
                const isObject = typeof viewer === "object" && viewer !== null;
                const url = isObject ? viewer.url : viewer;
                const name = isObject ? viewer.name : (getEmbedData(url)?.type || "Web Link");
                const type = isObject ? viewer.type : null;
                const embed = getEmbedData(url);
                // Keep the ORIGINAL url for copy/download/open-external actions;
                // only the iframe renders the embed source.
                return (
                  <UniversalFileViewer
                    url={url}
                    name={isObject ? name : undefined}
                    type={type}
                    mode={isObject ? undefined : "web"}
                    embedSrc={embed?.src}
                    onClose={() => setViewer(null)}
                  />
                );
              })()}
            </Suspense>
          </ChunkErrorBoundary>
        )}

        <MessageContainer ref={messagesContainerRef} onScroll={handleScroll}>
          {hasMoreMessages && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <button
                onClick={loadMoreMessages}
                disabled={loadingMore}
                style={{
                  background: "var(--chakra-colors-surfaceHover)", border: "1px solid var(--chakra-colors-border)",
                  color: "var(--chakra-colors-textSecondary)", padding: "6px 16px", borderRadius: 20,
                  cursor: loadingMore ? "wait" : "pointer", fontSize: "0.8rem", transition: "all 0.2s"
                }}
              >
                {loadingMore ? "Loading…" : "↑ Load older messages"}
              </button>
            </div>
          )}
          {filteredMessages.map((m, i, filteredArr) => {
            const isSystem = m.type === "system";
            const systemType = isSystem ? m.action : null;
            const senderAvatar = m.senderAvatar || participantProfiles[m.senderSocketId]?.avatar || Object.values(participantProfiles).find((profile) => profile.name?.trim().toLocaleLowerCase() === m.userName?.trim().toLocaleLowerCase())?.avatar;
            // const isVisualMedia = Boolean(m.file && (m.file.viewOnce || m.file.type?.startsWith("image/") || m.file.type?.startsWith("video/")));

            // Message grouping: hide avatar/name if same sender within 2 minutes
            const prevMsg = i > 0 ? filteredArr[i - 1] : null;
            const isGrouped = !isSystem && prevMsg && prevMsg.type !== "system" && prevMsg.userName === m.userName && m.ts && prevMsg.ts && (m.ts - prevMsg.ts < 120000);

            // Hide your own join/leave echoes, but always show disappearing-message
            // notices — WhatsApp shows those to the person who toggled them too.
            if (isSystem && m.userName === userName && systemType !== "ephemeral-change") return null;

            // Stable identity: array indexes remount every bubble whenever older
            // messages are prepended or ephemeral ones are removed — that was the
            // source of the chat flicker. Fall back to a composite key for any
            // message without an id.
            const msgKey = m.id != null ? String(m.id) : `${m.ts ?? "x"}-${m.userName ?? "u"}-${i}`;

            return (
              <MessageBubble
                className="chat-message-item"
                key={msgKey}
                ref={(node) => { if (m.id) messageRefs.current[m.id] = node; }}
                data-mid={m.id ? String(m.id) : undefined}
                $highlighted={highlightMessageId === String(m.id || "")}
                $isSender={m.userName === userName}
                $isSystem={isSystem}
                $systemType={systemType}
                $isFile={!!m.file}
                onTouchStart={(e) => !isSystem && handleBubbleTouchStart(e, msgKey)}
                onTouchMove={(e) => !isSystem && handleBubbleTouchMove(e, msgKey)}
                onTouchEnd={(e) => !isSystem && handleBubbleTouchEnd(e, msgKey, m)}
                onTouchCancel={(e) => {
                  delete swipeGesturesRef.current[msgKey];
                  e.currentTarget.style.transition = "transform 0.2s ease";
                  e.currentTarget.style.transform = "translateX(0)";
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                {!isSystem && m.forwarded && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", opacity: 0.6, marginBottom: 4, fontStyle: "italic", padding: m.file ? "12px 14px 0px" : "0" }}>
                    <span>↪️</span> Forwarded {m.forwardedFrom ? `from ${m.forwardedFrom}` : ""}
                  </div>
                )}

                {m.userName !== userName && !isSystem && !isGrouped && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, padding: m.file ? "12px 14px 4px" : "0" }}>
                    {senderAvatar ? <img src={senderAvatar} alt={`${m.userName} avatar`} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} /> : <div aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, background: getColor(m.userName), color: "#fff", fontSize: ".68rem", fontWeight: 800 }}>{m.userName?.slice(0, 1)?.toUpperCase()}</div>}
                    <Username color={getColor(m.userName)}>{m.userName}</Username>
                  </div>
                )}

                {!isSystem && m.replyTo && (
                  <button type="button" aria-label="Jump to replied message" onClick={() => jumpToMessage(m.replyTo.id)} style={{ width: m.file ? "calc(100% - 28px)" : "100%", margin: m.file ? "8px 14px 10px" : "0 0 8px", textAlign: "left", border: 0, borderLeft: "3px solid var(--chakra-colors-brandPrimary)", background: "rgba(255,255,255,.055)", borderRadius: 8, padding: "7px 9px", fontSize: ".76rem", lineHeight: 1.35, display: "flex", gap: 9, alignItems: "center", color: "inherit", cursor: "pointer", boxSizing: "border-box" }}>
                    <ReplyAttachmentPreview reply={m.replyTo} roomKey={roomKey} />
                    <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "var(--chakra-colors-brandPrimary)", fontWeight: 700 }}>{m.replyTo.userName || "Message"}</div><div style={{ opacity: .78, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.replyTo.file?.viewOnce ? "View-once media · unavailable" : (m.replyTo.preview || "Attachment")}</div></div>
                  </button>
                )}

                {isSystem && (
                  <span>
                    {systemType === "ephemeral-change" ? (
                      m.ephemeralDuration > 0
                        ? `💨 ${m.userName === userName ? "You" : m.userName} enabled disappearing messages (${formatNearestUnit(m.ephemeralDuration)})`
                        : `💨 ${m.userName === userName ? "You" : m.userName} turned off disappearing messages`
                    ) : (
                      `${m.userName} ${systemType === "join" ? "joined" : "left"} the room`
                    )}
                  </span>
                )}

                {!isSystem && m.poll && renderPoll(m)}

                {!isSystem && m.text && (
                  m.viewOnce && !m.file ? (
                    <ViewOnceText
                      text={m.text}
                      messageId={m.id}
                      onRevealComplete={(id) => {
                        setMessages(prev => prev.filter(msg => msg.id !== id));
                        socketRef.current?.emit("deleteOwnMessage", { messageId: id, roomId });
                      }}
                    />
                  ) : m.file ? (
                    <div style={{ padding: "4px 14px 10px" }}>{renderSmartMessage(m.text)}</div>
                  ) : renderSmartMessage(m.text)
                )}

                {m.gif && (
                  <img
                    src={m.gif}
                    alt="GIF"
                    loading="lazy"
                    style={{ maxWidth: isMobile ? "85vw" : "380px", width: "100%", maxHeight: "400px", objectFit: "cover", borderRadius: 12, marginTop: "8px", cursor: "pointer", display: "block" }}
                    onClick={() => setFullscreen({ url: m.gif, type: "image" })}
                  />
                )}

                {m.file && (
                  <div style={{ position: "relative", width: "100%", minWidth: 0, flexShrink: 0 }}>
                    {m.file.type === "ai" ? (
                      <div style={{ padding: isMobile ? "10px 12px" : "12px 14px" }}>
                        {m.file.loading ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--chakra-colors-textSecondary)", fontSize: "0.82rem" }}>
                            <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #7c3aed", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                            Thinking…
                          </div>
                        ) : (
                          <div style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 10, padding: "10px 14px", fontSize: "0.84rem", lineHeight: 1.55, color: "var(--chakra-colors-textPrimary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#7c3aed", marginBottom: 6, letterSpacing: "0.03em" }}>✦ CheprabAI</div>
                            {(() => {
                              const text = m.file.text || "";
                              // Parse markdown images ![alt](url) and plain image/video URLs
                              const parts = [];
                              const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
                              const urlRegex = /(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|svg|mp4|webm|mov))/gi;
                              let lastIdx = 0;
                              let match;
                              // First extract markdown images
                              while ((match = imgRegex.exec(text)) !== null) {
                                if (match.index > lastIdx) parts.push({ type: "text", content: text.slice(lastIdx, match.index) });
                                parts.push({ type: "image", url: match[2], alt: match[1] });
                                lastIdx = imgRegex.lastIndex;
                              }
                              if (lastIdx < text.length) {
                                let remaining = text.slice(lastIdx);
                                // Then extract plain URLs for images/videos
                                const plainParts = [];
                                let plainLast = 0;
                                let urlMatch;
                                while ((urlMatch = urlRegex.exec(remaining)) !== null) {
                                  if (urlMatch.index > plainLast) plainParts.push({ type: "text", content: remaining.slice(plainLast, urlMatch.index) });
                                  const u = urlMatch[1];
                                  const isVideo = /\.(mp4|webm|mov)$/i.test(u);
                                  plainParts.push({ type: isVideo ? "video" : "image", url: u, alt: "" });
                                  plainLast = urlRegex.lastIndex;
                                }
                                if (plainLast < remaining.length) plainParts.push({ type: "text", content: remaining.slice(plainLast) });
                                parts.push(...plainParts);
                              }
                              return parts.map((p, i) => {
                                if (p.type === "text") return <span key={i}>{p.content}</span>;
                                if (p.type === "video") return <video key={i} src={p.url} controls style={{ maxWidth: "100%", borderRadius: 8, margin: "6px 0" }} />;
                                return <img key={i} src={p.url} alt={p.alt} style={{ maxWidth: "100%", borderRadius: 8, margin: "6px 0", cursor: "pointer" }} onClick={() => window.open(p.url, "_blank")} />;
                              });
                            })()}
                          </div>
                        )}
                      </div>
                    ) : m.file.loading ? (
                      <div style={{ padding: isMobile ? "10px 12px" : "12px 14px" }}>
                        <UploadProgressCard file={m.file} isMobile={isMobile} />
                      </div>
                    ) : (
                      <E2EEFileAttachment file={m.file} roomKey={roomKey} setFullscreen={setFullscreen} isMobile={isMobile} setViewer={setViewer} reactions={m.reactions} messageId={m.id} onToggleReaction={toggleReaction} reactionsEnabled={features.reactions !== false} />
                    )}
                  </div>
                )}

                <div style={m.file ? { padding: "8px 12px 6px" } : undefined}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: 'space-between', width: "100%", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {m.editedAt && <span style={{ fontSize: "0.65rem", opacity: 0.6, fontStyle: "italic", color: "var(--chakra-colors-textSecondary)" }}>(edited)</span>}
                      <Timestamp>{new Date(m.ts).toLocaleTimeString()}</Timestamp>
                    </div>
                    {m.userName === userName && Object.keys(m.viewedBy || {}).length > 0 && (
                      <button type="button" onClick={() => setViewedByTarget(m)} aria-label={`See who viewed this message`} style={{ color: "#4fc3f7", fontSize: ".72rem", cursor: "pointer", border: 0, background: "transparent", padding: 0, minHeight: 32, fontWeight: 750 }}>
                        ✓✓ {Object.keys(m.viewedBy).length}
                      </button>
                    )}
                    {m.ephemeral && (
                      <span style={{
                        fontSize: "0.6rem", color: "#ff6b6b", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 3
                      }}>
                        💨 {formatNearestUnit(Math.max(0, (m.ephemeralDuration || DEFAULT_EPHEMERAL_DURATION) - Math.floor((Date.now() - m.ts) / 1000)))}
                      </span>
                    )}
                  </div>
                  {!isSystem && (
                    <div
                      className="bubble-actions"
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 5,
                        minWidth: 0,
                        marginTop: 4,
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <BubbleActionButton
                          type="button"
                          onClick={() =>
                            setReplyTo({
                              id: m.id,
                              userName: m.userName,
                              preview: m.file?.viewOnce
                                ? "View-once media"
                                : m.text || m.file?.name || (m.gif ? "GIF" : "Media"),
                              file: m.file?.viewOnce ? { viewOnce: true } : m.file || null,
                              gif: m.file?.viewOnce ? null : m.gif || null,
                            })
                          }
                          data-tooltip="Reply"
                        >
                          <FaReply size={12} />
                        </BubbleActionButton>

                        {(m.text || m.file?.name) && (
                          <BubbleActionButton
                            type="button"
                            onClick={() => {
                              const copyText = m.text || m.file?.name || "";
                              safeCopyText(copyText).then((ok) => {
                                if (ok) toast.success("Copied to clipboard", { autoClose: 1200 });
                                else toast.error("Failed to copy");
                              });
                            }}
                            data-tooltip="Copy"
                          >
                            <FaCopy size={11} />
                          </BubbleActionButton>
                        )}

                        {features.pinnedMessages !== false && ownerToken && (
                          <BubbleActionButton
                            type="button"
                            onClick={() => {
                              const isPinned = pinnedIds.has(m.id);
                              if (isPinned) {
                                socketRef.current?.emit("unpinMessage", { messageId: m.id });
                                toast.success("Message unpinned");
                              } else {
                                socketRef.current?.emit("pinMessage", { messageId: m.id });
                                toast.success("Message pinned");
                              }
                            }}
                            data-tooltip={pinnedIds.has(m.id) ? "Unpin" : "Pin"}
                            $active={pinnedIds.has(m.id)}
                          >
                            <FaThumbtack size={12} style={{ transform: pinnedIds.has(m.id) ? "none" : "rotate(45deg)" }} />
                          </BubbleActionButton>
                        )}

                        {features.messageEditing !== false && m.userName === userName && m.text && !m.file && !m.poll && (Date.now() - m.ts < 15 * 60 * 1000) && (
                          <BubbleActionButton
                            type="button"
                            onClick={() => {
                              setEditingMessageId(m.id);
                              setEditInput(m.text);
                            }}
                            data-tooltip="Edit"
                          >
                            <FaPen size={11} />
                          </BubbleActionButton>
                        )}

                        {(m.text || m.file || m.gif) && !m.poll && features.messageForwarding !== false && (
                          <BubbleActionButton
                            type="button"
                            onClick={() => {
                              setForwardTarget(m);
                              setForwardRoomId("");
                              setForwardSecurityCode("");
                            }}
                            data-tooltip="Forward"
                          >
                            <FaShare size={12} />
                          </BubbleActionButton>
                        )}

                        <BubbleActionButton
                          type="button"
                          onClick={() => toggleBookmark(m)}
                          data-tooltip={bookmarkIds.has(m.id) ? "Saved" : "Bookmark"}
                          $active={bookmarkIds.has(m.id)}
                        >
                          {bookmarkIds.has(m.id) ? <FaBookmark size={11} /> : <FaRegBookmark size={11} />}
                        </BubbleActionButton>

                        {m.userName === userName && (
                          <BubbleActionButton
                            type="button"
                            onClick={() => {
                              setConfirmation({
                                title: "Delete this message?",
                                body: "This will permanently delete this message for everyone in the room.",
                                confirmLabel: "Delete",
                                tone: "danger",
                                onConfirm: () => {
                                  socketRef.current.emit("deleteOwnMessage", { messageId: m.id, roomId }, (result) => {
                                    if (result?.error) {
                                      toast.error(result.error);
                                    } else {
                                      toast.success("Message deleted");
                                    }
                                  });
                                }
                              });
                            }}
                            data-tooltip="Delete"
                            $danger
                          >
                            <FaTrash size={12} />
                          </BubbleActionButton>
                        )}

                        {features.reactions !== false && (
                        <BubbleActionButton
                          type="button"
                          className={`reaction-btn-${m.id}`}
                          onClick={(e) => {
                            e.currentTarget.closest(".chat-message-item")?.scrollIntoView({ block: "nearest" });
                            setReactionPickerFor(reactionPickerFor === m.id ? null : m.id);
                          }}
                          data-tooltip="React"
                        >
                          😊
                        </BubbleActionButton>
                        )}
                      </div>

                      {reactionPickerFor === m.id && (
                        <div
                          className={`reaction-picker-${m.id}`}
                          style={{
                            position: "absolute",
                            bottom: "calc(100% + 4px)",
                            right: 0,
                            display: "flex",
                            gap: 5,
                            padding: 8,
                            borderRadius: 14,
                            background: "#23272f",
                            boxShadow: "0 8px 24px rgba(0,0,0,.35)",
                            zIndex: 100,
                            animation: "fadeIn .15s ease",
                          }}
                        >
                          {["❤️", "👍", "😂", "😮", "🙏"].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => {
                                toggleReaction(m.id, emoji);
                                setReactionPickerFor(null);
                              }}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                border: 0,
                                background: "transparent",
                                cursor: "pointer",
                                fontSize: "1rem",
                                transition: ".15s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,.05)";
                                e.currentTarget.style.transform = "scale(1.2)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!isSystem && !m.file && Object.keys(m.reactions || {}).length > 0 && (
                    <div className="bubble-reactions" style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                      {Object.entries(m.reactions).map(([emoji, users]) => (
                        <button
                          key={emoji}
                          title={Object.values(users).map((u) => u.name).join(", ")}
                          onClick={() => toggleReaction(m.id, emoji)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: isMobile ? "2px 8px" : "2px 9px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,.08)",
                            background: "rgba(129,140,248,.14)",
                            color: "#c7d2fe",
                            cursor: "pointer",
                            fontSize: isMobile ? ".72rem" : ".76rem",
                            lineHeight: 1.4,
                            transition: ".2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(129,140,248,.28)";
                            e.currentTarget.style.borderColor = "rgba(129,140,248,.45)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(129,140,248,.14)";
                            e.currentTarget.style.borderColor = "rgba(255,255,255,.08)";
                          }}
                        >
                          <span style={{ fontSize: ".82rem", lineHeight: 1 }}>{emoji}</span>
                          <span style={{ fontWeight: 700 }}>{Object.keys(users).length}</span>
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              </MessageBubble>
            );
          })}
          {features.typingIndicators !== false && typingUsers.length > 0 && (
            <TypingIndicator>
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing…`
                : `${typingUsers.slice(0, 2).join(", ")}${typingUsers.length > 2 ? ` +${typingUsers.length - 2}` : ""} are typing…`}
            </TypingIndicator>
          )}
        </MessageContainer>

        {showScrollPill && (
          <button
            type="button"
            onClick={() => {
              if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
              }
              setShowScrollPill(false);
              setUnreadCount(0);
            }}
            style={{
              position: "absolute",
              bottom: "90px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary))",
              color: "#fff",
              border: "none",
              borderRadius: "20px",
              padding: "10px 18px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              zIndex: 99,
              transition: "transform 0.2s, opacity 0.2s"
            }}
          >
            <span>👇</span>
            {unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? "s" : ""}` : "Scroll to bottom"}
          </button>
        )}

        {showGifPicker && (
          <GifPickerOverlay onClick={() => setShowGifPicker(false)}>
            <GifPickerModal $isMobile={isMobile} onClick={(e) => e.stopPropagation()}>
              <GifDrawerHandle />

              <GifPickerHeader>
                <GifPickerTopRow>
                  <GifPickerTitle>
                    <span className="title">Find GIFs</span>
                    <span className="badge">GIPHY</span>
                  </GifPickerTitle>
                  <CloseGifPickerButton onClick={() => setShowGifPicker(false)} title="Close GIF Drawer">
                    <AiOutlineClose />
                  </CloseGifPickerButton>
                </GifPickerTopRow>
                <GifPickerSubtitle>Search expressive reactions and send instantly with one tap.</GifPickerSubtitle>
                <GifSearchContainer>
                  <GifSearchIcon>
                    <FaSearch />
                  </GifSearchIcon>
                  <GifSearchInput
                    placeholder="Search millions of GIFs..."
                    value={gifQuery}
                    onChange={(e) => setGifQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setGifOffset(0);
                        setHasMoreGifs(true);
                        fetchGifs(gifQuery, 0);
                      }
                    }}
                  />
                  {gifQuery && (
                    <GifSearchClearButton
                      onClick={() => {
                        setGifQuery("");
                        setGifOffset(0);
                        setHasMoreGifs(true);
                        fetchGifs("", 0);
                      }}
                      title="Clear Search"
                    >
                      <AiOutlineClose size={14} />
                    </GifSearchClearButton>
                  )}
                </GifSearchContainer>
              </GifPickerHeader>

              <GifGrid ref={gifGridRef}>
                {gifs.map((gif) => (
                  <GifCardComponent
                    key={gif.id}
                    gif={gif}
                    onSelect={(selectedGif) => {
                      handleSend({ text: "", gif: selectedGif.images.fixed_height.url });
                    }}
                  />
                ))}

                {!loadingGifsRef.current && gifs.length === 0 && (
                  <GifEmptyState style={{ gridColumn: "1 / -1" }}>
                    <div className="icon">🔍</div>
                    <div className="text">No GIFs found</div>
                    <div className="subtext">Try searching for something else</div>
                  </GifEmptyState>
                )}

                {hasMoreGifs && gifs.length > 0 && (
                  <div style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    justifyContent: "center",
                    padding: "16px 0",
                    color: "rgba(255, 255, 255, 0.4)",
                    fontSize: "0.8rem",
                    fontWeight: 500
                  }}>
                    Scroll for more…
                  </div>
                )}
              </GifGrid>

              <GiphyAttribution>
                Powered by <a href="https://giphy.com" target="_blank" rel="noopener noreferrer">GIPHY</a>
              </GiphyAttribution>
            </GifPickerModal>
          </GifPickerOverlay>
        )}

        {pendingFiles.length > 0 && (
          <PreviewOverlay onClick={() => { setPendingFiles([]); setSendAsViewOnce(false); }}>
            <PreviewModal $isMobile={isMobile} onClick={(e) => e.stopPropagation()}>
              <PreviewHeader>
                <PreviewTitleGroup>
                  <PreviewTitle>
                    {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""} selected
                  </PreviewTitle>
                  <PreviewSubtitle>
                    Review your selected files before sending — tap any preview to inspect it in full size.
                  </PreviewSubtitle>
                  {pendingFiles.some((file) => /^(image|video)\//.test(file.type)) && (
                    <button
                      type="button"
                      aria-pressed={sendAsViewOnce}
                      onClick={() => setSendAsViewOnce((value) => !value)}
                      style={{ alignSelf: "flex-start", marginTop: 10, border: `1px solid ${sendAsViewOnce ? "var(--chakra-colors-brandPrimary)" : "rgba(255,255,255,.14)"}`, background: sendAsViewOnce ? "rgba(99,91,255,.18)" : "rgba(255,255,255,.035)", color: "inherit", borderRadius: 999, padding: "7px 11px", cursor: "pointer", fontSize: ".78rem", fontWeight: 700 }}
                    >
                      🔒 {sendAsViewOnce ? "View once enabled" : "Enable view once"}
                    </button>
                  )}
                </PreviewTitleGroup>
                <PreviewCloseButton
                  onClick={() => {
                    setPendingFiles([]);
                    setSendAsViewOnce(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  title="Close preview"
                >
                  <AiOutlineClose />
                </PreviewCloseButton>
              </PreviewHeader>

              <PreviewContent $singleFile={pendingFiles.length === 1}>
                {pendingFiles.map((pf, idx) => {
                  const key = `${pf.name}-${pf.size}-${idx}`;
                  const objUrl = pendingFilesUrls[key];
                  return (
                    <PreviewCard key={key} $singleFile={pendingFiles.length === 1}>
                      <PreviewMediaWrapper $singleFile={pendingFiles.length === 1}>
                        {pf.type && pf.type.startsWith("image") ? (
                          <PreviewMedia alt={pf.name} src={objUrl} loading="lazy" />
                        ) : pf.type && pf.type.startsWith("video") ? (
                          <PreviewVideo src={objUrl} controls autoPlay={pendingFiles.length === 1} />
                        ) : (
                          <PreviewFilePlaceholder>
                            <FaFile size={30} style={{ color: "var(--chakra-colors-brandPrimary)", marginBottom: 10 }} />
                            <div>{pf.name}</div>
                            <div style={{ marginTop: 6, color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>{(pf.size / 1024 / 1024).toFixed(2)} MB</div>
                          </PreviewFilePlaceholder>
                        )}
                      </PreviewMediaWrapper>

                      {pendingFiles.length === 1 ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
                          <PreviewFileInfo style={{ margin: 0 }}>
                            <PreviewFileName>{pf.name}</PreviewFileName>
                            <PreviewFileMeta>
                              {pf.type ? pf.type.replace("application/", "").replace("image/", "Image").replace("video/", "Video").replace("audio/", "Audio") : "File"} • {(pf.size / 1024 / 1024).toFixed(2)} MB
                            </PreviewFileMeta>
                          </PreviewFileInfo>
                          <PreviewRemoveButton
                            onClick={() => setPendingFiles([])}
                            title="Remove this file"
                          >
                            ✕
                          </PreviewRemoveButton>
                        </div>
                      ) : (
                        <>
                          <PreviewFileInfo>
                            <PreviewFileName>{pf.name}</PreviewFileName>
                            <PreviewFileMeta>
                              {pf.type ? pf.type.replace("application/", "").replace("image/", "Image").replace("video/", "Video").replace("audio/", "Audio") : "File"} • {(pf.size / 1024 / 1024).toFixed(2)} MB
                            </PreviewFileMeta>
                          </PreviewFileInfo>

                          <PreviewRemoveButton
                            onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                            title="Remove this file"
                          >
                            ✕
                          </PreviewRemoveButton>
                        </>
                      )}
                    </PreviewCard>
                  );
                })}
              </PreviewContent>

              <PreviewActions>
                <CancelBtn
                  aria-label="Cancel upload"
                  onClick={() => {
                    setPendingFiles([]);
                    setSendAsViewOnce(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <AiOutlineClose />
                </CancelBtn>

                <SendBtn
                  aria-label="Send files"
                  onClick={() => {
                    handleSend();
                  }}
                >
                  <FaPaperPlane />
                </SendBtn>
              </PreviewActions>
            </PreviewModal>
          </PreviewOverlay>
        )}

        {exportPwdOpen && (
          <div role="dialog" aria-modal="true" aria-label="Protect exported chat" style={{ position: "fixed", inset: 0, zIndex: 23500, background: "rgba(6,8,14,.72)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center", padding: 20 }} onClick={() => { setExportPwdOpen(false); exportPwdResolveRef.current?.(null); exportPwdResolveRef.current = null; }}>
            <section style={{ width: "min(400px, 100%)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.08)", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Protect exported chat</h3>
              <p style={{ margin: "0 0 18px", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.5, fontSize: ".84rem" }}>Set a password to seal the archive. The HTML file encrypts its messages and asks for this password when opened (min 6 characters).</p>
              <input
                type="password"
                autoFocus
                value={exportPwdValue}
                onChange={(e) => { setExportPwdValue(e.target.value); if (exportPwdErr) setExportPwdErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("export-pwd-confirm")?.click(); }}
                placeholder="Password (min 6 chars)"
                style={{ width: "100%", minHeight: 46, padding: "0 12px", borderRadius: 11, border: `1px solid ${exportPwdErr ? "rgba(255,107,107,.6)" : "rgba(255,255,255,.14)"}`, background: "rgba(255,255,255,.05)", color: "#fff", fontSize: ".9rem", outline: "none" }}
              />
              {exportPwdErr && <p style={{ margin: "8px 0 0", color: "#ff6b6b", fontSize: ".76rem" }}>{exportPwdErr}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => { setExportPwdOpen(false); exportPwdResolveRef.current?.(null); exportPwdResolveRef.current = null; }} style={{ minHeight: 44, padding: "9px 16px", borderRadius: 11, border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
                <button id="export-pwd-confirm" type="button" onClick={() => { const p = exportPwdValue; if (p.length < 6) { setExportPwdErr("Password must be at least 6 characters."); return; } setExportPwdOpen(false); exportPwdResolveRef.current?.(p); exportPwdResolveRef.current = null; }} style={{ minHeight: 44, padding: "9px 18px", borderRadius: 11, border: 0, background: "var(--chakra-colors-brandPrimary)", color: "white", fontWeight: 800, cursor: "pointer" }}>Encrypt & Export</button>
              </div>
            </section>
          </div>
        )}

        {showPlanModal && (
          <PlanModalOverlay onClick={() => setShowPlanModal(false)}>
            <PlanModalCard onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FaCrown size={22} color={(PLAN_META[roomPlan]?.color) || "#f59e0b"} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--chakra-colors-textPrimary)" }}>Room Subscription Plan</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--chakra-colors-textSecondary)" }}>Room #{roomId}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  title="Close"
                  style={{ background: "rgba(255,107,107,0.12)", border: "1px solid rgba(255,107,107,0.22)", color: "var(--chakra-colors-textPrimary)", width: 36, height: 36, borderRadius: 10, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
                >
                  <AiOutlineClose />
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 14, border: `1px solid ${(PLAN_META[roomPlan]?.color || "#f59e0b")}55`, background: `${PLAN_META[roomPlan]?.color || "#f59e0b"}14`, marginBottom: 16 }}>
                <span style={{ fontWeight: 800, textTransform: "capitalize", color: PLAN_META[roomPlan]?.color || "#f59e0b", fontSize: "1.15rem" }}>{roomPlan || "—"}</span>
                {planOverride && (
                  <span style={{ fontSize: "0.66rem", color: "var(--chakra-colors-textSecondary)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>custom for this room</span>
                )}
                <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--chakra-colors-textSecondary)" }}>
                  {PLAN_META[roomPlan]?.desc || ""}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(roomPlanLimits || {}).length > 0 ? (
                  Object.entries(roomPlanLimits).map(([key, value]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--chakra-colors-badgeBg)", borderRadius: 10, fontSize: "0.8rem" }}>
                      <span style={{ color: "var(--chakra-colors-textSecondary)" }}>{PLAN_LIMIT_LABELS[key] || key}</span>
                      <span style={{ fontWeight: 800, color: "var(--chakra-colors-textPrimary)" }}>{planLimitValue(value)}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "12px 12px", background: "var(--chakra-colors-badgeBg)", borderRadius: 10, fontSize: "0.8rem", color: "var(--chakra-colors-textSecondary)" }}>
                    Plan limits are managed by the platform admin.
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 10px" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--chakra-colors-textSecondary)" }}>Included features</span>
                <span style={{ flex: 1, height: 1, background: "var(--chakra-colors-border)" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {USER_FEATURE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--chakra-colors-textSecondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                      {group.label}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 5 }}>
                      {group.features.map((feat) => {
                        const included = planIncludes(roomPlan, feat.key);
                        const accent = (PLAN_META[roomPlan]?.color) || "#f59e0b";
                        return (
                          <div
                            key={feat.key}
                            title={`${feat.label} — ${feat.desc}`}
                            style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 9, background: "var(--chakra-colors-badgeBg)", fontSize: "0.74rem", color: "var(--chakra-colors-textPrimary)", opacity: included ? 1 : 0.62 }}
                          >
                            {included ? (
                              <FaCheck size={11} color={accent} style={{ flexShrink: 0 }} />
                            ) : (
                              <FaTimes size={11} color="var(--chakra-colors-textMuted)" style={{ flexShrink: 0 }} />
                            )}
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{feat.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: "0.78rem", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.55, paddingTop: 14, marginTop: 16, borderTop: "1px solid var(--chakra-colors-border)" }}>
                This room's plan is set by the platform admin. Need a bigger plan? Ask the admin to change it from the admin panel.
              </div>
            </PlanModalCard>
          </PlanModalOverlay>
        )}

        {isStealthMode ? (
          <div style={{
            padding: "14px 16px",
            textAlign: "center",
            color: "var(--chakra-colors-textSecondary)",
            fontSize: "0.85rem",
            borderTop: "1px solid var(--chakra-colors-border)",
            background: "rgba(123, 97, 255, 0.06)",
            flexShrink: 0,
          }}>
            <FaEyeSlash style={{ marginRight: 6, verticalAlign: "middle" }} aria-hidden="true" />
            Stealth observer mode — read-only access
          </div>
        ) : (
          <MessageInputContainer style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            {replyTo && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: "rgba(255,255,255,.03)",
                borderRadius: 12,
                borderLeft: "3px solid var(--chakra-colors-brandPrimary)",
                animation: "fadeIn .15s ease",
              }}>
                <ReplyAttachmentPreview reply={replyTo} roomKey={roomKey} />
                <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                  <div style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--chakra-colors-brandPrimary)", marginBottom: 2 }}>
                    Replying to {replyTo.userName || "Message"}
                  </div>
                  <div style={{ fontSize: ".8rem", opacity: .72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {replyTo.file?.viewOnce ? "View-once media" : (replyTo.preview || "Attachment")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  aria-label="Cancel reply"
                  style={{
                    background: "rgba(255,255,255,.04)",
                    border: "none",
                    color: "var(--chakra-colors-textSecondary)",
                    cursor: "pointer",
                    borderRadius: "50%",
                    width: 28,
                    height: 28,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    fontSize: ".85rem",
                    transition: "background .2s, color .2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,71,87,.18)"; e.currentTarget.style.color = "#ff6b6b"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.04)"; e.currentTarget.style.color = "var(--chakra-colors-textSecondary)"; }}
                >
                  ✕
                </button>
              </div>
            )}
            {showMobileActions && isMobile && (
              <AccessoryRow>
                <div style={{ position: "relative" }}>
                  <IconButton type="button" className="emoji-picker-toggle-btn" onClick={() => setShowEmojiPicker((value) => !value)} title="Choose an emoji" aria-label="Choose an emoji">😊</IconButton>
                  {showEmojiPicker && (
                    <PremiumEmojiPicker
                      onSelect={(emoji) => {
                        setMessage((current) => `${current}${emoji}`);
                        setShowEmojiPicker(false);
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                      isMobile={isMobile}
                    />
                  )}
                </div>
                {features.giphySearch !== false && (
                  <IconButton
                    onClick={() => {
                      setShowGifPicker(true);
                      fetchGifs();
                    }}
                    title="Send GIF"
                  >
                    <HiGif />
                  </IconButton>
                )}
                {features.polls !== false && (
                  <IconButton
                    onClick={() => setShowPollCreator(true)}
                    title="Create Poll"
                  >
                    📊
                  </IconButton>
                )}
                {features.scheduledMessages !== false && (
                  <IconButton
                    onClick={() => setShowScheduler(!showScheduler)}
                    title="Schedule Message"
                    style={{ color: showScheduler ? "var(--chakra-colors-brandPrimary)" : "inherit" }}
                  >
                    ⏰
                  </IconButton>
                )}
                {features.voiceRecordings !== false && !isRecording && (
                  <IconButton onClick={startVoiceRecording} title="Record voice note">
                    <FaMicrophone />
                  </IconButton>
                )}
                <IconButton
                  type="button"
                  onClick={() => setCodeBlockMode(v => !v)}
                  title={codeBlockMode ? "Code block mode ON — message will send as code" : "Share as code block"}
                  aria-pressed={codeBlockMode}
                  style={{
                    color: codeBlockMode ? "var(--chakra-colors-brandPrimary)" : "inherit",
                    background: codeBlockMode ? "rgba(99,102,241,0.15)" : "transparent",
                    fontWeight: 800,
                    fontFamily: "'SF Mono','Fira Code',Consolas,monospace",
                  }}
                >
                  {"</>"}
                </IconButton>
                {features.ephemeralMessages !== false && (
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <EphemeralToggle
                      $active={roomEphemeralDuration > 0}
                      onClick={() => setShowEphemeralMenu(!showEphemeralMenu)}
                      title={roomEphemeralDuration > 0 ? `Disappearing messages ON · ${formatNearestUnit(roomEphemeralDuration)}` : "Disappearing messages OFF"}
                    >
                      <FaClock />
                    </EphemeralToggle>
                    {showEphemeralMenu && (
                      <>
                        <EphemeralMenuOverlay onClick={() => setShowEphemeralMenu(false)} />
                        <EphemeralMenuCard onClick={(e) => e.stopPropagation()}>
                          <div className="title">💨 Disappearing Messages</div>
                          <div className="subtitle">All new messages in this room will vanish after the selected time.</div>
                          <div className="options">
                            {renderEphemeralMenuItems()}
                          </div>
                        </EphemeralMenuCard>
                      </>
                    )}
                  </div>
                )}
              </AccessoryRow>
            )}

            {showMentionSuggestions && mentionSuggestions.length > 0 && (
              <div
                className="mention-suggestions"
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: isMobile ? 12 : 24,
                  right: isMobile ? 12 : 24,
                  background: "rgba(20, 20, 25, 0.95)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "14px",
                  boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.4), 0 10px 30px rgba(0, 0, 0, 0.3)",
                  maxHeight: "200px",
                  overflowY: "auto",
                  zIndex: 21000,
                  display: "flex",
                  flexDirection: "column",
                  padding: "6px"
                }}
              >
                {mentionSuggestions.map((user, idx) => {
                  const profile = participantProfiles[user.id] || Object.values(participantProfiles).find(p => p.name === user.name);
                  const avatar = profile?.avatar;
                  return (
                    <div
                      key={user.id}
                      onClick={() => selectMention(idx)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: idx === mentionIndex ? "rgba(255, 63, 94, 0.15)" : "transparent",
                        color: idx === mentionIndex ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-textPrimary)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "all 0.2s ease",
                        fontWeight: idx === mentionIndex ? "bold" : "normal"
                      }}
                    >
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={user.name}
                          style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.07)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: "bold"
                        }}>
                          {user.name ? user.name.slice(0, 2).toUpperCase() : "?"}
                        </div>
                      )}
                      <span style={{ fontSize: "0.9rem" }}>{user.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {showSlashSuggestions && slashSuggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: isMobile ? 12 : 24,
                  right: isMobile ? 12 : 24,
                  background: "rgba(20, 20, 25, 0.95)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: "14px",
                  boxShadow: "0 -8px 24px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.3)",
                  maxHeight: "200px",
                  overflowY: "auto",
                  zIndex: 21000,
                  display: "flex",
                  flexDirection: "column",
                  padding: "6px"
                }}
              >
                {slashSuggestions.map((cmd, idx) => (
                  <div
                    key={cmd.cmd}
                    onClick={() => selectSlash(idx)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: idx === slashIndex ? "rgba(124,58,237,0.15)" : "transparent",
                      color: idx === slashIndex ? "#a78bfa" : "var(--chakra-colors-textPrimary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      transition: "all 0.2s ease",
                      fontWeight: idx === slashIndex ? "bold" : "normal"
                    }}
                  >
                    <span style={{ fontSize: "1rem", width: 24, textAlign: "center", flexShrink: 0 }}>{cmd.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>{cmd.cmd}</div>
                      <div style={{ fontSize: "0.72rem", opacity: 0.55 }}>{cmd.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 8 : 12, width: "100%" }}>
              <InputPill>
                {isMobile && (
                  <IconButton
                    type="button"
                    onClick={() => setShowMobileActions(!showMobileActions)}
                    title="More Actions"
                    style={{ color: showMobileActions ? "var(--chakra-colors-brandPrimary)" : "inherit", transform: showMobileActions ? "rotate(45deg)" : "none", transition: "transform 0.25s" }}
                  >
                    <FaPlus style={{ fontSize: "0.88rem" }} />
                  </IconButton>
                )}

                {features.fileSharing !== false && !isMobile && (
                  <IconButton as="label" htmlFor="file-input" title="Upload File">
                    <FaPaperclip />
                  </IconButton>
                )}

                <FileInput
                  ref={fileInputRef}
                  id="file-input"
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;
                    setPendingFiles((prev) => [...prev, ...files]);
                  }}
                />

                {features.voiceRecordings !== false && !isMobile && (
                  <>
                    {isRecording ? (
                      <RecordingIndicator onClick={stopVoiceRecording} title="Stop recording">
                        <span className="dot" />
                        <span className="timer">
                          {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                        </span>
                      </RecordingIndicator>
                    ) : (
                      <IconButton onClick={startVoiceRecording} title="Record voice note">
                        <FaMicrophone />
                      </IconButton>
                    )}
                  </>
                )}

                {!isMobile && (
                  <IconButton
                    type="button"
                    onClick={() => setCodeBlockMode(v => !v)}
                    title={codeBlockMode ? "Code block mode ON — message will send as code" : "Share as code block"}
                    aria-pressed={codeBlockMode}
                    style={{
                      color: codeBlockMode ? "var(--chakra-colors-brandPrimary)" : "inherit",
                      background: codeBlockMode ? "rgba(99,102,241,0.15)" : "transparent",
                      border: codeBlockMode ? "1px solid rgba(99,102,241,0.4)" : "none",
                      fontWeight: 800,
                      fontSize: "1rem",
                      fontFamily: "'SF Mono','Fira Code',Consolas,monospace",
                    }}
                  >
                    {"</>"}
                  </IconButton>
                )}

                <MessageInput
                  rows={1}
                  ref={composerRef}
                  data-composer="true"
                  placeholder={codeBlockMode ? "// Code block mode — paste your code…" : ephemeralMode ? "💨 Ephemeral message..." : "Type a message..."}
                  value={message}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  style={codeBlockMode ? { fontFamily: "'SF Mono','Fira Code',Consolas,monospace", fontSize: "0.85rem" } : undefined}
                  onInput={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
                  }}
                />

                {isMobile && features.fileSharing !== false && (
                  <IconButton as="label" htmlFor="file-input" title="Upload File">
                    <FaPaperclip />
                  </IconButton>
                )}

                {!isMobile && (
                  <>
                    <div style={{ position: "relative" }}>
                      <IconButton type="button" className="emoji-picker-toggle-btn" onClick={() => setShowEmojiPicker((value) => !value)} title="Choose an emoji" aria-label="Choose an emoji">😊</IconButton>
                      {showEmojiPicker && (
                        <PremiumEmojiPicker
                          onSelect={(emoji) => {
                            setMessage((current) => `${current}${emoji}`);
                            setShowEmojiPicker(false);
                          }}
                          onClose={() => setShowEmojiPicker(false)}
                          isMobile={isMobile}
                        />
                      )}
                    </div>
                    {features.giphySearch !== false && (
                      <IconButton
                        onClick={() => {
                          setShowGifPicker(true);
                          fetchGifs();
                        }}
                        title="Send GIF"
                      >
                        <HiGif />
                      </IconButton>
                    )}

                    {features.polls !== false && (
                      <IconButton
                        onClick={() => setShowPollCreator(true)}
                        title="Create Poll"
                      >
                        📊
                      </IconButton>
                    )}

                    {features.scheduledMessages !== false && (
                      <IconButton
                        onClick={() => setShowScheduler(!showScheduler)}
                        title="Schedule Message"
                        style={{ color: showScheduler ? "var(--chakra-colors-brandPrimary)" : "inherit" }}
                      >
                        ⏰
                      </IconButton>
                    )}

                    {features.ephemeralMessages !== false && (
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <EphemeralToggle
                        $active={roomEphemeralDuration > 0}
                        onClick={() => setShowEphemeralMenu(!showEphemeralMenu)}
                        title={roomEphemeralDuration > 0 ? `Disappearing messages ON · ${formatNearestUnit(roomEphemeralDuration)}` : "Disappearing messages OFF"}
                      >
                        <FaClock />
                      </EphemeralToggle>
                      {showEphemeralMenu && (
                        <>
                          <EphemeralMenuOverlay onClick={() => setShowEphemeralMenu(false)} />
                          <EphemeralMenuCard onClick={(e) => e.stopPropagation()}>
                            <div className="title">💨 Disappearing Messages</div>
                            <div className="subtitle">All new messages in this room will vanish after the selected time.</div>
                            <div className="options">
                              {renderEphemeralMenuItems()}
                            </div>
                          </EphemeralMenuCard>
                        </>
                      )}
                    </div>
                  )}
                  </>
                )}
              </InputPill>

              {isMobile && features.voiceRecordings !== false && isRecording && (
                <RecordingIndicator onClick={stopVoiceRecording} title="Stop recording">
                  <span className="dot" />
                  <span className="timer">
                    {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                  </span>
                </RecordingIndicator>
              )}

              <SendButton onClick={() => handleSend()} disabled={!message.trim() && pendingFiles.length === 0}>
                <FaPaperPlane />
              </SendButton>
            </div>
            {liveQueue.length > 0 && (
              <div style={{
                marginTop: 8,
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(251,191,36,0.10)",
                border: "1px solid rgba(251,191,36,0.28)",
                fontSize: "0.82rem",
                color: "var(--chakra-colors-textPrimary)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--chakra-colors-brandPrimary)" }}>
                  <span style={{ animation: "pulse 1.6s infinite" }}>⏳</span>
                  <span>Realtime queue</span>
                  <span style={{ marginLeft: "auto", opacity: 0.75 }}>{liveQueue.length} waiting</span>
                </div>
                {liveQueue.map((name, i) => (
                  <div key={`${name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.9 }}>
                    <span>📎</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    <span style={{ marginLeft: "auto", fontStyle: "italic", opacity: 0.6, fontSize: "0.72rem" }}>starts when current finishes</span>
                  </div>
                ))}
              </div>
            )}
          </MessageInputContainer>
        )}

        <style>{`
          @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); } }
          @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        `}</style>

        {showScheduler && (
          <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 22000, background: "rgba(0,0,0,.68)", display: "grid", placeItems: "center", padding: 20 }}>
            <div style={{ width: "min(400px, 100%)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.05)", boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
              <h3 style={{ margin: "0 0 8px" }}>⏰ Schedule Message</h3>
              <p style={{ margin: "0 0 16px", color: "var(--chakra-colors-textSecondary)", fontSize: "0.85rem" }}>
                Choose when to send your composed message.
              </p>

              <div style={{ background: "rgba(255,255,255,0.055)", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.055)", marginBottom: 16, fontSize: "0.9rem", color: "var(--chakra-colors-textPrimary)" }}>
                {pendingFiles.length > 0 && (
                  <div style={{ marginBottom: message.trim() ? 8 : 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--chakra-colors-brandPrimary)", fontWeight: 700 }}>Files to Schedule:</span>
                    {pendingFiles.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", opacity: 0.85 }}>
                        📎 <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {message.trim() && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--chakra-colors-brandPrimary)", fontWeight: 700 }}>Text to Schedule:</span>
                    <div style={{ fontStyle: "italic", opacity: 0.9 }}>"{message.trim()}"</div>
                  </div>
                )}
                {!message.trim() && pendingFiles.length === 0 && (
                  <em style={{ opacity: 0.5 }}>No text or files to schedule...</em>
                )}
              </div>

              <input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,.15)",
                  background: "rgba(0,0,0,.2)",
                  color: "#fff",
                  marginBottom: 20,
                  fontSize: "1rem",
                  boxSizing: "border-box"
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setShowScheduler(false)} style={{ border: 0, padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,.04)", color: "#fff", fontWeight: 700 }}>
                  Cancel
                </button>
                <button type="button" onClick={handleScheduleMessage} style={{ border: 0, padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: "var(--chakra-colors-brandPrimary)", color: "#fff", fontWeight: 800 }}>
                  Schedule
                </button>
              </div>

              {scheduledMessages.length > 0 && (
                <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16 }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>Pending Scheduled</h4>
                  <div style={{ display: "grid", gap: 8, maxHeight: 150, overflowY: "auto" }}>
                    {scheduledMessages.map((m) => (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.055)", padding: 8, borderRadius: 6, fontSize: "0.8rem" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", fontWeight: 600 }}>
                            {m.file ? `📎 File: ${m.file.name}` : m.text || "Scheduled message"}
                          </div>
                          <div style={{ opacity: 0.6, fontSize: "0.7rem" }}>{new Date(m.sendAt).toLocaleString()}</div>
                        </div>
                        <button type="button" onClick={() => handleCancelScheduled(m.id)} style={{ border: 0, background: "transparent", color: "#ff4757", cursor: "pointer", fontSize: "0.9rem" }}>
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showBookmarks && (
          <div role="dialog" aria-modal="true" style={{ position: "fixed", top: 0, bottom: 0, right: 0, width: "min(380px, 100vw)", zIndex: 20000, background: "var(--chakra-colors-surface)", borderLeft: "1px solid rgba(255,255,255,0.08)", boxShadow: "-10px 0 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Saved Messages 🔖</h3>
              <button type="button" onClick={() => setShowBookmarks(false)} style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "grid", gap: 16 }}>
              {bookmarks.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--chakra-colors-textSecondary)", paddingTop: 40 }}>
                  No saved messages yet. Save a message to view it here!
                </div>
              ) : (
                bookmarks.map((b) => (
                  <div key={b.id} style={{ background: "rgba(255,255,255,0.055)", padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.055)", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--chakra-colors-brandPrimary)" }}>{b.userName}</span>
                      <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>{new Date(b.ts).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "var(--chakra-colors-textPrimary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {b.text}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                      <button type="button" onClick={() => { jumpToMessage(b.id); setShowBookmarks(false); }} style={{ border: 0, background: "transparent", color: "var(--chakra-colors-brandPrimary)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                        Jump
                      </button>
                      <button type="button" onClick={() => toggleBookmark(b)} style={{ border: 0, background: "transparent", color: "#ff4757", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showShortcutsHelp && (
          <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 22000, background: "rgba(0,0,0,.68)", display: "grid", placeItems: "center", padding: 20 }}>
            <div style={{ width: "min(400px, 100%)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.05)", boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
              <h3 style={{ margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span>⌨️</span> Keyboard Shortcuts
              </h3>

              <div style={{ display: "grid", gap: 14, marginBottom: 24 }}>
                {[
                  { keys: ["?", "or Esc"], desc: "Toggle / close this guide" },
                  { keys: ["Ctrl/Cmd", "P"], desc: "Toggle Ephemeral Mode" },
                  { keys: ["Ctrl/Cmd", "F"], desc: "Filter/Search Messages" },
                  { keys: ["Alt", "G"], desc: "Toggle GIF Drawer" },
                  { keys: ["Alt", "E"], desc: "Toggle Emoji Tray" },
                  { keys: ["Escape"], desc: "Close any modal/active popup" }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem" }}>
                    <span style={{ color: "var(--chakra-colors-textSecondary)" }}>{item.desc}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {item.keys.map((k, i) => (
                        <kbd key={i} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "2px 6px", fontSize: "0.75rem", fontWeight: 700, fontFamily: "monospace" }}>{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowShortcutsHelp(false)} style={{ border: 0, padding: "8px 20px", borderRadius: 8, cursor: "pointer", background: "var(--chakra-colors-brandPrimary)", color: "#fff", fontWeight: 800 }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {isDragOver && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 35000,
              background: "rgba(8, 9, 13, 0.88)",
              backdropFilter: "blur(12px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "3px dashed var(--chakra-colors-brandPrimary)",
              margin: 16,
              borderRadius: 24,
              pointerEvents: "none",
              boxSizing: "border-box"
            }}
          >
            <div style={{ fontSize: "5rem", marginBottom: 20, animation: "bounce 2s infinite" }}>📥</div>
            <h2 style={{ fontSize: "2.2rem", fontWeight: 850, margin: "0 0 10px 0", color: "#fff", letterSpacing: "-0.5px" }}>Drop files to send securely</h2>
            <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "1.05rem", margin: 0 }}>
              Files will be fully end-to-end encrypted locally in your browser.
            </p>
          </div>
        )}

        {renderAvatarCropDialog()}
        {backgroundTarget && <div role="dialog" aria-modal="true" aria-label="Choose background audience" style={{ position: "fixed", inset: 0, zIndex: 21500, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.68)", backdropFilter: "blur(8px)" }}><section style={{ width: "min(100%, 420px)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.05)" }}><h3 style={{ margin: "0 0 8px" }}>Where should this background apply?</h3><p style={{ margin: "0 0 20px", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.5 }}>Choose a personal background, or enforce one for the whole room.</p><div style={{ display: "grid", gap: 10 }}><button type="button" onClick={() => { const file = backgroundTarget; setBackgroundTarget(null); applyBackgroundChange(file, "personal"); }} style={{ minHeight: 48, borderRadius: 11, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.03)", color: "inherit", cursor: "pointer", fontWeight: 750 }}>Only me</button><button type="button" onClick={() => { const file = backgroundTarget; setBackgroundTarget(null); applyBackgroundChange(file, "everyone"); }} style={{ minHeight: 48, borderRadius: 11, border: 0, background: "var(--chakra-colors-brandPrimary)", color: "white", cursor: "pointer", fontWeight: 800 }}>Everyone in this room</button><button type="button" onClick={() => setBackgroundTarget(null)} style={{ minHeight: 40, border: 0, background: "transparent", color: "var(--chakra-colors-textSecondary)", cursor: "pointer" }}>Cancel</button></div></section></div>}
        {confirmation && (
          <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 21000, background: "rgba(0,0,0,.68)", display: "grid", placeItems: "center", padding: 20 }}>
            <div style={{ width: "min(420px, 100%)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.05)", boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
              <h3 style={{ margin: "0 0 8px" }}>{confirmation.title}</h3>
              <p style={{ margin: "0 0 22px", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.5 }}>{confirmation.body}</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setConfirmation(null)} style={{ minHeight: 44, padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "inherit", cursor: "pointer" }}>Cancel</button>
                <button type="button" onClick={() => { confirmation.onConfirm(); setConfirmation(null); }} style={{ minHeight: 44, padding: "9px 14px", borderRadius: 10, border: 0, background: confirmation.tone === "primary" ? "var(--chakra-colors-brandPrimary)" : "#e5484d", color: "white", fontWeight: 700, cursor: "pointer" }}>{confirmation.confirmLabel}</button>
              </div>
            </div>
          </div>
        )}

        {fullscreen && (
          <div
            onClick={() => setFullscreen(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.96)",
              backdropFilter: "blur(12px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 20000,
              animation: "fadeIn 0.25s ease-out",
              padding: "20px",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "24px",
                right: "24px",
                display: "flex",
                gap: "10px",
                zIndex: 10
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {!fullscreen.viewOnce && (
                <>
                  <button
                    type="button"
                    title="Copy media"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (fullscreen.type?.startsWith("image")) {
                        copyImageToClipboard(fullscreen.url);
                      } else {
                        copyLinkToClipboard(fullscreen.url);
                      }
                    }}
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      color: "var(--chakra-colors-textPrimary)",
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.22s ease",
                    }}
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    type="button"
                    title="Download file"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadMedia(fullscreen.url, fullscreen.name);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      color: "var(--chakra-colors-textPrimary)",
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.22s ease",
                    }}
                  >
                    <FaDownload size={16} />
                  </button>
                </>
              )}
              <div
                style={{
                  background: "rgba(255, 107, 107, 0.12)",
                  border: "1px solid rgba(255, 107, 107, 0.22)",
                  color: "var(--chakra-colors-textPrimary)",
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.22s ease",
                }}
                onClick={(e) => { e.stopPropagation(); setFullscreen(null); }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 107, 107, 0.15)";
                  e.currentTarget.style.borderColor = "rgba(255, 107, 107, 0.3)";
                  e.currentTarget.style.color = "#ff8a8a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 107, 107, 0.12)";
                  e.currentTarget.style.borderColor = "rgba(255, 107, 107, 0.22)";
                  e.currentTarget.style.color = "var(--chakra-colors-textPrimary)";
                }}
              >
                <AiOutlineClose />
              </div>
            </div>

            {(fullscreen.type && (fullscreen.type.startsWith("image") || fullscreen.type.startsWith("video"))) && (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  maxWidth: "95%",
                  maxHeight: "85vh",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  filter: "blur(0px)",
                }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
              >
                {fullscreen.type.startsWith("image") ? (
                  <img
                    key={fullscreen.url}
                    alt={fullscreen.name}
                    src={fullscreen.url}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "85vh",
                      objectFit: "contain",
                      borderRadius: "20px",
                      animation: "popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                      pointerEvents: "none",
                      WebkitUserDrag: "none",
                    }}
                  />
                ) : (
                  <video
                    key={fullscreen.url}
                    src={fullscreen.url}
                    controls
                    autoPlay
                    style={{
                      maxWidth: "100%",
                      maxHeight: "85vh",
                      objectFit: "contain",
                      borderRadius: "20px",
                      animation: "popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                      background: "rgba(0, 0, 0, 0.16)",
                    }}
                  />
                )}
                {fullscreen.viewOnce && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gridTemplateRows: "repeat(3, 1fr)",
                      alignItems: "center",
                      justifyItems: "center",
                      opacity: 0.12,
                      color: "#fff",
                      fontFamily: "sans-serif",
                      fontSize: "clamp(0.8rem, 2vw, 1.1rem)",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      transform: "rotate(-25deg)",
                      zIndex: 10,
                      overflow: "hidden",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                    }}
                  >
                    {Array.from({ length: 9 }).map((_, index) => (
                      <div key={index} style={{ whiteSpace: "nowrap" }}>
                        {userName || "Viewer"} • VIEW ONCE
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Gallery ‹ › navigation across all shared photos/videos */}
            {(() => {
              const t = fullscreen.type || "";
              if (!t.startsWith("image") && !t.startsWith("video")) return null;
              const items = getGalleryItems();
              if (items.length < 2) return null;
              const idx = items.findIndex((it) => it.url === fullscreen.url);
              if (idx === -1) return null;
              const go = (dir) => {
                const next = items[(idx + dir + items.length) % items.length];
                setFullscreen({ url: next.url, name: next.name, type: next.type });
              };
              const arrowStyle = {
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 30,
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(10,12,20,0.72)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                color: "#fff",
                fontSize: "1.5rem",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              };
              return (
                <>
                  <button
                    type="button"
                    aria-label="Previous media"
                    onClick={(e) => { e.stopPropagation(); go(-1); }}
                    style={{ ...arrowStyle, left: "12px" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.45)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10,12,20,0.72)"; }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next media"
                    onClick={(e) => { e.stopPropagation(); go(1); }}
                    style={{ ...arrowStyle, right: "12px" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.45)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10,12,20,0.72)"; }}
                  >
                    ›
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      bottom: "16px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 30,
                      padding: "4px 12px",
                      borderRadius: "999px",
                      background: "rgba(10,12,20,0.72)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      color: "rgba(255,255,255,0.85)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {idx + 1} / {items.length}
                  </div>
                </>
              );
            })()}
            {(!fullscreen.type || (!fullscreen.type.startsWith("image") && !fullscreen.type.startsWith("video"))) && (
              <div style={{ textAlign: "center", color: "var(--chakra-colors-textPrimary)", padding: "40px", background: "rgba(255,255,255,0.055)", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.07)", maxWidth: "500px", animation: "popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }} onClick={(e) => e.stopPropagation()}>
                <FaFile size={100} style={{ marginBottom: 20, opacity: 0.3 }} />
                <h2 style={{ marginBottom: 10, fontSize: "1.4rem", fontWeight: 700 }}>{fullscreen.name}</h2>
                <p style={{ opacity: 0.6, marginBottom: 20, lineHeight: 1.6 }}>This file type cannot be previewed in the browser.</p>
                <a
                  href={fullscreen.url}
                  download={fullscreen.name}
                  style={{
                    background: "var(--chakra-colors-brandPrimary)",
                    color: "white",
                    padding: "12px 28px",
                    borderRadius: "12px",
                    textDecoration: "none",
                    fontWeight: "bold",
                    display: "inline-block",
                    transition: "all 0.22s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        )}
      </ChatContainer>

      {viewedByTarget && (
        <div role="presentation" onClick={() => setViewedByTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 10050, display: "grid", placeItems: "center", padding: 16, background: "rgba(0,0,0,.62)", backdropFilter: "blur(8px)" }}>
          <section role="dialog" aria-modal="true" aria-label="Message view details" onClick={(event) => event.stopPropagation()} style={{ width: "min(100%, 390px)", maxHeight: "min(76vh, 560px)", overflow: "auto", borderRadius: 20, border: "1px solid var(--chakra-colors-border)", background: "var(--chakra-colors-cardBg)", boxShadow: "var(--chakra-shadows-cardShadow)", padding: 20, color: "var(--chakra-colors-textPrimary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div><div style={{ fontSize: ".72rem", color: "var(--chakra-colors-textSecondary)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800 }}>Message details</div><h2 style={{ margin: "4px 0 0", fontSize: "1.1rem" }}>Read by {Object.keys(viewedByTarget.viewedBy || {}).length}</h2></div>
              <button type="button" onClick={() => setViewedByTarget(null)} aria-label="Close message details" style={{ minWidth: 40, minHeight: 40, borderRadius: 12, border: "1px solid var(--chakra-colors-border)", background: "var(--chakra-colors-surfaceHover)", color: "inherit", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
            </div>
            <div style={{ borderTop: "1px solid var(--chakra-colors-borderSubtle)" }}>
              {Object.values(viewedByTarget.viewedBy || {}).map((viewer, index) => (
                <div key={`${viewer.name}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 0", borderBottom: "1px solid var(--chakra-colors-borderSubtle)" }}>
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{viewer.name || "Guest"}</div><div style={{ marginTop: 3, color: "var(--chakra-colors-textSecondary)", fontSize: ".78rem" }}>Seen {viewer.timestamp ? new Date(viewer.timestamp).toLocaleString() : "just now"}</div></div>
                  <span aria-hidden="true" style={{ color: "#4fc3f7", fontWeight: 900 }}>✓✓</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {showWhiteboard && (
        <ChunkErrorBoundary>
          <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 9999, color: '#fff' }}>Loading Whiteboard…</div>}>
            <Whiteboard
              socket={socketRef.current}
              roomId={roomId}
              isAdmin={!!ownerToken}
              onClose={() => setShowWhiteboard(false)}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {incomingCall && !showMeeting && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 25000,
          background: "linear-gradient(180deg, rgba(10,10,18,0.97) 0%, rgba(20,20,30,0.99) 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 32, color: "#fff", fontFamily: "inherit"
        }}>
          {/* Caller Avatar */}
          <div style={{
            width: 110, height: 110, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--chakra-colors-brandPrimary), #ff6b81)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2.8rem", fontWeight: 800, color: "#fff",
            boxShadow: "0 0 0 0 rgba(0,191,165,0.4)",
            animation: "callPulse 2s ease-in-out infinite"
          }}>
            {incomingCall.callerAvatar ? (
              <img src={incomingCall.callerAvatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              incomingCall.callerName?.charAt(0)?.toUpperCase() || "?"
            )}
          </div>

          {/* Caller Name */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>
              {incomingCall.callerName}
            </div>
            <div style={{ fontSize: "0.9rem", opacity: 0.6, fontWeight: 500 }}>
              Incoming video call…
            </div>
          </div>

          {/* Accept / Decline Buttons */}
          <div style={{ display: "flex", gap: 48, marginTop: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setIncomingCall(null);
                  if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
                  socketRef.current.emit("decline-call", { roomId });
                }}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "#ff4757", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: "1.5rem", color: "#fff",
                  boxShadow: "0 4px 24px rgba(255,71,87,0.4)",
                  transition: "transform 0.2s"
                }}
              >
                📵
              </button>
              <span style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Decline</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setIncomingCall(null);
                  if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
                  setShowMeeting(true);
                }}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "#2ed573", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: "1.5rem", color: "#fff",
                  boxShadow: "0 4px 24px rgba(46,213,115,0.4)",
                  transition: "transform 0.2s",
                  animation: "callPulse 1.5s ease-in-out infinite"
                }}
              >
                📞
              </button>
              <span style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Accept</span>
            </div>
          </div>

          <style>{`
            @keyframes callPulse {
              0% { box-shadow: 0 0 0 0 rgba(0,191,165,0.4); }
              50% { box-shadow: 0 0 0 20px rgba(0,191,165,0); }
              100% { box-shadow: 0 0 0 0 rgba(0,191,165,0); }
            }
          `}</style>
        </div>
      )}

      {showMeeting && (
        <ChunkErrorBoundary>
          <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 9999, color: '#fff' }}>Loading Meeting…</div>}>
            <LiveMeeting
              socket={socketRef.current}
              roomId={roomId}
              userName={userName}
              isAdmin={!!ownerToken}
              ownerToken={ownerToken}
              userAvatar={userAvatar}
              onClose={closeMeeting}
              features={features}
              roomPlan={roomPlan}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}
      {renderPollCreator()}
      {renderForwardDialog()}

      {showAuditLogs && (
        <div role="presentation" onClick={() => setShowAuditLogs(false)} style={{ position: "fixed", inset: 0, zIndex: 10050, display: "grid", placeItems: "center", padding: 16, background: "rgba(0,0,0,.62)", backdropFilter: "blur(8px)" }}>
          <section role="dialog" aria-modal="true" aria-label="Room Activity Audit Logs" onClick={(event) => event.stopPropagation()} style={{ width: "min(100%, 480px)", maxHeight: "min(76vh, 600px)", display: "flex", flexDirection: "column", borderRadius: 20, border: "1px solid var(--chakra-colors-border)", background: "var(--chakra-colors-cardBg)", boxShadow: "var(--chakra-shadows-cardShadow)", padding: 20, color: "var(--chakra-colors-textPrimary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: ".72rem", color: "#f59e0b", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800 }}>Owner Console</div>
                <h2 style={{ margin: "4px 0 0", fontSize: "1.2rem", fontWeight: 800 }}>Room Activity Audit Logs</h2>
              </div>
              <button type="button" onClick={() => setShowAuditLogs(false)} aria-label="Close logs" style={{ minWidth: 40, minHeight: 40, borderRadius: 12, border: "1px solid var(--chakra-colors-border)", background: "var(--chakra-colors-surfaceHover)", color: "inherit", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", borderTop: "1px solid var(--chakra-colors-borderSubtle)", paddingRight: 4 }}>
              {auditLogs.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "var(--chakra-colors-textSecondary)", fontSize: "0.88rem" }}>
                  No activity logged yet.
                </div>
              ) : (
                auditLogs.map((log, index) => (
                  <div key={`${log.timestamp}-${index}`} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "12px 0", borderBottom: "1px solid var(--chakra-colors-borderSubtle)" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 550, lineHeight: 1.4 }}>{log.message}</div>
                    <div style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "0.7rem" }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
