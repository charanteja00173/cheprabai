import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import styled, { keyframes } from "styled-components";
import {
  FaPaperPlane,
  FaPenNib,
  FaFileUpload,
  FaFile,
  FaSearch,
  FaMicrophone,
  FaStop,
  FaDownload,
} from "react-icons/fa";
import { HiGif } from "react-icons/hi2";
import { FaVideo, FaPlay } from "react-icons/fa";
import image from "../logo192.png";
import notificationSound from "../assets/iphone-sms.mp3";
import { AiOutlineClose } from "react-icons/ai";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ThemeSwitcher from "./ThemeSwitcher";
import { ShieldCheck } from "lucide-react";
// Lazy-load heavy components
const Whiteboard = React.lazy(() => import("./Whiteboard"));
const LiveMeeting = React.lazy(() => import("./LiveMeeting"));

const SECURITY_CODE = process.env.REACT_APP_SECURITY_CODES.split(",");

const urlRegex = /(https?:\/\/[^\s]+)/g;

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
  height: 100%;
  background: var(--chakra-colors-bg);
  box-sizing: border-box;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  padding: clamp(8px, 2vw, 20px);
  min-height: 56px;
  background: var(--chakra-colors-surface);
  color: var(--chakra-colors-textPrimary);
  border-bottom: 1px solid var(--chakra-colors-border);
  box-sizing: border-box;

  @media (max-width: 480px) {
    padding: 6px 10px;
    min-height: 48px;
  }
`;

const Avatar = styled.img`
  width: clamp(28px, 4vw, 32px);
  height: clamp(28px, 4vw, 32px);
  border-radius: 50%;
  margin-right: clamp(6px, 1.5vw, 10px);
`;

const RoomActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: clamp(8px, 2vw, 12px);
  flex-wrap: nowrap;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  font-size: 1.2rem;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }

  @media (max-width: 480px) {
    min-width: 34px;
    min-height: 34px;
    font-size: 1.05rem;
  }
`;

const MessageContainer = styled.div`
  flex: 1;
  padding: clamp(10px, 3vw, 20px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
`;

const MessageBubble = styled.div`
  max-width: ${(p) => (p.isSystem ? "80%" : "clamp(70%, 85vw, 85%)")};
  padding: ${(p) => (p.isSystem ? "6px 12px" : p.isFile ? "8px" : "12px 18px")};

  background: ${(p) =>
    p.isSystem ? "transparent" :
      p.isSender ? "var(--chakra-colors-brandPrimary)" :
        "var(--chakra-colors-surfaceHover)"};

  border: ${(p) =>
    p.isSystem ? "none" :
      p.isSender ? "none" :
        "1px solid var(--chakra-colors-border)"};

  border-radius: ${(p) =>
    p.isSystem ? "12px" :
      p.isSender ? "20px 20px 4px 20px" :
        "20px 20px 20px 4px"};

  box-shadow: ${(p) => p.isSystem ? "none" : "0 4px 15px rgba(0,0,0,0.1)"};

  align-self: ${(p) =>
    p.isSystem ? "center" : p.isSender ? "flex-end" : "flex-start"};

  color: ${(p) =>
    p.isSystem ? (p.systemType === "join" ? "#2ecc71" : "#e74c3c") :
      p.isSender ? "#fff" :
        "var(--chakra-colors-textPrimary)"};

  font-size: ${(p) => (p.isSystem ? "0.8rem" : "clamp(0.9rem, 0.25vw + 0.85rem, 1rem)")};
  font-style: ${(p) => (p.isSystem ? "italic" : "normal")};
  opacity: ${(p) => (p.isSystem ? 0.9 : 1)};
  text-align: left;
  position: relative;
  word-wrap: break-word;

  @media (max-width: 480px) {
    max-width: ${(p) => (p.isSystem ? "90%" : "88%")};
    padding: ${(p) => (p.isSystem ? "4px 10px" : p.isFile ? "6px" : "8px 12px")};
    font-size: ${(p) => (p.isSystem ? "0.75rem" : "0.9rem")};
    border-radius: ${(p) =>
      p.isSystem ? "10px" :
        p.isSender ? "14px 14px 4px 14px" :
          "14px 14px 14px 4px"};
  }
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

const FileCard = styled.div`
  background: var(--chakra-colors-cardBg);
  border-radius: 10px;
  padding: 6px;
  width: 100%;
  box-sizing: border-box;
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

const JoinContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: min(400px, calc(100vw - 40px));
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(24px);
  padding: clamp(24px, 5vw, 40px);
  border-radius: 24px;
  border: 1px solid var(--chakra-colors-border);
  box-shadow: 0 25px 50px rgba(0,0,0,0.5);
  margin: 0 20px;
  box-sizing: border-box;

  @media (max-width: 480px) {
    padding: 16px;
    gap: 12px;
    border-radius: 20px;
  }
`;

const JoinInput = styled.input`
  padding: 14px 20px;
  border-radius: 12px;
  border: 1px solid var(--chakra-colors-border);
  background: var(--chakra-colors-surfaceHover);
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: max(16px, 1rem);
  transition: all 0.2s;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    box-shadow: 0 0 0 1px var(--chakra-colors-brandPrimary);
  }

  ::placeholder {
    color: var(--chakra-colors-textSecondary);
  }

  @media (max-width: 480px) {
    padding: 10px 14px;
    font-size: 0.95rem;
    border-radius: 10px;
  }
`;

const JoinButton = styled.button`
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: var(--chakra-colors-brandPrimary);
  color: #fff;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 10px;
  min-height: 48px;

  &:hover {
    background: var(--chakra-colors-brandHover);
    transform: translateY(-2px);
    box-shadow: var(--chakra-colors-glowShadow);
  }

  @media (max-width: 480px) {
    padding: 10px;
    font-size: 0.95rem;
    min-height: 40px;
    border-radius: 10px;
    margin-top: 6px;
  }
`;

const PreviewOverlay = styled.div`
  position: fixed;
  inset: 0;
  backdrop-filter: blur(4px);
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
`;

const PreviewModal = styled.div`
  background: var(--chakra-colors-surface);
  border-radius: 16px;
  width: min(90%, 500px);
  max-height: 85vh;
  padding: clamp(16px, 4vw, 24px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);

  @media (max-width: 600px) {
    width: 95%;
    max-height: calc(100vh - var(--safe-top) - var(--safe-bottom) - 24px);
  }
`;

const PreviewContent = styled.div`
  max-height: 60vh;
  overflow-y: auto;

  img,
  video {
    max-width: 100%;
    max-height: 50vh;
    object-fit: contain;
    border-radius: 10px;
  }
`;

const PreviewActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const PreviewButton = styled.button`
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: bold;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CancelBtn = styled(PreviewButton)`
  background: #444;
  color: var(--chakra-colors-textPrimary);
`;

const SendBtn = styled(PreviewButton)`
  background: var(--chakra-colors-brandPrimary);
  color: #000;
`;

const MessageInputContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 20px;
  background: var(--chakra-colors-surface);
  border-top: 1px solid var(--chakra-colors-border);
  gap: 10px;
  padding-bottom: calc(10px + var(--safe-bottom));
  
  @media (max-width: 600px) {
    padding: 6px 8px;
    padding-bottom: calc(6px + var(--safe-bottom));
    gap: 4px;

    /* Target nested timer text */
    span {
      font-size: 0.65rem !important;
      min-width: 24px !important;
    }

    /* Target voice record button and timer controls */
    button {
      width: 32px !important;
      height: 32px !important;
      font-size: 0.8rem !important;
    }

    /* Target Ephemeral toggle button specifically */
    button[title*="Ephemeral"] {
      padding: 4px 6px !important;
      font-size: 0.8rem !important;
      border-radius: 12px !important;
    }
  }
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 12px 15px;
  border-radius: 20px;
  border: 1px solid var(--chakra-colors-border);
  background: var(--chakra-colors-bg);
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: max(16px, 0.95rem);

  ::placeholder {
    color: var(--chakra-colors-textSecondary);
  }

  @media (max-width: 600px) {
    padding: 8px 12px;
    font-size: 0.9rem;
    border-radius: 16px;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileUploadLabel = styled.label`
  font-size: 1.3rem;
  cursor: pointer;
  color: var(--chakra-colors-textPrimary);
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  @media (max-width: 480px) {
    min-width: 32px;
    min-height: 32px;
    font-size: 1.15rem;
  }
`;

const SendButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--chakra-colors-brandPrimary);
  color: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;

  &:hover {
    background: var(--chakra-colors-brandHover);
  }

  @media (max-width: 480px) {
    width: 32px;
    height: 32px;
  }
`;
/* ================= GIF PICKER IMPROVED ================= */

const GifPickerOverlay = styled(PreviewOverlay)`
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(5px);
  z-index: 10000;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: max(12px, env(safe-area-inset-top))
           max(12px, env(safe-area-inset-right))
           max(12px, env(safe-area-inset-bottom))
           max(12px, env(safe-area-inset-left));

  @media (min-width: 768px) {
    padding: 0;
  }
`;

const GifPickerModal = styled(PreviewModal)`
  width: 100%;
  max-width: 650px;
  max-height: min(85vh, calc(100vh - var(--safe-top) - var(--safe-bottom) - 30px));

  padding: 16px;
  background: var(--chakra-colors-surface);
  border-radius: 16px;

  display: flex;
  flex-direction: column;
  gap: 12px;

  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);

  overflow: hidden;

  @media (max-width: 600px) {
    width: 95%;
    max-height: calc(100vh - var(--safe-top) - var(--safe-bottom) - 20px);
  }
`;

const GifPickerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const GifSearchInput = styled.input`
  flex: 1;
  padding: 12px 16px;
  border-radius: 25px;
  border: 1px solid var(--chakra-colors-border);
  background: var(--chakra-colors-bg);
  color: var(--chakra-colors-textPrimary);
  font-size: max(16px, 0.95rem);
  outline: none;
  box-sizing: border-box;

  ::placeholder {
    color: var(--chakra-colors-textSecondary);
  }
`;

const SearchGifButton = styled.button`
  background: var(--chakra-colors-brandPrimary);
  border: none;
  color: #000;
  border-radius: 25px;
  padding: 8px 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--chakra-colors-brandHover);
  }
`;

const GifGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(120px, 30vw), 1fr));
  gap: 4px;
  overflow-y: auto;
  max-height: 60vh;
  justify-items: center;
  scroll-behavior: smooth;
`;

const GifCard = styled.div`
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: #000;
  aspect-ratio: 1 / 1;
`;

const GifItem = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.5);
  }
`;

const CardOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;

  ${GifCard}:hover & {
    opacity: 1;
  }
`;

const OverlayButton = styled.button`
  background: var(--chakra-colors-brandPrimary);
  color: #000;
  border: none;
  padding: 6px 12px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: bold;
  opacity: 0.9;
  font-size: 0.85rem;
  transition: all 0.2s;

  &:hover {
    background: var(--chakra-colors-brandHover);
    opacity: 1;
  }
`;

const SearchPopup = styled.div`
  position: absolute;
  top: 56px;
  right: 20px;
  z-index: 100;
  background: var(--chakra-colors-glassBg);
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--chakra-colors-border);
  backdrop-filter: blur(10px);
  display: flex;
  gap: 10px;
  align-items: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);

  @media (max-width: 600px) {
    right: 10px;
    left: 10px;
    width: auto;
  }
`;

const SearchInput = styled.input`
  background: none;
  border: none;
  color: var(--chakra-colors-textPrimary);
  outline: none;
  width: 150px;
  font-size: max(16px, 0.9rem);

  @media (max-width: 600px) {
    flex: 1;
    width: auto;
  }
`;

const RoomInfoDropdown = styled.div`
  position: absolute;
  top: 120%;
  left: 0;
  width: 250px;
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 12px;
  padding: 15px;
  z-index: 1000;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  box-sizing: border-box;

  @media (max-width: 480px) {
    width: calc(100vw - 32px);
    left: -10px;
  }
`;





/* ================= COMPONENT ================= */

export default function ChatRoom() {
  const socketRef = useRef(null);
  const audioRef = useRef(new Audio(notificationSound));
  const userColorsRef = useRef({});

  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);

  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fullscreen, setFullscreen] = useState(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const [ownerToken, setOwnerToken] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);

  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [latency, setLatency] = useState(0);
  const [gifQuery, setGifQuery] = useState("");

  const [gifs, setGifs] = useState([]);
  const [gifOffset, setGifOffset] = useState(0);
  const [hasMoreGifs, setHasMoreGifs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const GIF_LIMIT = 30;

  // ── Ephemeral Messages ──
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const EPHEMERAL_DURATION = 15; // seconds before message self-destructs

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

  const fetchGifs = async (query = "", offset = 0) => {
    const API_KEY = process.env.REACT_APP_GIPHY_API_KEY;
    const url = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${query}&limit=${GIF_LIMIT}&offset=${offset}`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&limit=${GIF_LIMIT}&offset=${offset}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.data.length < GIF_LIMIT) setHasMoreGifs(false); // no more GIFs
      if (offset === 0) setGifs(data.data);
      else setGifs((prev) => [...prev, ...data.data]); // append
    } catch (err) {
    }
  };

  const gifGridRef = useRef(null);

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
    const grid = gifGridRef.current;
    if (!grid) return;

    const handleScroll = () => {
      if (
        grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 10 &&
        hasMoreGifs
      ) {
        fetchGifs(gifQuery, gifOffset + GIF_LIMIT);
        setGifOffset((prev) => prev + GIF_LIMIT);
      }
    };

    grid.addEventListener("scroll", handleScroll);
    return () => grid.removeEventListener("scroll", handleScroll);
  }, [gifOffset, gifQuery, hasMoreGifs]);

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

      // Instagram
      if (u.hostname.includes("instagram.com")) {
        const pIndex = u.pathname.split("/").indexOf("p");
        const reelIndex = u.pathname.split("/").indexOf("reel");
        const idIndex = pIndex > -1 ? pIndex + 1 : (reelIndex > -1 ? reelIndex + 1 : -1);
        if (idIndex !== -1) {
          const id = u.pathname.split("/")[idIndex];
          return { type: "instagram", src: `https://www.instagram.com/p/${id}/embed` };
        }
      }

      // Twitter / X
      if (u.hostname.includes("twitter.com") || u.hostname.includes("x.com")) {
        const tweetId = u.pathname.split("/status/")[1];
        if (tweetId) {
          return { type: "twitter", src: `https://twitframe.com/show?url=${encodeURIComponent(`https://twitter.com/i/status/${tweetId.split("?")[0]}`)}` };
        }
      }

    } catch { }
    return null;
  };

  const handleDestroyRoom = () => {
    if (!roomId || !ownerToken) return;

    // Only the owner gets the confirmation
    const confirmDestroy = window.confirm(
      "Destroy this room? All messages will be lost!",
    );
    if (!confirmDestroy) return;

    // Emit destroy event to server
    socketRef.current.emit("destroyRoom", { roomId, token: ownerToken });

    // Owner also clears local state
    setMessages([]);
    setJoined(false);
  };
  /* ================= SOCKET ================= */

  useEffect(() => {
    socketRef.current = io(process.env.REACT_APP_SOCKET_ENDPOINT || "http://localhost:4000");
    return () => socketRef.current.disconnect();
  }, []);

  // ── Ephemeral message auto-delete timer ──
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => {
        const now = Date.now();
        return prev.filter(m => {
          if (!m.ephemeral) return true;
          return now - m.ts < EPHEMERAL_DURATION * 1000;
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!joined) return;

    socketRef.current.emit("joinRoom", { roomId, userName });

    socketRef.current.on("chatHistory", (history) => {
      const formatted = history.map(msg => ({ ...msg, ...msg.payload }));
      setMessages(formatted);
    });

    socketRef.current.on("hasMoreMessages", () => setHasMoreMessages(true));

    socketRef.current.on("olderMessages", ({ messages: older, hasMore }) => {
      const formatted = older.map(msg => ({ ...msg, ...msg.payload }));
      setMessages(prev => [...formatted, ...prev]);
      setHasMoreMessages(hasMore);
      setLoadingMore(false);
    });

    socketRef.current.on("newMessage", (msg) => {
      const formattedMsg = { ...msg, ...msg.payload };
      setMessages((m) => [...m, formattedMsg]);
      if (msg.userName !== userName) audioRef.current.play().catch(() => { });
    });

    socketRef.current.on("presence", ({ online, count }) => {
      setOnlineUsers(online);
    });

    socketRef.current.on("typing", (users) =>
      setTypingUsers(users.filter((u) => u !== userName)),
    );
    socketRef.current.on("roomDestroyed", () => {
      alert("Room has been destroyed. Reloading...");
      window.location.reload();
    });

    socketRef.current.on("roomOwner", (token) => setOwnerToken(token));

    socketRef.current.on("connect", () => {
      if (joined && roomId && userName) {
        socketRef.current.emit("joinRoom", { roomId, userName });
      }
    });

    socketRef.current.on("disconnect", () => { });

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
      socketRef.current.off();
      clearInterval(pingInterval);
    };
  }, [joined, roomId, userName]);

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

  const uploadFile = async (file) => {
    try {
      const tempId = `uploading-${Date.now()}`;
      setMessages(m => [...m, { id: tempId, userName, file: { name: file.name, loading: true }, ts: Date.now() }]);

      const formData = new FormData();
      formData.append("file", file);
      const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "http://localhost:4000";

      const res = await axios.post(`${backendUrl}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setMessages(m => m.filter(msg => msg.id !== tempId));

      const fileData = { url: res.data.secure_url, name: file.name, type: file.type || res.data.format };
      handleSend({ file: fileData });
    } catch (err) {
      toast.error("File upload failed!");
      setMessages(m => m.filter(msg => !msg.id?.startsWith("uploading-")));
    }
  };

  /* ================= PASTE SUPPORT ================= */

  useEffect(() => {
    const onPaste = (e) => {
      const item = [...e.clipboardData.items].find((i) => i.kind === "file");
      if (item) {
        const file = item.getAsFile();
        setPendingFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  /* ================= SEND ================= */

  const handleSend = async (customData = null) => {
    if (pendingFile) {
      uploadFile(pendingFile);
      setPendingFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!customData && !message.trim()) return;

    const payload = customData || { text: message };

    socketRef.current.emit("sendMessage", {
      payload,
      userName,
      roomId,
      ts: Date.now(),
      ephemeral: ephemeralMode, // ephemeral flag
    });

    if (!customData) setMessage("");
  };

  const handleTyping = (value) => {
    socketRef.current.emit("typing", { isTyping: value.length > 0, roomId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () => socketRef.current.emit("typing", { isTyping: false, roomId }),
      1000,
    );
  };

  /* ================= LOAD MORE MESSAGES ================= */
  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMoreMessages) return;
    setLoadingMore(true);
    socketRef.current.emit("loadMoreMessages", { offset: messages.length });
  }, [loadingMore, hasMoreMessages, messages.length]);

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
  const exportChat = () => {
    const textContent = messages
      .filter(m => m.type !== 'system')
      .map(m => {
        const time = new Date(m.ts).toLocaleString();
        if (m.file) return `[${time}] ${m.userName}: [File: ${m.file.name}]`;
        if (m.gif) return `[${time}] ${m.userName}: [GIF]`;
        return `[${time}] ${m.userName}: ${m.text || ''}`;
      })
      .join('\n');
    const blob = new Blob([`Chat Export — Room: ${roomId}\nExported: ${new Date().toLocaleString()}\n${'─'.repeat(50)}\n\n${textContent}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${roomId}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exported!');
  };

  /* ================= UI ================= */

  if (!joined) {
    return (
      <>
        <ToastContainer position="top-center" />
        <ChatContainer
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <JoinContainer>
            <div style={{ textAlign: "center", marginBottom: "10px" }}>
              <div style={{ display: "inline-flex", background: "rgba(0,191,165,0.1)", padding: "clamp(12px, 3vw, 16px)", borderRadius: "50%", marginBottom: "16px" }}>
                <ShieldCheck size={36} color="var(--chakra-colors-brandPrimary)" />
              </div>
              <h2 style={{ color: "var(--chakra-colors-textPrimary)", margin: 0, fontSize: "clamp(1.4rem, 4vw, 1.8rem)", letterSpacing: "-0.5px" }}>Secure Session</h2>
              <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "clamp(0.85rem, 2vw, 0.95rem)", marginTop: "8px" }}>Enter details to join the encrypted room</p>
            </div>

            <JoinInput
              placeholder="Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />

            <JoinInput
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />

            <JoinInput
              type="password"
              placeholder="Security Code"
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const code = securityCode.trim();
                  if (!SECURITY_CODE.includes(code)) {
                    toast.error("Invalid security code! Please check and try again.");
                    return;
                  }
                  setJoined(true);
                }
              }}
            />

            <JoinButton
              onClick={async () => {
                const code = securityCode.trim();

                if (!SECURITY_CODE.includes(code)) {
                  toast.error(
                    "Invalid security code! Please check and try again.",
                  );
                  return;
                }

                setJoined(true);
              }}
            >
              Join Secure Room
            </JoinButton>
          </JoinContainer>
        </ChatContainer>
      </>
    );
  }

  return (
    <>
      <ChatContainer>
        <Header>
          <Avatar src={image} alt="Logo" />
          <div
            style={{ display: "flex", flexDirection: "column", cursor: "pointer", position: "relative", minWidth: 0 }}
            onClick={() => setShowRoomInfo(!showRoomInfo)}
          >
            <div style={{ fontWeight: "bold", fontSize: "clamp(0.95rem, 3vw, 1.1rem)", display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "clamp(100px, 30vw, 300px)" }}>{roomId}</span>
              <span style={{ fontSize: "0.6rem", opacity: 0.5, flexShrink: 0 }}>▼</span>
            </div>
            <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.8rem)", color: "#aaa" }}>
              {onlineUsers.length} online
            </div>

            {showRoomInfo && (
              <RoomInfoDropdown onClick={(e) => e.stopPropagation()}>
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
                  <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 10 }}>
                    <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 5 }}>Participants</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {onlineUsers.map(u => (
                        <div key={u.id} style={{ background: "var(--chakra-colors-surfaceHover)", padding: "2px 8px", borderRadius: 20, fontSize: "0.7rem" }}>
                          {u.name}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 10, marginTop: 10 }}>
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
                  </div>
                </div>
              </RoomInfoDropdown>
            )}
          </div>

          <RoomActions>
            <ThemeSwitcher />
            {(showWhiteboard || showMeeting) && (
              <LiveBadge>
                <div style={{ width: 6, height: 6, background: "white", borderRadius: "50%" }} />
                LIVE
              </LiveBadge>
            )}

            <ActionButton onClick={() => setShowMeeting(true)} title="Start Video Call">
              <FaVideo />
            </ActionButton>

            <ActionButton onClick={() => setShowWhiteboard(true)} title="Open Whiteboard">
              <FaPenNib />
            </ActionButton>

            <ActionButton onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }} title="Search Messages">
              <FaSearch />
            </ActionButton>

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

            {ownerToken && (
              <ActionButton
                onClick={handleDestroyRoom}
                style={{ color: "red" }}
              >
                {" "}
                ✖{" "}
              </ActionButton>
            )}
          </RoomActions>
        </Header>

        <MessageContainer ref={messagesContainerRef}>
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
          {messages.filter(m => {
            if (!searchQuery) return true;
            if (m.type === "system") return false;
            return m.text?.toLowerCase().includes(searchQuery.toLowerCase());
          }).map((m, i) => {
            const isSystem = m.type === "system";
            const systemType = isSystem ? m.action : null;

            if (isSystem && m.userName === userName) return null;

            return (
              <MessageBubble
                key={i}
                isSender={m.userName === userName}
                isSystem={isSystem}
                systemType={systemType}
                isFile={!!m.file}
              >
                {m.userName !== userName && !isSystem && (
                  <Username color={getColor(m.userName)}>{m.userName}</Username>
                )}

                {isSystem && (
                  <span>
                    {m.userName} {systemType === "join" ? "joined" : "left"} the
                    room
                  </span>
                )}

                {!isSystem &&
                  m.text &&
                  m.text.split(urlRegex).map((part, j) => {
                    if (!part.startsWith("http")) return part;

                    const embed = getEmbedData(part);

                    if (embed) {
                      let aspectRatio = "16 / 9";
                      let width = "100%";
                      let maxHeight = "none";
                      
                      if (embed.type === "spotify") {
                        aspectRatio = "auto";
                        maxHeight = "152px";
                      } else if (embed.type === "tiktok") {
                        aspectRatio = "9 / 16";
                        maxHeight = "500px";
                        width = "min(100%, 320px)";
                      } else if (embed.type === "instagram") {
                        aspectRatio = "1 / 1";
                        maxHeight = "450px";
                        width = "min(100%, 400px)";
                      } else if (embed.type === "twitter") {
                        aspectRatio = "auto";
                        maxHeight = "350px";
                      }

                      return (
                        <div style={{ display: "flex", justifyContent: "center", width: "100%" }} key={j}>
                          <iframe
                            src={embed.src}
                            style={{
                              border: "0px",
                              padding: 0,
                              margin: "8px 0",
                              width: width,
                              height: "auto",
                              aspectRatio: aspectRatio,
                              maxHeight: maxHeight,
                              borderRadius: "12px",
                              background: embed.type === "twitter" ? "#fff" : "transparent"
                            }}
                            title={`${embed.type} embed`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      );
                    }

                    return (
                      <a key={j} href={part} target="_blank" rel="noreferrer">
                        {part}
                      </a>
                    );
                  })}

                {m.gif && (
                  <img
                    src={m.gif}
                    alt="GIF"
                    style={{ maxWidth: "clamp(150px, 50vw, 200px)", borderRadius: 10, marginTop: "8px", cursor: "pointer" }}
                    onClick={() =>
                      setFullscreen({ url: m.gif, type: "image" })
                    }
                  />
                )}

                {m.file && (
                  <div style={{ position: "relative" }}>
                    {m.file.loading ? (
                      <div style={{
                        width: "100%", padding: "20px", background: "var(--chakra-colors-glassBg)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)",
                        display: "flex", flexDirection: "column", gap: "10px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--chakra-colors-textPrimary)", opacity: 0.8 }}>Uploading: {m.file.name}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--chakra-colors-brandPrimary)" }}>...</span>
                        </div>
                        <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "10px", overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `100%`,
                            background: "linear-gradient(90deg, var(--chakra-colors-brandPrimary), #00e5ff, var(--chakra-colors-brandPrimary))",
                            borderRadius: "10px",
                            animation: "pulse 1.5s infinite"
                          }} />
                        </div>
                      </div>
                    ) : (
                      <FileCard onClick={() => setFullscreen(m.file)}>
                        {m.file.type && m.file.type.startsWith("image") ? (
                          <img alt={m.file.name} src={m.file.url} style={{ width: "100%", borderRadius: 8 }} />
                        ) : m.file.type && m.file.type.startsWith("video") ? (
                          <div style={{ position: "relative" }}>
                            <video src={m.file.url} style={{ width: "100%", borderRadius: 8 }} />
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                              <FaPlay style={{ color: "var(--chakra-colors-textPrimary)", fontSize: "2rem" }} />
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            display: "flex", alignItems: "center", gap: "clamp(8px, 3vw, 16px)", padding: "clamp(10px, 3vw, 16px)",
                            background: "rgba(0, 191, 165, 0.08)", borderRadius: "12px", border: "1px solid rgba(0, 191, 165, 0.3)",
                            minWidth: 0
                          }}>
                            <div style={{ fontSize: "clamp(1.8rem, 5vw, 2.5rem)", flexShrink: 0 }}>
                              {m.file.name.match(/\.(xlsx|xls|csv)$/i) ? "📊" :
                                m.file.name.match(/\.(docx|doc)$/i) ? "📝" :
                                  m.file.name.match(/\.(zip|rar|7z)$/i) ? "🗜️" : "📎"}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                              <span style={{ fontWeight: "600", fontSize: "clamp(0.85rem, 2vw, 1rem)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {m.file.name}
                              </span>
                              <span style={{ fontSize: "clamp(0.75rem, 1.8vw, 0.85rem)", color: "var(--chakra-colors-brandPrimary)", marginTop: "4px" }}>
                                {m.userName === userName ? "View Shared File" : "Click to preview & download"}
                              </span>
                            </div>
                          </div>
                        )}
                      </FileCard>
                    )}
                  </div>
                )}

                {/* Voice note inline player */}
                {m.file && m.file.type && m.file.type.startsWith("audio") && (
                  <div style={{ marginTop: 6 }}>
                    <audio
                      src={m.file.url}
                      controls
                      style={{ width: "100%", maxWidth: "min(280px, 100%)", height: 36, borderRadius: 20 }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Timestamp>{new Date(m.ts).toLocaleTimeString()}</Timestamp>
                  {m.ephemeral && (
                    <span style={{
                      fontSize: "0.6rem", color: "#ff6b6b", fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 3
                    }}>
                      💨 {Math.max(0, EPHEMERAL_DURATION - Math.floor((Date.now() - m.ts) / 1000))}s
                    </span>
                  )}
                </div>
              </MessageBubble>
            );
          })}
          {typingUsers.length > 0 && (
            <TypingIndicator>{typingUsers.join(", ")} typing…</TypingIndicator>
          )}
        </MessageContainer>

        {showGifPicker && (
          <GifPickerOverlay onClick={() => setShowGifPicker(false)}>
            <GifPickerModal onClick={(e) => e.stopPropagation()}>
              <GifPickerHeader>
                <GifSearchInput
                  placeholder="Search GIFs..."
                  value={gifQuery}
                  onChange={(e) => setGifQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchGifs(gifQuery)}
                />
                <SearchGifButton onClick={() => fetchGifs(gifQuery)}>
                  <FaSearch />
                </SearchGifButton>
                {/* <CloseGifPickerButton onClick={() => setShowGifPicker(false)}>
                  <AiOutlineClose />
                </CloseGifPickerButton> */}
              </GifPickerHeader>

              <GifGrid ref={gifGridRef}>
                {gifs.map((gif) => (
                  <GifCard key={gif.id}>
                    <GifItem
                      src={gif.images.fixed_height.url}
                      alt={gif.title}
                      loading="lazy"
                    />
                    <CardOverlay>
                      <OverlayButton
                        onClick={() => {
                          handleSend({ text: "", gif: gif.images.fixed_height.url });
                          setShowGifPicker(false);
                        }}
                      >
                        <FaPaperPlane style={{ size: "sm" }} />
                      </OverlayButton>
                    </CardOverlay>
                  </GifCard>
                ))}
              </GifGrid>
            </GifPickerModal>
          </GifPickerOverlay>
        )}

        {pendingFile && (
          <PreviewOverlay onClick={() => setPendingFile(null)}>
            <PreviewModal onClick={(e) => e.stopPropagation()}>
              {/* <h3 style={{ color: "var(--chakra-colors-textPrimary)", margin: 0 , textAlign: 'center'}}>Send file?</h3> */}

              <PreviewContent style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "150px", width: "100%" }}>
                {pendingFile.type && pendingFile.type.startsWith("image") ? (
                  <img alt={pendingFile.name} src={previewUrl} style={{ maxWidth: "100%", maxHeight: "50vh", objectFit: "contain" }} />
                ) : pendingFile.type && pendingFile.type.startsWith("video") ? (
                  <video src={previewUrl} controls style={{ maxWidth: "100%", maxHeight: "50vh" }} />
                ) : pendingFile.type && pendingFile.type.startsWith("audio") ? (
                  <audio src={previewUrl} controls style={{ width: "100%", maxWidth: "320px" }} />
                ) : (
                  <div style={{ textAlign: "center", padding: "20px", width: "100%", boxSizing: "border-box" }}>
                    <FaFile size={50} style={{ color: "var(--chakra-colors-brandPrimary)", marginBottom: "15px" }} />
                    <div style={{ color: "var(--chakra-colors-textPrimary)", fontSize: "1rem", fontWeight: "600", wordBreak: "break-all" }}>
                      {pendingFile.name}
                    </div>
                    <div style={{ color: "#888", fontSize: "0.8rem", marginTop: "8px" }}>
                      {(pendingFile.size / 1024 / 1024).toFixed(2)} MB • Ready to send
                    </div>
                  </div>
                )}
              </PreviewContent>

              <PreviewActions>
                <CancelBtn
                  onClick={() => {
                    setPendingFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <AiOutlineClose />
                </CancelBtn>

                <SendBtn
                  onClick={() => {
                    handleSend();
                    setPendingFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <FaPaperPlane />
                </SendBtn>
              </PreviewActions>
            </PreviewModal>
          </PreviewOverlay>
        )}

        <MessageInputContainer>
          {/* Ephemeral toggle */}
          <button
            onClick={() => { setEphemeralMode(!ephemeralMode); toast.info(ephemeralMode ? 'Ephemeral mode OFF' : 'Ephemeral mode ON — messages vanish in 15s'); }}
            title={ephemeralMode ? "Ephemeral ON (messages vanish in 15s)" : "Ephemeral OFF"}
            style={{
              background: ephemeralMode ? "rgba(255, 107, 107, 0.15)" : "transparent",
              border: ephemeralMode ? "1px solid rgba(255, 107, 107, 0.4)" : "1px solid var(--chakra-colors-border)",
              color: ephemeralMode ? "#ff6b6b" : "var(--chakra-colors-textSecondary)",
              borderRadius: 20, padding: "6px 8px", cursor: "pointer",
              fontSize: "0.9rem", display: "flex", alignItems: "center",
              transition: "all 0.2s", flexShrink: 0
            }}
          >
            💨
          </button>

          <FileUploadLabel htmlFor="file-input">
            <FaFileUpload />
          </FileUploadLabel>

          <FileInput
            ref={fileInputRef}
            id="file-input"
            type="file"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              setPendingFile(null);
              setPreviewUrl(null);

              setPendingFile(file);
              setPreviewUrl(URL.createObjectURL(file));
            }}
          />

          {/* Voice recording button */}
          {isRecording ? (
            <button
              onClick={stopVoiceRecording}
              style={{
                background: "#ff4757", border: "none", color: "white",
                borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "pulse 1.5s infinite", flexShrink: 0
              }}
              title="Stop recording"
            >
              <FaStop size={14} />
            </button>
          ) : (
            <button
              onClick={startVoiceRecording}
              style={{
                background: "transparent", border: "1px solid var(--chakra-colors-border)",
                color: "var(--chakra-colors-textSecondary)",
                borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s", flexShrink: 0
              }}
              title="Record voice note"
            >
              <FaMicrophone size={14} />
            </button>
          )}

          {isRecording && (
            <span style={{ fontSize: "0.75rem", color: "#ff4757", fontWeight: 600, minWidth: 30, flexShrink: 0 }}>
              {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
            </span>
          )}

          <MessageInput
            placeholder={ephemeralMode ? "💨 Ephemeral message..." : "Type a message..."}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping?.(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSend?.()}
            style={ephemeralMode ? { borderColor: "rgba(255, 107, 107, 0.3)" } : {}}
          />
          <FileUploadLabel
            onClick={() => {
              setShowGifPicker(true);
              fetchGifs();
            }}
          >
            <HiGif />
          </FileUploadLabel>

          <SendButton onClick={() => handleSend()}>
            <FaPaperPlane />
          </SendButton>
        </MessageInputContainer>

        <style>{`@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); } }`}</style>

        {fullscreen && (
          <div
            onClick={() => setFullscreen(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.9)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {fullscreen.type.startsWith("image") && (
              <img
                alt={fullscreen.name}
                src={fullscreen.url}
                style={{ maxWidth: "95%", maxHeight: "85vh", objectFit: "contain" }}
              />
            )}
            {fullscreen.type.startsWith("video") && (
              <video
                src={fullscreen.url}
                controls
                autoPlay
                style={{ maxWidth: "95%", maxHeight: "85vh", objectFit: "contain" }}
              />
            )}
            {!fullscreen.type.startsWith("image") && !fullscreen.type.startsWith("video") && (
              <div style={{ textAlign: "center", color: "var(--chakra-colors-textPrimary)", padding: 20 }}>
                <FaFile size={100} style={{ marginBottom: 20, opacity: 0.3 }} />
                <h2 style={{ marginBottom: 10 }}>{fullscreen.name}</h2>
                <p style={{ opacity: 0.6, marginBottom: 20 }}>This file type cannot be previewed in the browser.</p>
                <a
                  href={fullscreen.url}
                  download={fullscreen.name}
                  style={{
                    background: "#2196F3",
                    color: "var(--chakra-colors-textPrimary)",
                    padding: "12px 24px",
                    borderRadius: "12px",
                    textDecoration: "none",
                    fontWeight: "bold",
                    display: "inline-block"
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

      {showWhiteboard && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 9999, color: '#fff' }}>Loading Whiteboard…</div>}>
          <Whiteboard
            socket={socketRef.current}
            roomId={roomId}
            isAdmin={!!ownerToken}
            onClose={() => setShowWhiteboard(false)}
          />
        </Suspense>
      )}

      {showMeeting && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 9999, color: '#fff' }}>Loading Meeting…</div>}>
          <LiveMeeting
            socket={socketRef.current}
            roomId={roomId}
            userName={userName}
            isAdmin={!!ownerToken}
            onClose={() => setShowMeeting(false)}
          />
        </Suspense>
      )}
    </>
  );
}
