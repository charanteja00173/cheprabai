import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { toast } from "react-toastify";
import { BREAKPOINTS } from "../hooks/useIsMobile";
import ReactMarkdown from "react-markdown";
import { safeCopyText } from "../utils/clipboard";
import {
  FaTimes, FaDownload, FaCopy, FaExternalLinkAlt, FaSearchPlus, FaSearchMinus,
  FaCompress, FaExpand, FaFilePdf, FaFileImage, FaFileVideo, FaFileAudio, FaFileCode,
  FaFileWord, FaFileExcel, FaFilePowerpoint, FaFileArchive, FaFileAlt, FaFile,
  FaPlay, FaPause, FaUndo, FaRedo, FaVolumeUp, FaVolumeMute, FaPhotoVideo, FaWindowRestore
} from "react-icons/fa";

/* ═══════════════ ANIMATIONS ═══════════════ */
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
const slideUp = keyframes`
  from { opacity: 0; transform: translateY(18px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;
const spin = keyframes` to { transform: rotate(360deg); } `;

/* ═══════════════ STYLED COMPONENTS ═══════════════ */
const ViewerShell = styled.div`
  position: fixed;
  inset: 0;
  /* True full-screen on phones: dvh tracks dynamic toolbars, fill-available covers iOS Safari */
  height: 100vh;
  height: 100dvh;
  background: #06070b;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  animation: ${fadeIn} 0.2s ease;

  @supports (-webkit-touch-callout: none) {
    height: -webkit-fill-available;
  }
`;

const ViewerHeader = styled.div`
  height: 58px;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: rgba(17, 19, 30, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.07);

  @media (max-width: ${BREAKPOINTS.md}px) {
    height: 52px;
    padding: 0 10px;
  }
`;

const FileIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;

  .icon-badge {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: ${(p) => p.$tintBg || "rgba(99,102,241,0.15)"};
    color: ${(p) => p.$tintFg || "#818cf8"};
    font-size: 0.9rem;
  }

  .meta {
    min-width: 0;
    .name {
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sub {
      color: rgba(255,255,255,0.45);
      font-size: 0.68rem;
      font-weight: 600;
      margin-top: 1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;

  @media (max-width: ${BREAKPOINTS.sm}px) {
    .hide-xs { display: none !important; }
  }
`;

const ActionButton = styled.button`
  height: 36px;
  min-width: 36px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 0.16s ease;
  background: ${(p) => (p.$danger ? "#ef4444" : "rgba(255,255,255,0.055)")};
  border: 1px solid ${(p) => (p.$danger ? "#ef4444" : "rgba(255,255,255,0.07)")};
  color: #fff;

  &:hover {
    background: ${(p) => (p.$danger ? "#dc2626" : "rgba(255,255,255,0.13)")};
    transform: translateY(-1px);
  }
  &:active { transform: scale(0.95); }

  @media (max-width: ${BREAKPOINTS.md}px) {
    padding: 0 9px;
    height: 34px;
  }
`;

const ViewerBody = styled.div`
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  /* Unpadded kinds (web/pdf/office…) stretch edge-to-edge; padded media
     keeps its centered presentation. */
  align-items: ${(p) => (p.$pad === false ? "stretch" : "center")};
  justify-content: ${(p) => (p.$pad === false ? "stretch" : "center")};
  overflow: ${(p) => (p.$pad === false ? "hidden" : "auto")};
  background:
    radial-gradient(circle at 20% 10%, rgba(79,70,229,0.06) 0%, transparent 40%),
    radial-gradient(circle at 80% 90%, rgba(14,165,233,0.05) 0%, transparent 40%),
    #06070b;
  padding: ${(p) => (p.$pad === false ? "0" : "22px")};

  @media (max-width: ${BREAKPOINTS.md}px) {
    padding: ${(p) => (p.$pad === false ? "0" : "12px")};
  }
`;

const MediaStage = styled.div`
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${slideUp} 0.25s cubic-bezier(0.16,1,0.3,1);
`;

const ZoomableImage = styled.img`
  max-width: 100%;
  max-height: calc(100vh - 160px);
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.65);
  transform: scale(${(p) => p.$zoom});
  transition: transform 0.18s ease;
  cursor: grab;
  user-select: none;
  -webkit-user-drag: none;
`;

const StyledVideo = styled.video`
  width: 100%;
  max-width: calc(100vw - 44px);
  max-height: calc(100vh - 170px);
  border-radius: 14px;
  background: #000;
  box-shadow: 0 24px 70px rgba(0,0,0,0.65);
  outline: none;

  @media (max-width: ${BREAKPOINTS.md}px) {
    max-width: calc(100vw - 24px);
    max-height: calc(100vh - 150px);
    border-radius: 10px;
  }
`;

const AudioCard = styled.div`
  width: min(560px, calc(100vw - 32px));
  background: linear-gradient(145deg, rgba(23,25,40,0.97), rgba(13,14,24,0.99));
  border: 1px solid rgba(129,140,248,0.18);
  border-radius: 20px;
  padding: 26px 26px 20px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.6);
  animation: ${slideUp} 0.25s cubic-bezier(0.16,1,0.3,1);

  .art {
    width: 84px;
    height: 84px;
    margin: 0 auto 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4f46e5, #06b6d4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 2rem;
    box-shadow: 0 10px 30px rgba(79,70,229,0.35);
    animation: ${(p) => (p.$playing ? spin : "none")} 6s linear infinite;
  }

  .title {
    text-align: center;
    color: #fff;
    font-weight: 800;
    font-size: 0.95rem;
    margin-bottom: 4px;
    word-break: break-word;
  }

  .seek-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    color: rgba(255,255,255,0.55);
    font-size: 0.72rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;

    input[type="range"] {
      flex: 1;
      accent-color: #818cf8;
      height: 4px;
      cursor: pointer;
    }
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin-top: 14px;
  }

  .ctl {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.15s ease;

    &:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); }
    &.play {
      width: 54px;
      height: 54px;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      border: none;
      color: #fff;
      box-shadow: 0 8px 24px rgba(99,102,241,0.45);
      font-size: 1.05rem;
    }
  }

  .speed-vol {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 14px;
    gap: 10px;

    .speed-btn {
      background: rgba(129,140,248,0.12);
      border: 1px solid rgba(129,140,248,0.25);
      color: #a5b4fc;
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 0.72rem;
      font-weight: 800;
      cursor: pointer;
      &:hover { background: rgba(129,140,248,0.22); }
    }

    .vol {
      display: flex;
      align-items: center;
      gap: 7px;
      color: rgba(255,255,255,0.55);
      input[type="range"] { width: 90px; accent-color: #818cf8; cursor: pointer; }
    }
  }
`;

const DocFrame = styled.iframe`
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  background: #fff;
`;

const WebFrameContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex: 1 1 auto;
  overflow: hidden;
  background: #fff;
`;

const CodePane = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  overflow: auto;
  background: #0c0d14;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
  font-size: 0.82rem;
  line-height: 1.62;

  .gutter {
    padding: 16px 12px;
    background: #08090f;
    color: #3f4657;
    border-right: 1px solid rgba(255,255,255,0.055);
    user-select: none;
    text-align: right;
    position: sticky;
    left: 0;
  }
  pre {
    margin: 0;
    padding: 16px 20px;
    color: #dbe4f0;
    white-space: pre-wrap;
    word-break: break-word;
    flex: 1;
  }
`;

const MarkdownPane = styled.div`
  width: min(860px, 100%);
  max-height: 100%;
  overflow-y: auto;
  background: rgba(15,17,28,0.85);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 28px 32px;
  color: #dbe4f0;
  line-height: 1.7;
  font-size: 0.92rem;

  h1, h2, h3, h4 { color: #fff; margin: 1.1em 0 0.45em; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  a { color: #818cf8; }
  code {
    background: rgba(129,140,248,0.12);
    padding: 2px 6px;
    border-radius: 5px;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.84em;
  }
  pre code { display: block; padding: 14px; background: #0a0b12; overflow-x: auto; }
  blockquote {
    border-left: 3px solid #6366f1;
    margin: 0.8em 0;
    padding: 0.2em 1em;
    color: rgba(255,255,255,0.65);
    background: rgba(99,102,241,0.06);
    border-radius: 0 8px 8px 0;
  }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
  th, td { border: 1px solid rgba(255,255,255,0.08); padding: 7px 12px; text-align: left; }
  th { background: rgba(255,255,255,0.08); }
  img { max-width: 100%; border-radius: 10px; }
  hr { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 1.4em 0; }
`;

const CsvTableWrap = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #0c0d14;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.07);

  table {
    border-collapse: collapse;
    min-width: 100%;
    font-size: 0.8rem;
    color: #dbe4f0;
  }
  th, td {
    border: 1px solid rgba(255,255,255,0.07);
    padding: 8px 14px;
    text-align: left;
    white-space: nowrap;
    max-width: 340px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  th {
    position: sticky;
    top: 0;
    background: #171a2a;
    color: #a5b4fc;
    font-weight: 800;
    z-index: 2;
  }
  tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
`;

const FallbackCard = styled.div`
  width: min(430px, calc(100vw - 32px));
  background: linear-gradient(145deg, rgba(23,25,40,0.97), rgba(13,14,24,0.99));
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 30px 26px;
  text-align: center;
  box-shadow: 0 24px 70px rgba(0,0,0,0.6);
  animation: ${slideUp} 0.25s cubic-bezier(0.16,1,0.3,1);

  .big-icon {
    width: 86px;
    height: 86px;
    margin: 0 auto 18px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.3rem;
    background: ${(p) => p.$tintBg || "rgba(99,102,241,0.15)"};
    color: ${(p) => p.$tintFg || "#818cf8"};
  }

  h3 { color: #fff; margin: 0 0 6px; font-size: 1.02rem; word-break: break-word; }
  .kind { color: ${(p) => p.$tintFg || "#818cf8"}; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px; }
  p { color: rgba(255,255,255,0.55); font-size: 0.78rem; line-height: 1.55; margin: 0 0 18px; }

  .actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
`;

const LoadingPane = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: rgba(255,255,255,0.7);
  font-size: 0.82rem;
  font-weight: 600;

  .ring {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.08);
    border-top-color: #818cf8;
    animation: ${spin} 0.8s linear infinite;
  }
`;

const ErrorPane = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #f87171;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  padding: 20px;
`;

const ZoomHud = styled.div`
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(10,12,20,0.85);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 6px 8px;
  z-index: 5;

  button {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    border: none;
    background: rgba(255,255,255,0.06);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    transition: background 0.15s;
    &:hover { background: rgba(255,255,255,0.16); }
  }
  span {
    color: rgba(255,255,255,0.7);
    font-size: 0.72rem;
    font-weight: 800;
    min-width: 44px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
`;

/* ═══════════════ HELPERS ═══════════════ */
const CODE_EXTS = ["js","jsx","ts","tsx","py","rb","go","rs","java","kt","swift","c","h","cpp","cs","php","sh","bash","zsh","sql","html","htm","css","scss","less","xml","yml","yaml","toml","ini","conf","env","log","diff","r","lua","pl","dart","vue","svelte"];
const TEXT_EXTS = ["txt","md","markdown","csv","tsv","json","geojson","ndjson","rtf"];
const IMAGE_EXTS = ["png","jpg","jpeg","gif","webp","bmp","svg","avif","ico","heic","heif"];
const VIDEO_EXTS = ["mp4","webm","ogv","mov","m4v","mkv","avi","flv","3gp","wmv"];
const AUDIO_EXTS = ["mp3","wav","ogg","oga","m4a","aac","flac","opus","wma","weba"];
const ARCHIVE_EXTS = ["zip","rar","7z","tar","gz","bz2","xz","tgz","iso"];
const OFFICE_EXTS = ["doc","docx","xls","xlsx","ppt","pptx","odt","ods","odp"];

const extOf = (name = "") => (name.split(".").pop() || "").toLowerCase();

const detectKind = (name, type) => {
  const t = (type || "").toLowerCase();
  const e = extOf(name);
  if (t.startsWith("image/") || IMAGE_EXTS.includes(e)) return "image";
  if (t.startsWith("video/") || VIDEO_EXTS.includes(e)) return "video";
  if (t.startsWith("audio/") || AUDIO_EXTS.includes(e)) return "audio";
  if (t === "application/pdf" || e === "pdf") return "pdf";
  if (e === "csv" || e === "tsv") return "csv";
  if (e === "md" || e === "markdown" || t === "text/markdown") return "markdown";
  if (t === "application/json" || e === "json" || e === "geojson" || e === "ndjson") return "json";
  if ((t && t.startsWith("text/")) || CODE_EXTS.includes(e) || TEXT_EXTS.includes(e)) return "text";
  if (OFFICE_EXTS.includes(e)) return "office";
  if (ARCHIVE_EXTS.includes(e) || t.includes("zip") || t.includes("compressed")) return "archive";
  if (t === "application/octet-stream" || !t) return "unknown";
  return "binary";
};

const KIND_META = {
  web:     { icon: <FaExternalLinkAlt />,  fg: "#38bdf8", bg: "rgba(56,189,248,0.14)", label: "Web Page" },
  image:   { icon: <FaFileImage />,        fg: "#34d399", bg: "rgba(52,211,153,0.14)", label: "Image" },
  video:   { icon: <FaFileVideo />,        fg: "#f472b6", bg: "rgba(244,114,182,0.14)", label: "Video" },
  audio:   { icon: <FaFileAudio />,        fg: "#c084fc", bg: "rgba(192,132,252,0.14)", label: "Audio" },
  pdf:     { icon: <FaFilePdf />,          fg: "#f87171", bg: "rgba(248,113,113,0.14)", label: "PDF Document" },
  csv:     { icon: <FaFileExcel />,        fg: "#34d399", bg: "rgba(52,211,153,0.14)", label: "Spreadsheet Data" },
  markdown:{ icon: <FaFileAlt />,          fg: "#60a5fa", bg: "rgba(96,165,250,0.14)", label: "Markdown" },
  json:    { icon: <FaFileCode />,         fg: "#fbbf24", bg: "rgba(251,191,36,0.14)", label: "JSON Data" },
  text:    { icon: <FaFileCode />,         fg: "#818cf8", bg: "rgba(129,140,248,0.14)", label: "Text / Code" },
  office:  { icon: <FaFileWord />,         fg: "#60a5fa", bg: "rgba(96,165,250,0.14)", label: "Office Document" },
  archive: { icon: <FaFileArchive />,      fg: "#fbbf24", bg: "rgba(251,191,36,0.14)", label: "Archive" },
  binary:  { icon: <FaFile />,             fg: "#94a3b8", bg: "rgba(148,163,184,0.14)", label: "Binary File" },
  unknown: { icon: <FaFile />,             fg: "#94a3b8", bg: "rgba(148,163,184,0.14)", label: "File" },
};

const officeKindIcon = (ext) => {
  if (["xls","xlsx","ods","csv"].includes(ext)) return <FaFileExcel />;
  if (["ppt","pptx","odp"].includes(ext)) return <FaFilePowerpoint />;
  return <FaFileWord />;
};

const formatBytes = (n) => {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
};

const formatTime = (s) => {
  if (!isFinite(s)) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// RFC-4180-ish CSV parser (handles quotes + escaped quotes + CRLF)
const parseCsv = (text, delimiter = ",") => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* ═══════════════ SUB-COMPONENTS ═══════════════ */

function AudioPlayer({ url, name }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [speedIdx, setSpeedIdx] = useState(2);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); } else { a.pause(); }
  };

  const skip = (d) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d));
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.volume > 0) { setPrevVolume(a.volume); a.volume = 0; setVolume(0); }
    else { a.volume = prevVolume || 1; setVolume(prevVolume || 1); }
  };

  return (
    <AudioCard $playing={playing}>
      <div className="art"><FaFileAudio /></div>
      <div className="title">{name}</div>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setTime(0); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
      />
      <div className="seek-row">
        <span>{formatTime(time)}</span>
        <input
          type="range" min={0} max={duration || 100} step={0.1}
          value={Math.min(time, duration || 100)}
          onChange={(e) => { const t = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = t; setTime(t); }}
        />
        <span>{formatTime(duration)}</span>
      </div>
      <div className="controls">
        <button className="ctl" onClick={() => skip(-10)} title="Back 10s"><FaUndo /></button>
        <button className="ctl play" onClick={toggle} title={playing ? "Pause" : "Play"}>
          {playing ? <FaPause /> : <FaPlay style={{ marginLeft: 3 }} />}
        </button>
        <button className="ctl" onClick={() => skip(10)} title="Forward 10s"><FaRedo /></button>
      </div>
      <div className="speed-vol">
        <button className="speed-btn" onClick={cycleSpeed}>{SPEEDS[speedIdx]}x</button>
        <div className="vol">
          <span onClick={toggleMute} style={{ cursor: "pointer" }}>
            {volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
          </span>
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => { const v = Number(e.target.value); if (audioRef.current) audioRef.current.volume = v; setVolume(v); }}
          />
        </div>
      </div>
    </AudioCard>
  );
}

function CodeViewer({ url }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error("load failed"); return r.text(); })
      .then((txt) => { if (active) { setContent(txt); setLoading(false); } })
      .catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [url]);

  if (loading) return <LoadingPane><div className="ring" /><span>Loading document…</span></LoadingPane>;
  if (error) return <ErrorPane><span>⚠️ Could not load this document.</span></ErrorPane>;

  const lines = content.split("\n");
  return (
    <CodePane>
      <div className="gutter">
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <pre>{content}</pre>
    </CodePane>
  );
}

function JsonViewer({ url }) {
  const [state, setState] = useState({ loading: true, error: false, pretty: "" });

  useEffect(() => {
    let active = true;
    fetch(url)
      .then((r) => r.text())
      .then((txt) => {
        if (!active) return;
        try {
          setState({ loading: false, error: false, pretty: JSON.stringify(JSON.parse(txt), null, 2) });
        } catch {
          setState({ loading: false, error: false, pretty: txt });
        }
      })
      .catch(() => { if (active) setState({ loading: false, error: true, pretty: "" }); });
    return () => { active = false; };
  }, [url]);

  if (state.loading) return <LoadingPane><div className="ring" /><span>Parsing JSON…</span></LoadingPane>;
  if (state.error) return <ErrorPane><span>⚠️ Could not load this JSON file.</span></ErrorPane>;

  const lines = state.pretty.split("\n");
  return (
    <CodePane>
      <div className="gutter">
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <pre>{state.pretty}</pre>
    </CodePane>
  );
}

function CsvViewer({ url, delimiter }) {
  const [state, setState] = useState({ loading: true, error: false, rows: [] });

  useEffect(() => {
    let active = true;
    fetch(url)
      .then((r) => r.text())
      .then((txt) => {
        if (!active) return;
        const rows = parseCsv(txt, delimiter).slice(0, 5000);
        setState({ loading: false, error: false, rows });
      })
      .catch(() => { if (active) setState({ loading: false, error: true, rows: [] }); });
    return () => { active = false; };
  }, [url, delimiter]);

  if (state.loading) return <LoadingPane><div className="ring" /><span>Loading spreadsheet…</span></LoadingPane>;
  if (state.error) return <ErrorPane><span>⚠️ Could not load this spreadsheet.</span></ErrorPane>;
  if (!state.rows.length) return <ErrorPane><span>This spreadsheet is empty.</span></ErrorPane>;

  const [header, ...body] = state.rows;
  return (
    <CsvTableWrap>
      <table>
        <thead>
          <tr>{header.map((h, i) => <th key={i}>{h || `Column ${i + 1}`}</th>)}</tr>
        </thead>
        <tbody>
          {body.slice(0, 2000).map((row, ri) => (
            <tr key={ri}>
              {header.map((_, ci) => <td key={ci}>{row[ci] ?? ""}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {body.length > 2000 && (
        <div style={{ padding: "10px 14px", color: "rgba(255,255,255,0.45)", fontSize: "0.72rem", fontWeight: 700 }}>
          Showing first 2,000 of {body.length.toLocaleString()} rows — download for full data.
        </div>
      )}
    </CsvTableWrap>
  );
}

function MarkdownViewer({ url }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(); return r.text(); })
      .then((txt) => { if (active) { setContent(txt); setLoading(false); } })
      .catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [url]);

  if (loading) return <LoadingPane><div className="ring" /><span>Loading markdown…</span></LoadingPane>;
  if (error) return <ErrorPane><span>⚠️ Could not load this markdown file.</span></ErrorPane>;

  return (
    <MarkdownPane>
      <ReactMarkdown>{content}</ReactMarkdown>
    </MarkdownPane>
  );
}

function ImageViewer({ url, name }) {
  const [zoom, setZoom] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)));
      if (e.key === "-") setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)));
      if (e.key === "0") setZoom(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (error) return <ErrorPane><span>⚠️ This image could not be displayed.</span></ErrorPane>;

  return (
    <>
      <MediaStage>
        {!loaded && <LoadingPane><div className="ring" /><span>Loading image…</span></LoadingPane>}
        <ZoomableImage
          src={url}
          alt={name}
          $zoom={zoom}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ display: loaded ? "block" : "none" }}
          draggable={false}
        />
      </MediaStage>
      {loaded && (
        <ZoomHud onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="Zoom out"><FaSearchMinus /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))} title="Zoom in"><FaSearchPlus /></button>
          <button onClick={() => setZoom(1)} title="Reset zoom"><FaCompress /></button>
        </ZoomHud>
      )}
    </>
  );
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
export default function UniversalFileViewer({ url, name, type, size, mode, embedSrc, onClose }) {
  const kind = useMemo(() => (mode === "web" ? "web" : detectKind(name, type)), [mode, name, type]);
  const meta = KIND_META[kind] || KIND_META.unknown;
  const ext = extOf(name);
  const shellRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef(null);
  const pipSupported = typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled;
  const handlePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
        toast.success("📺 Playing in Picture-in-picture");
      }
    } catch (e) {
      toast.error("Picture-in-picture isn't available for this video");
    }
  }, []);

  // Floating window for OPENED WEBSITES via the Document Picture-in-Picture
  // API (Chromium). The page loads fresh inside the always-on-top mini
  // window; cookies/session are shared so logged-in sites stay logged in.
  const webPipSupported = typeof window !== "undefined" && "documentPictureInPicture" in window;
  const handleWebPip = useCallback(async () => {
    try {
      if (!webPipSupported) throw new Error("unsupported");
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 520,
        height: 360
      });
      // Copy theme colors so the mini window blends with our dark UI
      const doc = pipWin.document;
      doc.body.style.margin = "0";
      doc.body.style.background = "#06070b";
      doc.body.style.overflow = "hidden";
      const frame = doc.createElement("iframe");
      frame.src = url;
      frame.allow = "autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.style.cssText = "width:100%;height:100%;border:0;display:block;background:#fff;";
      doc.body.appendChild(frame);
      pipWin.addEventListener("pagehide", () => {
        try { frame.src = "about:blank"; } catch (e2) {}
      });
      toast.success("📺 Floating window opened");
    } catch (e) {
      toast.error("Floating window isn't supported in this browser");
    }
  }, [url, webPipSupported]);
  // Desktop-mode emulation: render the page in a wide virtual viewport and scale
  // it down, so phones get the DESKTOP layout instead of a squeezed mobile one.

  // Track native fullscreen state (user can also exit via Esc/F11)
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Esc: exit fullscreen first; only close the viewer when not fullscreen
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      } else if (shellRef.current?.requestFullscreen) {
        shellRef.current.requestFullscreen().catch(() => {});
      }
    } catch { /* unsupported — no-op */ }
  }, []);

  const handleDownload = useCallback(() => {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = name || "file";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("⬇ Download started");
    } catch {
      window.open(url, "_blank");
    }
  }, [url, name]);

  const handleCopy = useCallback(async () => {
    const ok = await safeCopyText(url);
    if (ok) toast.success("Link copied!");
    else toast.error("Could not copy link");
  }, [url]);

  const isBlob = typeof url === "string" && url.startsWith("blob:");

  // Web links have no filename — show a clean host/path identity instead
  const displayName = useMemo(() => {
    if (name) return name;
    if (kind === "web") {
      try {
        const u = new URL(url);
        const path = u.pathname.replace(/\/+$/, "");
        const tail = path && path !== "/" ? ` — ${decodeURIComponent(path.split("/").pop() || "")}` : "";
        return `${u.hostname.replace(/^www\./, "")}${tail}`.slice(0, 60);
      } catch (e) {
        return url.slice(0, 50);
      }
    }
    return "Untitled file";
  }, [name, kind, url]);

  const renderBody = () => {
    switch (kind) {
      case "web":
        return (
          <WebFrameContainer>
            <DocFrame
              src={embedSrc || url}
              title={`Web Previewer — ${displayName || name || url}`}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </WebFrameContainer>
        );

      case "image":
        return <ImageViewer url={url} name={name} />;

      case "video":
        return (
          <MediaStage style={{ width: "100%" }}>
            <StyledVideo ref={videoRef} src={url} controls autoPlay playsInline />
          </MediaStage>
        );

      case "audio":
        return <AudioPlayer url={url} name={name} />;

      case "pdf":
        return (
          <DocFrame
            src={`${url}#toolbar=1&view=FitH`}
            title={`PDF Previewer — ${name}`}
          />
        );

      case "json":
        return <JsonViewer url={url} />;

      case "csv":
        return <CsvViewer url={url} delimiter={ext === "tsv" ? "\t" : ","} />;

      case "markdown":
        return <MarkdownViewer url={url} />;

      case "text":
        return <CodeViewer url={url} />;

      case "office": {
        // Office Web Viewer needs a publicly reachable URL — blob: URLs can't be rendered remotely.
        if (isBlob) {
          return (
            <FallbackCard $tintBg={meta.bg} $tintFg={meta.fg}>
              <div className="big-icon">{officeKindIcon(ext)}</div>
              <h3>{name}</h3>
              <div className="kind">{meta.label}</div>
              <p>
                This decrypted document lives only inside your browser (end-to-end encrypted),
                so it can't be sent to an external renderer. Download it to view with full fidelity,
                or open it locally after downloading.
              </p>
              <div className="actions">
                <ActionButton onClick={handleDownload}><FaDownload /> Download</ActionButton>
                <ActionButton onClick={onClose}>Close</ActionButton>
              </div>
            </FallbackCard>
          );
        }
        const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
        return <DocFrame src={officeUrl} title={`Office Previewer — ${name}`} />;
      }

      case "archive":
      case "binary":
      case "unknown":
      default:
        return (
          <FallbackCard $tintBg={meta.bg} $tintFg={meta.fg}>
            <div className="big-icon">{meta.icon}</div>
            <h3>{name}</h3>
            <div className="kind">{meta.label}{type ? ` · ${type}` : ""}</div>
            <p>
              {kind === "archive"
                ? "Archives can't be previewed safely in the browser. Download to extract its contents."
                : "There's no in-browser preview available for this format, but you can download it or open it externally."}
            </p>
            <div className="actions">
              <ActionButton onClick={handleDownload}><FaDownload /> Download</ActionButton>
              {!isBlob && (
                <ActionButton onClick={() => window.open(url, "_blank", "noopener")}>
                  <FaExternalLinkAlt /> Open External
                </ActionButton>
              )}
            </div>
          </FallbackCard>
        );
    }
  };

  const paddedBody = ["image", "video", "audio"].includes(kind) ||
    kind === "office" || kind === "archive" || kind === "binary" || kind === "unknown";

  return (
    <ViewerShell ref={shellRef} onClick={onClose}>
      {!isFullscreen && (
      <ViewerHeader onClick={(e) => e.stopPropagation()}>
        <FileIdentity $tintBg={meta.bg} $tintFg={meta.fg}>
          <div className="icon-badge">{meta.icon}</div>
          <div className="meta">
            <div className="name">{displayName}</div>
            <div className="sub">
              {meta.label}{size ? ` · ${formatBytes(size)}` : ""}{type && kind !== type ? ` · ${type}` : ""}
            </div>
          </div>
        </FileIdentity>

        <HeaderActions>
          <ActionButton onClick={handleCopy} title="Copy link" className="hide-xs">
            <FaCopy /> <span>Copy</span>
          </ActionButton>
          <ActionButton onClick={handleDownload} title="Download">
            <FaDownload />
          </ActionButton>
          {!isBlob && (
            <ActionButton
              onClick={() => window.open(url, "_blank", "noopener")}
              title="Open in new tab"
              className="hide-xs"
            >
              <FaExternalLinkAlt />
            </ActionButton>
          )}
          {kind === "video" && pipSupported && (
            <ActionButton onClick={handlePip} title="Picture-in-picture">
              <FaPhotoVideo />
            </ActionButton>
          )}
          {kind === "web" && webPipSupported && (
            <ActionButton onClick={handleWebPip} title="Pop out to floating window">
              <FaWindowRestore />
            </ActionButton>
          )}
          <ActionButton onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}>
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </ActionButton>
          <ActionButton $danger onClick={onClose} title="Close (Esc)">
            <FaTimes />
          </ActionButton>
        </HeaderActions>
      </ViewerHeader>
      )}

      {isFullscreen && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          title="Exit fullscreen (Esc)"
          style={{
            position: "absolute", top: 14, right: 14, zIndex: 20,
            display: "flex", alignItems: "center", gap: 7,
            background: "rgba(10,12,20,.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.85)",
            fontSize: ".74rem", fontWeight: 700, padding: "7px 14px", borderRadius: 999,
            cursor: "pointer", boxShadow: "0 8px 26px rgba(0,0,0,.4)"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(30,34,52,.9)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10,12,20,.72)"; }}
        >
          <FaCompress size={12} /> Exit
        </button>
      )}

      <ViewerBody $pad={paddedBody} onClick={(e) => e.stopPropagation()}>
        {renderBody()}
      </ViewerBody>
    </ViewerShell>
  );
}
