import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { io } from "socket.io-client";
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
  FaFile,
  FaSearch,
  FaMicrophone,
  FaDownload,
  FaEye,
  FaEyeSlash,
  FaSignOutAlt,
  FaReply,
  FaTrash,
  FaThumbtack,
  FaPen,
  FaShare,
  FaBookmark,
  FaRegBookmark
} from "react-icons/fa";
import { HiGif } from "react-icons/hi2";
import { FaVideo } from "react-icons/fa";
import notificationSound from "../assets/iphone-sms.mp3";
import image from "../logo192.png";
import { AiOutlineClose } from "react-icons/ai";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ThemeSwitcher from "./ThemeSwitcher";
import { ArrowRight, Copy, Hash, KeyRound, LockKeyhole, ShieldCheck, Upload, UserRound } from "lucide-react";
import {
  generateKeyFromSecret,
  encryptMessage,
  decryptMessage,
  encryptBinary,
  decryptBinary,
  exportKey,
  importKey
} from "../utils/crypto";
import { copyRoomShareLink, parseRoomRouteParams } from "../utils/shareLink";
import { ImNewTab } from "react-icons/im";
import { AiFillCloseSquare } from "react-icons/ai";
// Lazy-load heavy components
const Whiteboard = React.lazy(() => import("./Whiteboard"));
const LiveMeeting = React.lazy(() => import("./LiveMeeting"));

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

  @media (max-width: 480px) {
    padding: 6px 10px;
    min-height: 46px;
  }

  @media (max-width: 375px) {
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

  @media (max-width: 480px) {
    width: 26px;
    height: 26px;
    margin-right: 6px;
  }

  @media (max-width: 375px) {
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
  flex-shrink: 0;

  @media (max-width: 480px) {
    gap: 6px;
  }

  @media (max-width: 375px) {
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

  @media (max-width: 480px) {
    min-width: 30px;
    min-height: 30px;
    font-size: 0.85rem;
    border-radius: 8px;
  }

  @media (max-width: 375px) {
    min-width: 28px;
    min-height: 28px;
    font-size: 0.8rem;
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
`;

const MessageBubble = styled.div`
  max-width: ${(p) => (p.$isSystem ? "80%" : "clamp(70%, 80vw, 80%)")};
  padding: ${(p) => (p.$isSystem ? "6px 14px" : p.$isFile ? "0" : "10px 14px")};

  background: ${(p) =>
    p.$isSystem ? "transparent" :
      p.$isSender ? "linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary))" :
        "var(--chakra-colors-badgeBg)"};
  
  backdrop-filter: ${(p) => (p.$isSystem ? "none" : p.$isSender ? "none" : "blur(16px)")};
  -webkit-backdrop-filter: ${(p) => (p.$isSystem ? "none" : p.$isSender ? "none" : "blur(16px)")};

  border: ${(p) =>
    p.$isSystem ? "none" :
      p.$isSender ? "0.5px solid rgba(255, 255, 255, 0.05)" :
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
    transform: ${(p) => (p.$isSystem ? "none" : "translateY(-1px)")};
    box-shadow: ${(p) => p.$isSystem ? "none" : "0 10px 30px rgba(0,0,0,0.25)"};
  }

  @media (max-width: 480px) {
    max-width: ${(p) => (p.$isSystem ? "90%" : "88%")};
    padding: ${(p) => (p.$isSystem ? "4px 10px" : p.$isFile ? "8px" : "10px 14px")};
    font-size: ${(p) => (p.$isSystem ? "0.75rem" : "0.92rem")};
    border-radius: ${(p) =>
    p.$isSystem ? "10px" :
      p.$isSender ? "16px 16px 4px 16px" :
        "16px 16px 16px 4px"};
  }

  @media (max-width: 375px) {
    max-width: ${(p) => (p.$isSystem ? "95%" : "92%")};
    padding: ${(p) => (p.$isSystem ? "4px 8px" : p.$isFile ? "0" : "8px 12px")};
    font-size: ${(p) => (p.$isSystem ? "0.72rem" : "0.88rem")};
  }

  ${p => p.$isFile && `
    width: min(75vw, 420px);
    max-width: min(75vw, 420px);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding: 0 !important;
    border-color: rgba(255,255,255,.05);
    overflow: hidden;
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

  @media (max-width: 768px) {
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
    background: ${(p) => p.$danger ? "rgba(255, 71, 87, 0.15)" : p.$active ? "rgba(255, 165, 0, 0.18)" : "var(--chakra-colors-surfaceHover)"};
    color: ${(p) => p.$danger ? "#ff6b6b" : p.$active ? "#ffa500" : "var(--chakra-colors-brandPrimary)"};
    border-color: ${(p) => p.$danger ? "rgba(255, 107, 107, 0.3)" : p.$active ? "rgba(255, 165, 0, 0.35)" : "var(--chakra-colors-brandPrimary)"};
    transform: translateY(-1.5px) scale(1.05);
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
    border: 1px solid rgba(255, 255, 255, 0.1);
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

const LandingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  min-height: 100dvh;
  height: auto;
  position: relative;
  background: var(--chakra-colors-bg);
  overflow: auto;
  padding: 24px 0;
  box-sizing: border-box;

  @media (max-width: 480px) {
    align-items: center;
    padding: 16px 0;
    overscroll-behavior: contain;
    background: var(--chakra-colors-bg);
    &::before, &::after { display: none; }
  }

  /* Digital grid pattern overlay */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 30px 30px;
    background-position: center center;
    pointer-events: none;
    z-index: 1;
  }

  /* Animated glowing mesh gradients */
  &::after {
    content: "";
    position: absolute;
    width: clamp(200px, 40vw, 400px);
    height: clamp(200px, 40vw, 400px);
    background: radial-gradient(circle, var(--chakra-colors-brandPrimary) 0%, transparent 70%);
    opacity: 0.16;
    filter: blur(50px);
    top: 15%;
    left: 15%;
    animation: floating-glow-1 14s infinite alternate ease-in-out;
    pointer-events: none;
    z-index: 0;
  }
`;

const FloatingBlob = styled.div`
  position: absolute;
  width: clamp(250px, 45vw, 500px);
  height: clamp(250px, 45vw, 500px);
  background: radial-gradient(circle, var(--chakra-colors-brandSecondary) 0%, transparent 75%);
  opacity: 0.1;
  filter: blur(60px);
  bottom: 10%;
  right: 10%;
  animation: floating-glow-2 18s infinite alternate ease-in-out;
  pointer-events: none;
  z-index: 0;

  @media (max-width: 480px) { display: none; }
`;

const JoinContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: min(420px, calc(100vw - 32px));
  background: var(--chakra-colors-surface);
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  padding: clamp(20px, 4vw, 32px);
  border-radius: 22px;
  border: 1px solid var(--chakra-colors-border);
  box-shadow: 
    0 4px 30px rgba(0, 0, 0, 0.15),
    0 25px 60px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 var(--chakra-colors-borderSubtle);
  margin: 0 16px;
  box-sizing: border-box;
  z-index: 2;
  position: relative;

  @media (max-width: 480px) {
    width: calc(100vw - 32px);
    max-width: none;
    margin: 0 16px;
    padding: 24px 20px;
    gap: 12px;
    border-radius: 18px;
  }

  @media (min-width: 900px) {
    max-width: 440px;
    padding: 34px;
  }
`;

const JoinInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  min-height: 46px;
  padding: 12px 14px 12px 42px;
  border-radius: 11px;
  border: 1px solid var(--chakra-colors-border);
  background: var(--chakra-colors-badgeBg);
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 0.92rem;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    border-color: var(--chakra-colors-brandSecondary);
    background: var(--chakra-colors-surfaceHover);
  }

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 
      0 0 0 1px var(--chakra-colors-brandPrimary),
      0 0 15px var(--chakra-colors-brandGlow);
  }

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    opacity: 0.6;
  }

  @media (max-width: 480px) {
    padding: 10px 14px 10px 42px;
    font-size: 0.9rem;
    min-height: 42px;
    border-radius: 10px;
  }
`;

const JoinField = styled.div`
  position: relative;
  display: grid;
  gap: 7px;
`;

const JoinLabel = styled.label`
  color: var(--chakra-colors-textSecondary);
  font-size: .78rem;
  font-weight: 750;
  letter-spacing: .015em;
`;

const FieldIcon = styled.span`
  position: absolute;
  left: 15px;
  bottom: 16px;
  color: var(--chakra-colors-textSecondary);
  display: grid;
  place-items: center;
  pointer-events: none;
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
  padding: 12px;
  border-radius: 11px;
  border: none;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 4px;
  min-height: 46px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0; left: -100%; width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    transition: 0.5s;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 8px 25px rgba(0, 0, 0, 0.4),
      0 0 20px var(--chakra-colors-brandGlow);
    &::after {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 480px) {
    padding: 10px;
    font-size: 0.9rem;
    min-height: 42px;
    border-radius: 10px;
    margin-top: 4px;
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

  @media (max-width: 600px) {
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
      ? "1fr"
      : "repeat(auto-fit, minmax(240px, 1fr))"
  };
  justify-items: center;
  align-items: ${(props) => (props.$singleFile ? "stretch" : "center")};
  justify-content: center;
  gap: 18px;
  padding: 24px;
  width: 100%;
  align-content: ${(props) => (props.$singleFile ? "center" : "start")};

  @media (max-width: 767px) {
    padding: 16px;
    gap: 12px;
    display: ${(props) => (props.$singleFile ? "grid" : "flex")};
    flex-direction: ${(props) => (props.$singleFile ? "unset" : "column")};
    grid-template-columns: ${(props) => (props.$singleFile ? "1fr" : "unset")};
    align-content: start;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
`;

const PreviewCard = styled.div`
  position: relative;
  width: 100%;
  height: ${(props) => (props.$singleFile ? "100%" : "auto")};
  min-height: ${(props) => (props.$singleFile ? "420px" : "220px")};
  display: flex;
  flex-direction: column;
  border-radius: ${(props) => (props.$singleFile ? "20px" : "22px")};
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  box-shadow: var(--chakra-shadows-cardShadow);
  overflow: hidden;
  transition: all 0.24s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform, border-color;
  backface-visibility: hidden;

  @media (hover: hover) {
    &:hover {
      transform: ${(props) => (props.$singleFile ? "none" : "translateY(-3px)")};
      border-color: var(--chakra-colors-brandPrimary);
      box-shadow: var(--chakra-shadows-cardShadowHover);
    }
  }

  @media (max-width: 767px) {
    min-height: ${(props) => (props.$singleFile ? "320px" : "auto")};
    max-height: none;
    flex-shrink: 0;
    flex-direction: ${(props) => (props.$singleFile ? "column" : "row")};
    align-items: ${(props) => (props.$singleFile ? "stretch" : "center")};
  }
`;

const PreviewMediaWrapper = styled.div`
  position: relative;
  width: ${(props) => (props.$singleFile ? "100%" : "100%")};
  height: ${(props) => (props.$singleFile ? "360px" : "160px")};
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0.08) 100%);
  overflow: hidden;

  @media (max-width: 767px) {
    height: ${(props) => (props.$singleFile ? "260px" : "80px")};
    width: ${(props) => (props.$singleFile ? "100%" : "80px")};
    min-width: ${(props) => (props.$singleFile ? "auto" : "80px")};
    border-radius: ${(props) => (props.$singleFile ? "0" : "12px")};
    flex-shrink: 0;
  }
`;

const PreviewMedia = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: transparent;
  user-select: none;
  -webkit-user-drag: none;
`;

const PreviewVideo = styled.video`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: rgba(0, 0, 0, 0.08);
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

  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
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

  @media (max-width: 600px) {
    padding: 8px 12px;
    padding-bottom: calc(8px + var(--safe-bottom));
    gap: 8px;
  }

  @media (max-width: 480px) {
    padding: 6px 8px;
    padding-bottom: calc(6px + var(--safe-bottom));
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

  &:focus-within {
    border-color: var(--chakra-colors-brandPrimary);
    box-shadow: 
      inset 0 2px 4px rgba(0, 0, 0, 0.05),
      0 0 15px var(--chakra-colors-brandGlow);
    background: var(--chakra-colors-surface);
  }

  @media (max-width: 480px) {
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

  @media (max-width: 480px) {
    justify-content: center;
    gap: 14px;
    padding: 8px 12px;
    flex-wrap: wrap;
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

  @media (max-width: 480px) {
    width: 28px;
    height: 28px;
    font-size: 0.95rem;
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

  @media (max-width: 480px) {
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

const MessageInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 0.95rem;
  box-shadow: none;

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    opacity: 0.6;
  }

  @media (max-width: 480px) {
    padding: 6px 8px;
    font-size: 0.9rem;
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
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.3);
    box-shadow: none;
  }

  @media (max-width: 480px) {
    width: 34px;
    height: 34px;
    font-size: 0.85rem;
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

  @media (max-width: 767px) {
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

  @media (max-width: 480px) {
    width: 220px;
    bottom: 50px;
    right: -10px;
  }
`;

const GifDrawerHandle = styled.div`
  display: none;
  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
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

  @media (max-width: 767px) {
    padding: 10px 14px 10px 36px;
    border-radius: 12px;
  }
`;



const GifGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-top: 10px;
  padding: 0 20px 18px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  align-items: start;
  flex: 1;
  min-height: 0;

  @media (max-width: 767px) {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    padding: 0 14px 18px;
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
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: transform 0.2s ease, box-shadow 0.25s ease, border-color 0.25s ease;

  &:before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
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
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 0 0 4px rgba(255, 255, 255, 0.06);
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

  @media (max-width: 600px) {
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

  @media (max-width: 600px) {
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

  @media (max-width: 600px) {
    top: calc(54px + env(safe-area-inset-top));
    left: max(10px, env(safe-area-inset-left));
    width: min(420px, calc(100vw - 20px));
    max-height: calc(100dvh - 68px - env(safe-area-inset-top));
    padding: 16px;
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
  flex: 1 1 auto;
  overflow: hidden;
  padding: 2px 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  // &:hover, &:focus-visible {
  //   background: rgba(255, 255, 255, 0.07);
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
          const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";
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
      } catch { /* The textual fallback remains available. */ }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [reply.file, reply.gif, roomKey]);

  if (reply.file?.viewOnce) {
    return <div aria-label="View-once media" style={{ width: 38, height: 38, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(5,150,105,.16)", color: "#86efac", flexShrink: 0, fontSize: ".72rem", fontWeight: 800 }}>LOCK</div>;
  }
  if (url && (reply.gif || reply.file?.type?.startsWith("image/"))) return <img src={url} alt="Replied attachment" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} />;
  if (url && reply.file?.type?.startsWith("video/")) return <video src={`${url}#t=0.1`} muted playsInline style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} />;
  return reply.file ? <div style={{ width: 42, height: 42, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,.09)", fontSize: ".62rem", fontWeight: 800 }}>FILE</div> : null;
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
                backgroundColor: activeCategory === cat.category ? "rgba(255,255,255,.08)" : "transparent",
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
        const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";
        const res = await fetch(`${backendUrl}/api/link-preview?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error("Preview fetch failed");
        const data = await res.json();
        if (!cancelled) setPreview(data);
      } catch {
        // Silently fail — we'll show a basic link card
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPreview();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div style={{
        marginTop: 10,
        padding: 14,
        borderRadius: 12,
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)"
      }}>
        <div style={{ fontWeight: 600, wordBreak: "break-all", fontSize: "0.9rem" }}>{url}</div>
        <div style={{ marginTop: 8, fontSize: "0.75rem", opacity: 0.5 }}>Loading preview…</div>
      </div>
    );
  }

  if (!preview || (!preview.title && !preview.description)) {
    return (
      <div style={{
        marginTop: 10,
        padding: 14,
        borderRadius: 12,
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)"
      }}>
        <div style={{ fontWeight: 600, wordBreak: "break-all" }}>{url}</div>
        {renderLinkActions(url)}
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        marginTop: 10,
        borderRadius: 14,
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.08)",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 0.2s ease",
        cursor: "pointer"
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,.2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,.08)"; }}
    >
      {preview.image && (
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
      )}
      <div style={{ padding: "12px 14px" }}>
        {preview.siteName && (
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>
            {preview.siteName}
          </div>
        )}
        {preview.title && (
          <div style={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.35, marginBottom: 4 }}>
            {preview.title}
          </div>
        )}
        {preview.description && (
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
      </div>
    </a>
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
    <div style={{ background: "rgba(20, 20, 30, 0.35)", borderRadius: "14px", padding: "12px", border: "1px solid rgba(255,255,255,0.06)", width: "100%", boxSizing: "border-box" }}>
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
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
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
    const response = await fetch(decryptedUrl);
    const blob = await response.blob();
    if (blob.type.includes("png")) {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
      toast.success("📋 Image copied to clipboard!");
    } else {
      await navigator.clipboard.writeText(decryptedUrl);
      toast.success("📋 Image URL copied to clipboard!");
    }
  } catch (err) {
    console.error(err);
    try {
      await navigator.clipboard.writeText(decryptedUrl);
      toast.success("📋 Image link copied!");
    } catch (e2) {
      toast.error("Failed to copy image.");
    }
  }
};

const copyLinkToClipboard = async (url) => {
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("📋 Link copied to clipboard!");
  } catch (err) {
    toast.error("Failed to copy link.");
  }
};

// Stateful component to handle downloading, decrypting and displaying E2EE files
function E2EEFileAttachment({ file, roomKey, setFullscreen, isMobile }) {
  const fileType = getFileType(file);
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [viewedOnce, setViewedOnce] = useState(false);
  const containerRef = useRef(null);
  const [isInView, setIsInView] = useState(false);

  const lastDecryptedIvRef = useRef(null);
  const lastDecryptedSourceUrlRef = useRef(null);

  const MediaSkeleton = () => (
    <div style={{
      width: "100%",
      height: isMobile ? "240px" : "300px",
      background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)",
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
        width: 24, height: 24, border: "2px solid rgba(255,255,255,0.1)",
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
    if (!file.iv || (!roomKey && !file.keyB64)) {
      setDecryptedUrl(file.url);
      setLoading(false);
      return;
    }

    if (decryptedUrl && lastDecryptedIvRef.current === file.iv) {
      lastDecryptedSourceUrlRef.current = file.url;
      return;
    }

    let active = true;
    const decrypt = async () => {
      try {
        setLoading(true);
        setError(false);

        let fetchUrl = file.url;
        if (!file.url.startsWith(window.location.origin) && !file.url.includes("/uploads/")) {
          const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";
          fetchUrl = `${backendUrl}/api/proxy-file?url=${encodeURIComponent(file.url)}`;
        }

        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const encryptedBuffer = await res.arrayBuffer();

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
        }
      } catch (err) {
        console.error("File decryption failed:", err);
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
  }, [isInView, file.url, file.iv, roomKey, file.keyB64]);

  if (loading) {
    return (
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "10px" }}>
        <div style={{
          width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)",
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

  if (fileType && fileType.startsWith("audio")) {
    return (
      <FileAttachmentWrapper ref={containerRef} style={{ padding: "10px 12px", background: "rgba(255, 255, 255, 0.02)", cursor: "default", width: "100%", boxSizing: "border-box" }}>
        <PlaybackSpeedAudio file={file} decryptedUrl={decryptedUrl} />
      </FileAttachmentWrapper>
    );
  }

  return (
    <FileAttachmentWrapper ref={containerRef} style={{ padding: 0 }}>
      {fileType && fileType.startsWith("image") ? (
        <div
          onClick={() => mediaLoaded && setFullscreen({ ...file, url: decryptedUrl })}
          style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}
        >
          {!mediaLoaded && <MediaSkeleton />}
          <img
            alt={file.name}
            src={decryptedUrl}
            loading="lazy"
            decoding="async"
            onLoad={() => setMediaLoaded(true)}
            onError={() => setMediaLoaded(true)}
            style={{ width: "100%", height: "auto", maxHeight: isMobile ? "240px" : "300px", objectFit: "cover", display: mediaLoaded ? "block" : "none", borderRadius: 0, background: "rgba(0,0,0,0.25)" }}
          />
          {mediaLoaded && (
            <div style={{ padding: "8px 12px", background: "rgba(10, 10, 10, 0.75)", backdropFilter: "blur(12px)", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", gap: 6 }}>
              <span style={{ fontSize: "0.72rem", color: "#eee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 4, fontWeight: 500 }}>{file.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {!file.viewOnce && (
                  <>
                    <button
                      type="button"
                      title="Copy to clipboard"
                      onClick={(e) => { e.stopPropagation(); copyImageToClipboard(decryptedUrl); }}
                      style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      title="Download"
                      onClick={(e) => { e.stopPropagation(); downloadMedia(decryptedUrl, file.name); }}
                      style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <FaDownload size={12} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="expand-btn"
                  onClick={(e) => { e.stopPropagation(); setFullscreen({ ...file, url: decryptedUrl }); }}
                  style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", borderRadius: 6, padding: "0 8px", height: 28, fontSize: "0.72rem", fontWeight: "bold" }}
                >
                  Expand
                </button>
              </div>
            </div>
          )}
        </div>
      ) : fileType && fileType.startsWith("video") ? (
        <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
          {!mediaLoaded && <MediaSkeleton />}
          <video
            src={decryptedUrl}
            controls
            playsInline
            preload="auto"
            onLoadedData={() => setMediaLoaded(true)}
            onError={() => setMediaLoaded(true)}
            style={{ width: "100%", height: "auto", maxHeight: isMobile ? "240px" : "300px", objectFit: "contain", display: mediaLoaded ? "block" : "none", background: "#000" }}
          />
          {mediaLoaded && (
            <div style={{ padding: "8px 12px", background: "rgba(10, 10, 10, 0.75)", backdropFilter: "blur(12px)", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", gap: 6 }}>
              <span style={{ fontSize: "0.72rem", color: "#eee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 4, fontWeight: 500 }}>{file.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {!file.viewOnce && (
                  <>
                    <button
                      type="button"
                      title="Copy video link"
                      onClick={(e) => { e.stopPropagation(); copyLinkToClipboard(decryptedUrl); }}
                      style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      title="Download"
                      onClick={(e) => { e.stopPropagation(); downloadMedia(decryptedUrl, file.name); }}
                      style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <FaDownload size={12} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="expand-btn"
                  onClick={(e) => { e.stopPropagation(); setFullscreen({ ...file, url: decryptedUrl }); }}
                  style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", borderRadius: 6, padding: "0 8px", height: 28, fontSize: "0.72rem", fontWeight: "bold" }}
                >
                  Fullscreen
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => {
            const link = document.createElement("a");
            link.href = decryptedUrl;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "10px",
            background: "rgba(255, 255, 255, 0.02)", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.05)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)", minWidth: 0
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 34, height: 34, borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            fontSize: "1.2rem", flexShrink: 0
          }}>
            {file.name.match(/\.(xlsx|xls|csv)$/i) ? "📊" :
              file.name.match(/\.(docx|doc)$/i) ? "📝" :
                file.name.match(/\.(zip|rar|7z)$/i) ? "🗜️" :
                  file.name.match(/\.pdf$/i) ? "📕" : "📎"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, flex: 1 }}>
            <span style={{ fontWeight: "600", fontSize: "0.8rem", color: "var(--chakra-colors-textPrimary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {file.name}
            </span>
            <span style={{ fontSize: "0.68rem", color: "var(--chakra-colors-brandPrimary)", marginTop: "1px", fontWeight: "600" }}>
              🔒 Secure E2EE Payload
            </span>
          </div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(33, 150, 243, 0.1)",
            border: "1px solid rgba(33, 150, 243, 0.25)",
            color: "#2196F3", flexShrink: 0
          }}>
            <FaDownload style={{ fontSize: "0.8rem" }} />
          </div>
        </div>
      )}
    </FileAttachmentWrapper>
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

export default function ChatRoom() {
  const { roomId: routeRoomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const onResolvedRef = useRef(null);
  const audioRef = useRef(new Audio(notificationSound));
  const userColorsRef = useRef({});

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
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [pendingFiles, setPendingFiles] = useState([]);
  const [sendAsViewOnce, setSendAsViewOnce] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
  const [participantProfiles, setParticipantProfiles] = useState({});
  const [viewedByTarget, setViewedByTarget] = useState(null);
  const messageRefs = useRef({});
  const [pendingFilesUrls, setPendingFilesUrls] = useState({});
  const pendingFilesUrlsRef = useRef({});
  const leaveRoomNowRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
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
  const closeMeeting = useCallback(() => setShowMeeting(false), []);
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

  // ── Message Forwarding ──
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardRoomId, setForwardRoomId] = useState("");
  const [forwardSecurityCode, setForwardSecurityCode] = useState("");

  // ── Ephemeral Messages ──
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const [roomEphemeralDuration, setRoomEphemeralDuration] = useState(0); // 0 means OFF, positive is seconds
  const [showEphemeralMenu, setShowEphemeralMenu] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const DEFAULT_EPHEMERAL_DURATION = 15; // fallback seconds if single message timer fails

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
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const [roomExists, setRoomExists] = useState(true);
  const [roomRequestPending, setRoomRequestPending] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const stealthTokenRef = useRef("");

  const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const getJoinPayload = useCallback(() => ({
    roomId: roomId.trim(),
    userName: userName.trim(),
    securityCode,
    avatar: userAvatarRef.current,
    stealthToken: stealthTokenRef.current || undefined,
    ownerToken: sessionStorage.getItem(`cheprabai:owner-token:${roomId.trim()}`) || undefined,
  }), [roomId, userName, securityCode]);

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
      setIsStealthMode(Boolean(result.isStealth));
      setOnlineUsers((users) => users.length ? users : [{ id: socketRef.current?.id || "local", name: userName }]);
      if (!result.isStealth && roomId.trim()) {
        navigate(`/room/${encodeURIComponent(roomId.trim())}`, { replace: true });
      }
      setAuthenticated(true);
    }
  }, [roomId, userName, navigate]);

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
      const key = await generateKeyFromSecret(code + trimmedRoom);
      setRoomId(trimmedRoom);
      setRoomKey(key);
      setJoined(true);
    } catch {
      toast.error("Failed to initialize secure session keys");
    }
  }, [roomId, userName, securityCode]);

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
    try {
      await copyRoomShareLink(roomId.trim());
      toast.success("Room link copied!");
    } catch {
      toast.error("Could not copy link. Try again.");
    }
  }, [roomId]);
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
        Notification.requestPermission();
      }
    }
  }, [joined, roomId]);

  useEffect(() => {
    userAvatarRef.current = userAvatar;
  }, [userAvatar]);

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
        setUserName("Stealth Admin");
        if (parsedKey) {
          setSecurityCode(parsedKey);
          generateKeyFromSecret(parsedKey + parsedRoomId)
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
    return () => { cancelled = true; };
  }, [backendUrl]);

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
  }, [roomId, backendUrl]);

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
          const key = await generateKeyFromSecret(code + resolvedRoomId);
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
          : "Your room creation request was rejected by the admin.",
        { autoClose: 6000 }
      );
    }
  };
  onResolvedRef.current = onResolved;

  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

    const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";
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

      // Vimeo
      if (u.hostname.includes("vimeo.com")) {
        const id = u.pathname.split("/").filter(Boolean).pop();
        if (/^\d+$/.test(id || "")) return { type: "vimeo", src: `https://player.vimeo.com/video/${id}` };
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
    const socket = io(process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com", {
      transports: ["polling", "websocket"],
      upgrade: true,
      rememberUpgrade: false
    });
    socketRef.current = socket;

    socket.on("roomRequestResolved", (data) => {
      onResolvedRef.current?.(data);
    });

    return () => socket.disconnect();
  }, []);

  // ── Ephemeral message auto-delete timer ──
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => {
        const now = Date.now();
        return prev.filter(m => {
          if (!m.ephemeral) return true;
          const duration = m.ephemeralDuration || DEFAULT_EPHEMERAL_DURATION;
          return now - m.ts < duration * 1000;
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!joined) return;

    // Register every room listener before joining: localhost can respond quickly
    // enough for the initial presence event to otherwise be missed.
    socketRef.current.on("chatHistory", async (history) => {
      const formatted = await Promise.all(history.map(async msg => {
        const item = { ...msg, ...msg.payload };
        if (item.encryptedPayload && roomKey) {
          try {
            const decryptedText = await decryptMessage(roomKey, item.encryptedPayload);
            try {
              const decryptedPayload = JSON.parse(decryptedText);
              Object.assign(item, decryptedPayload);
            } catch {
              // Backward compatibility fallback for old plain text messages
              item.text = decryptedText;
            }
          } catch (e) {
            item.text = "🔒 Decryption failed (invalid key or corrupted)";
            item.decryptionError = true;
          }
        }
        return item;
      }));
      setMessages(formatted);
      formatted.filter((item) => item.id && item.userName !== userName).forEach((item) => socketRef.current.emit("messageViewed", { messageId: item.id }));
    });

    socketRef.current.on("hasMoreMessages", () => setHasMoreMessages(true));

    socketRef.current.on("olderMessages", async ({ messages: older, hasMore }) => {
      const formatted = await Promise.all(older.map(async msg => {
        const item = { ...msg, ...msg.payload };
        if (item.encryptedPayload && roomKey) {
          try {
            const decryptedText = await decryptMessage(roomKey, item.encryptedPayload);
            try {
              const decryptedPayload = JSON.parse(decryptedText);
              Object.assign(item, decryptedPayload);
            } catch {
              // Backward compatibility fallback for old plain text messages
              item.text = decryptedText;
            }
          } catch (e) {
            item.text = "🔒 Decryption failed (invalid key or corrupted)";
            item.decryptionError = true;
          }
        }
        return item;
      }));
      setMessages(prev => [...formatted, ...prev]);
      setHasMoreMessages(hasMore);
      setLoadingMore(false);
    });

    socketRef.current.on("newMessage", async (msg) => {
      const formattedMsg = { ...msg, ...msg.payload };
      if (formattedMsg.encryptedPayload && roomKey) {
        try {
          const decryptedText = await decryptMessage(roomKey, formattedMsg.encryptedPayload);
          try {
            const decryptedPayload = JSON.parse(decryptedText);
            Object.assign(formattedMsg, decryptedPayload);
          } catch {
            // Backward compatibility fallback for old plain text messages
            formattedMsg.text = decryptedText;
          }
        } catch (e) {
          formattedMsg.text = "🔒 Decryption failed (invalid key or corrupted)";
          formattedMsg.decryptionError = true;
        }
      }
      setMessages((m) => [...m, formattedMsg]);
      if (formattedMsg.id && formattedMsg.userName !== userName) socketRef.current.emit("messageViewed", { messageId: formattedMsg.id });
      if (msg.userName !== userName) {
        audioRef.current.play().catch(() => { });

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
      setOnlineUsers((users) => users.filter((user) => user.id !== id));
    });

    socketRef.current.on("typing", (users) =>
      setTypingUsers(users.filter((u) => u !== userName)),
    );
    socketRef.current.on("roomDestroyed", () => {
      toast.info("This room was deleted.");
      leaveRoomNowRef.current?.();
    });
    socketRef.current.on("kicked-from-room", ({ targetSocketId, targetName, adminName }) => {
      if (socketRef.current?.id === targetSocketId || targetName === userName) {
        toast.error(`🚫 You have been removed from this room by ${adminName || 'the admin/owner'}.`);
        leaveRoomNowRef.current?.();
      } else {
        toast.info(`ℹ️ ${targetName} was removed from the room.`);
        setOnlineUsers((users) => users.filter((u) => u.id !== targetSocketId && u.name !== targetName));
      }
    });
    socketRef.current.on("admin-kick-user", ({ peerId, name, adminName, isRoomKick }) => {
      if (peerId === socketRef.current?.id || name === userName) {
        toast.error(`🚫 You have been removed from this room by ${adminName || 'the admin/owner'}.`);
        leaveRoomNowRef.current?.();
      } else {
        setOnlineUsers((users) => users.filter((u) => u.id !== peerId && u.name !== name));
      }
    });

    socketRef.current.on("roomOwner", (token) => {
      setOwnerToken(token);
      if (token && roomId) {
        sessionStorage.setItem(`cheprabai:owner-token:${roomId}`, token);
      }
    });
    socketRef.current.on("messageViewUpdated", ({ messageId, viewedBy }) => {
      setMessages((items) => items.map((item) => item.id === messageId ? { ...item, viewedBy } : item));
    });
    socketRef.current.on("messageReactionUpdated", ({ messageId, reactions }) => {
      setMessages((items) => items.map((item) => item.id === messageId ? { ...item, reactions } : item));
    });
    socketRef.current.on("roomBackgroundUpdated", ({ background }) => {
      localStorage.setItem(`cheprabai:room-background:${roomId}`, background || "");
      setRoomBackground(background || "");
    });
    socketRef.current.on("roomBackgroundPolicy", ({ locked }) => setBackgroundLocked(Boolean(locked)));
    socketRef.current.on("profileUpdated", ({ socketId, avatar, name }) => {
      setParticipantProfiles((profiles) => ({ ...profiles, [socketId]: { avatar, name } }));
    });
    socketRef.current.on("roomProfiles", (profiles = {}) => {
      setParticipantProfiles(profiles);
    });

    socketRef.current.on("connect", () => {
      setIsConnected(true);
      if (joined && roomId && userName) {
        socketRef.current.emit("joinRoom", getJoinPayload(), handleJoinResult);
      }
    });

    socketRef.current.on("disconnect", () => {
      setIsConnected(false);
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
    socketRef.current.on("syncRoomMetadata", async ({ ephemeralDuration, pinnedMessages: rawPinned }) => {
      if (ephemeralDuration !== undefined) {
        setRoomEphemeralDuration(ephemeralDuration);
        setEphemeralMode(ephemeralDuration > 0);
      }
      if (rawPinned) {
        const formatted = await Promise.all(rawPinned.map(async msg => {
          const item = { ...msg, ...msg.payload };
          if (item.encryptedPayload && roomKey) {
            try {
              const decryptedText = await decryptMessage(roomKey, item.encryptedPayload);
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

    socketRef.current.on("pinnedMessagesUpdated", async ({ pinnedMessages: rawPinned }) => {
      const formatted = await Promise.all((rawPinned || []).map(async msg => {
        const item = { ...msg, ...msg.payload };
        if (item.encryptedPayload && roomKey) {
          try {
            const decryptedText = await decryptMessage(roomKey, item.encryptedPayload);
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
    });

    socketRef.current.on("scheduledMessagesUpdated", async (scheduledMsgs) => {
      const formatted = await Promise.all((scheduledMsgs || []).map(async msg => {
        const item = { ...msg, ...msg.payload };
        if (item.encryptedPayload && roomKey) {
          try {
            const decryptedText = await decryptMessage(roomKey, item.encryptedPayload);
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
      setScheduledMessages(formatted);
    });

    socketRef.current.on("messageEdited", async ({ messageId, payload: newPayload, editedAt }) => {
      let formatted = { ...newPayload };
      if (newPayload.encryptedPayload && roomKey) {
        try {
          const decryptedText = await decryptMessage(roomKey, newPayload.encryptedPayload);
          try {
            const decryptedPayload = JSON.parse(decryptedText);
            Object.assign(formatted, decryptedPayload);
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

    socketRef.current.emit("joinRoom", getJoinPayload(), handleJoinResult);



    // ── Incoming Call Signaling ──
    socketRef.current.on("incoming-call", ({ callerName, callerAvatar }) => {
      if (showMeeting) return; // already in a call
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
        "typing", "user-left", "mediaState", "room-theme-changed", "screenShareState",
        "screencastFrame", "screencastStarted", "screencastStopped", "syncMedia",
        "roomProfiles", "roomBackgroundUpdated", "roomBackgroundPolicy", "profileUpdated",
        "connect", "disconnect", "fileUrlUpdated", "messageDeleted", "syncRoomMetadata",
        "pinnedMessagesUpdated", "scheduledMessagesUpdated", "messageEdited",
        "pollVotesUpdated", "roomEphemeralUpdated", "incoming-call", "call-ended"
      ];
      if (socketRef.current) {
        registeredEvents.forEach(evt => socketRef.current.off(evt));
      }
      clearInterval(pingInterval);
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    };
  }, [joined, roomId, userName, roomKey, securityCode, showMeeting, getJoinPayload, handleJoinResult]);

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

  const uploadFile = async (file, viewOnce = false, scheduleTime = null) => {
    let tempId;
    try {
      tempId = `uploading-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setMessages(m => [...m, { id: tempId, userName, file: { name: file.name, loading: true }, ts: Date.now() }]);

      let fileToUpload = file;
      let ivString = null;
      let keyB64 = null;

      if (roomKey) {
        const fileBuffer = await file.arrayBuffer();
        const encrypted = await encryptBinary(roomKey, fileBuffer);
        const encryptedBlob = new Blob([encrypted.data], { type: "application/octet-stream" });
        fileToUpload = new File([encryptedBlob], file.name + ".enc", { type: "application/octet-stream" });
        ivString = btoa(String.fromCharCode(...new Uint8Array(encrypted.iv)));
        keyB64 = await exportKey(roomKey);
      }

      const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";

      const formData = new FormData();
      formData.append("file", fileToUpload);

      const res = await axios.post(
        `${backendUrl}/api/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            // Keep the pending card alive, but deliberately do not expose a
            // progress bar: a compact activity spinner is clearer on mobile.
          }
        }
      );

      const fileData = {
        url: res.data.secure_url,
        name: file.name,
        type: file.type || res.data.format,
        publicId: res.data.public_id,
        resourceType: res.data.resource_type,
        ...(viewOnce && /^(image|video)\//.test(file.type) && { viewOnce: true }),
        ...(ivString && { iv: ivString })
      };
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
            file: fileData
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
        await handleSend({ file: fileData }, keyB64);
      }
      setMessages(m => m.filter(msg => msg.id !== tempId));
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.error || "File upload failed!";
      toast.error(errorMsg);
      if (tempId) setMessages(m => m.filter(msg => msg.id !== tempId));
    }
  };

  /* ================= PASTE SUPPORT ================= */

  useEffect(() => {
    const onPaste = (e) => {
      const pastedFiles = [...e.clipboardData.items]
        .filter((i) => i.kind === "file")
        .map((i) => i.getAsFile())
        .filter(Boolean);
      if (pastedFiles.length > 0) {
        setPendingFiles((prev) => [...prev, ...pastedFiles]);
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

    let plainPayload = { ...(customData || { text: message }), ...(replyTo && { replyTo }) };
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
        ...(customData && customData.file && { file: customData.file })
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

    await new Promise((resolve, reject) => {
      socketRef.current.emit("sendMessage", outgoingMessage, (result) => {
        if (result?.success) resolve(result);
        else reject(new Error(result?.error || "Message delivery was not confirmed."));
      });
    });

    if (!customData) {
      setMessage("");
      stopTyping();
    }
    setReplyTo(null);
    localStorage.removeItem(`cheprabai:draft:${roomId}`);
  };

  const toggleReaction = (messageId, emoji) => {
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

  const handleTyping = (value) => {
    socketRef.current.emit("typing", { isTyping: value.length > 0, roomId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () => socketRef.current.emit("typing", { isTyping: false, roomId }),
      1000,
    );
  };

  const stopTyping = () => {
    clearTimeout(typingTimeout.current);
    socketRef.current?.emit("typing", { isTyping: false, roomId });
  };

  /* ================= LOAD MORE MESSAGES ================= */
  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMoreMessages) return;
    setLoadingMore(true);
    socketRef.current.emit("loadMoreMessages", { offset: messages.length });
  }, [loadingMore, hasMoreMessages, messages.length]);

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

  const isBookmarked = (msgId) => bookmarks.some(b => b.id === msgId);

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

  const requestAvatarChange = (value) => {
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

    let payload = { text: editInput.trim() };
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

      const targetKey = await generateKeyFromSecret(forwardSecurityCode.trim() + forwardRoomId.trim());
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
        border: "1px solid rgba(255, 255, 255, 0.08)",
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
                  background: "rgba(255, 255, 255, 0.03)",
                  border: hasVoted ? "1px solid var(--chakra-colors-brandPrimary)" : "1px solid rgba(255, 255, 255, 0.06)",
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
                  background: hasVoted ? "rgba(255, 63, 94, 0.12)" : "rgba(255, 255, 255, 0.04)",
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
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#fff",
                outline: "none"
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
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(255, 255, 255, 0.04)",
                    color: "#fff",
                    outline: "none"
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
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        color: "var(--chakra-colors-textPrimary)",
        fontSize: "0.85rem",
        zIndex: 5,
        gap: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", cursor: "pointer" }} onClick={() => {
          const target = messageRefs.current[latestPin.id];
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}>
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
          border: "1px solid rgba(255,255,255,.12)",
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
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.05)",
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
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.05)",
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

  /* ================= UI ================= */

  if (!joined || !authenticated) {
    return (
      <>
        <LandingWrapper>
          <ToastContainer position="top-center" autoClose={3000} limit={3} theme="dark" />
          <FloatingBlob />
          <JoinContainer>
            <div style={{ textAlign: "center", marginBottom: 4 }}>
              <div style={{
                display: "inline-flex",
                background: "rgba(255, 63, 94, 0.10)",
                border: "1px solid rgba(255, 63, 94, 0.30)",
                boxShadow: "0 0 0 5px rgba(255,63,94,.04), 0 8px 20px rgba(0,0,0,.18)",
                padding: 11,
                borderRadius: 14,
                marginBottom: 12
              }}>
                <ShieldCheck size={24} strokeWidth={2.2} color="var(--chakra-colors-brandPrimary)" />
              </div>
              <div style={{ color: "var(--chakra-colors-brandPrimary)", fontSize: ".67rem", fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 6 }}>Private workspace</div>
              <h2 style={{ color: "var(--chakra-colors-textPrimary)", margin: 0, fontSize: "clamp(1.35rem, 3.5vw, 1.7rem)", fontWeight: 800, letterSpacing: "-.04em" }}>
                {roomId.trim() ? `Join room ${roomId.trim()}` : "Join a secure room"}
              </h2>
              <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "clamp(.8rem, 1.8vw, .88rem)", margin: "8px auto 0", maxWidth: 290, lineHeight: 1.5 }}>
                {roomId.trim()
                  ? "You've been invited. Enter your details to join this encrypted room."
                  : "Your messages and files are encrypted before they leave this device."}
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
                      flex: 1, minHeight: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
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

            <JoinField>
              <JoinLabel htmlFor="room-id">Room ID</JoinLabel>
              <JoinInput id="room-id" autoComplete="off" placeholder="For example, 1000" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
              <FieldIcon><Hash size={18} /></FieldIcon>
            </JoinField>

            <JoinField>
              <JoinLabel htmlFor="display-name">Display name</JoinLabel>
              <JoinInput id="display-name" autoComplete="name" placeholder="How should people see you?" value={userName} onChange={(e) => setUserName(e.target.value)} />
              <FieldIcon><UserRound size={18} /></FieldIcon>
            </JoinField>

            <JoinField>
              <JoinLabel>Profile photo <span style={{ opacity: .65, fontWeight: 500 }}>(optional)</span></JoinLabel>
              <AvatarPicker>
                {userAvatar ? <img src={userAvatar} alt="Selected profile" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,.17)" }} /> : <span style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(255,255,255,.08)", color: "var(--chakra-colors-textSecondary)" }}><UserRound size={17} /></span>}
                <span style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block", fontWeight: 750, fontSize: ".82rem" }}>{userAvatar ? "Photo selected" : "Add a profile photo"}</span><span style={{ display: "block", marginTop: 1, fontSize: ".7rem", color: "var(--chakra-colors-textSecondary)" }}>Any image · crop and optimise before sharing</span></span>
                <Upload size={16} aria-hidden="true" color="var(--chakra-colors-brandPrimary)" />
                <input type="file" accept="image/*" hidden onChange={(e) => openAvatarCrop(e.target.files?.[0])} />
              </AvatarPicker>
            </JoinField>

            <JoinField>
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
              onClick={!roomExists && requireRoomApproval ? submitRoomRequest : attemptJoin}
            >
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>{getButtonText()} <ArrowRight size={18} /></span>
            </JoinButton>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: "var(--chakra-colors-textSecondary)", fontSize: ".75rem", lineHeight: 1.4, textAlign: "center" }}><LockKeyhole size={14} aria-hidden="true" /> End-to-end encrypted session</div>

          </JoinContainer>
          {renderAvatarCropDialog()}
          {confirmation && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 23000, background: "rgba(0,0,0,.68)", display: "grid", placeItems: "center", padding: 20 }}><div style={{ width: "min(420px, 100%)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.12)" }}><h3 style={{ margin: "0 0 8px" }}>{confirmation.title}</h3><p style={{ margin: "0 0 22px", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.5 }}>{confirmation.body}</p><div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><button type="button" onClick={() => setConfirmation(null)} style={{ minHeight: 44, padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "inherit", cursor: "pointer" }}>Cancel</button><button type="button" onClick={() => { confirmation.onConfirm(); setConfirmation(null); }} style={{ minHeight: 44, padding: "9px 14px", borderRadius: 10, border: 0, background: "var(--chakra-colors-brandPrimary)", color: "white", fontWeight: 700, cursor: "pointer" }}>{confirmation.confirmLabel}</button></div></div></div>}
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

      // Existing embeds
      const embed = getEmbedData(part);

      if (embed) {
        return (
          <div key={i}>
            <iframe
              title={i}
              src={embed.src}
              allowFullScreen
              style={{
                aspectRatio: getMediaAspectRatio(embed.src, embed.fileType),
                height: "auto",
                display: "block",
                width: "100%",
                minHeight: "300px",
                border: 0,
                borderRadius: 12
              }}
            />

            {/* {renderLinkActions(part)} */}
          </div>
        );
      }

      // Generic link card with rich preview
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
      const placeholder = `___CHEPRABAI_CODE_BLOCK_${codeBlocks.length}___`;
      codeBlocks.push({ placeholder, lang: lang ? lang.trim().toLowerCase() : "", code });
      return placeholder;
    });

    // 1b. Auto-detect pasted code that isn't wrapped in backticks
    // Checks: multi-line text with code-like patterns (indentation, braces, semicolons, arrows, keywords)
    if (codeBlocks.length === 0 && textWithPlaceholders.includes('\n')) {
      const lines = textWithPlaceholders.split('\n');
      // Only auto-detect if: 3+ lines AND enough code-like lines
      if (lines.length >= 3) {
        let codeLineCount = 0;
        for (const line of lines) {
          if (/^\s{2,}\S/.test(line) || /[{}();]\s*$/.test(line) || /=>/.test(line) || /^\s*(import|export|const|let|var|function|class|def |if\s*\(|else|for\s*\(|while\s*\(|return |public |private |protected |static |void |int |String |package |from |require\()/.test(line)) {
            codeLineCount++;
          }
        }
        // If more than 40% of lines look like code, treat as a code block
        if (codeLineCount / lines.length > 0.4) {
          const placeholder = `___CHEPRABAI_CODE_BLOCK_${codeBlocks.length}___`;
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
      const copyInlineJs = `navigator.clipboard.writeText(decodeURIComponent('${escapedInline}')); var btn = this.querySelector('.inline-copy-btn'); if(btn){ btn.textContent = '✓'; btn.style.color = '#00bfa5'; setTimeout(function(){ btn.textContent = '📋'; btn.style.color = 'rgba(255,255,255,0.35)'; }, 1500); }`;
      return `<span onclick="${copyInlineJs}" style="background:rgba(255,255,255,.08);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:.85em;cursor:pointer;position:relative;display:inline-flex;align-items:center;gap:4px;transition:background .2s" onmouseover="this.style.background='rgba(255,255,255,.14)'" onmouseout="this.style.background='rgba(255,255,255,.08)'"><code style="font-family:inherit">${code}</code><span class="inline-copy-btn" style="font-size:.7em;color:rgba(255,255,255,0.35);flex-shrink:0">📋</span></span>`;
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
      const escapedCodeForClipboard = encodeURIComponent(block.code);
      const copyCodeJs = `navigator.clipboard.writeText(decodeURIComponent('${escapedCodeForClipboard}')); this.innerText = '✓ Copied'; this.style.color = '#00bfa5'; setTimeout(() => { this.innerText = 'Copy'; this.style.color = 'inherit'; }, 2000);`;

      const blockHtml = `
<div style="background:#0b0c10; border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin:12px 0; overflow:hidden; font-family:'SF Mono','Fira Code',Consolas,monospace; font-size:0.85rem; box-shadow:0 8px 24px rgba(0,0,0,0.3); max-width: 100%; text-align: left; box-sizing: border-box;">
  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 14px; border-bottom:1px solid rgba(255,255,255,0.06); box-sizing: border-box;">
    <span style="font-size:0.72rem; color:var(--chakra-colors-brandPrimary); text-transform:uppercase; font-weight:bold; letter-spacing:0.05em;">💻 ${block.lang || 'code'}</span>
    <button onclick="${copyCodeJs}" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.55); cursor:pointer; font-size:0.73rem; font-weight:600; padding:4px 10px; border-radius:6px; outline:none; transition:all 0.2s; display:flex; align-items:center; gap:4px;" onmouseover="this.style.background='rgba(255,255,255,0.12)';this.style.color='#fff';this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.55)';this.style.borderColor='rgba(255,255,255,0.1)'">📋 Copy</button>
  </div>
  <pre style="margin:0; padding:14px; overflow-x:auto; line-height:1.55; color:#c9d1d9; background:#0d0e15; font-family:inherit; box-sizing: border-box; -webkit-overflow-scrolling: touch;"><code style="font-family:inherit; white-space:pre; word-break: normal; word-wrap: normal;">${escapedCodeForHtml}</code></pre>
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
    <div
      style={{
        display: "flex",
        gap: 8,
        marginTop: 10,
        flexWrap: "wrap"
      }}
    >
      <button
        onClick={() => navigator.clipboard.writeText(url)}
        style={actionBtnStyle}
      >
        📋 Copy Link
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
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.06)",
    color: "inherit",
    cursor: "pointer"
  };


  return (
    <>
      <ToastContainer position="top-center" autoClose={3000} limit={3} />
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
            justifyContent: "center",
            gap: 8,
            padding: "8px 14px",
            background: "rgba(123, 97, 255, 0.12)",
            borderBottom: "1px solid rgba(123, 97, 255, 0.25)",
            color: "#c9beff",
            fontSize: "0.78rem",
            fontWeight: 700,
            flexShrink: 0,
          }}>
            <FaEyeSlash size={12} aria-hidden="true" />
            Stealth observer — invisible to other participants
          </div>
        )}
        <Header>
          <Avatar src={userAvatar || image} alt={userAvatar ? `${userName || "User"} avatar` : "Logo"} />
          <RoomInfoTrigger
            type="button"
            aria-label={showRoomInfo ? "Hide room insights" : "Show room insights"}
            aria-expanded={showRoomInfo}
            aria-controls="room-insights-panel"

          >
            <div style={{ fontWeight: "bold", fontSize: "clamp(0.85rem, 2.5vw, 1.1rem)", display: "flex", alignItems: "center", gap: 4, minWidth: 0 }} >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "clamp(60px, 25vw, 300px)" }}>{roomId}</span>
              <span aria-hidden="true" style={{ fontSize: "0.65rem", opacity: 0.8, flexShrink: 0, lineHeight: 1 }} onClick={() => setShowRoomInfo((isOpen) => !isOpen)}>
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
                    <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 10 }}>
                      <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 8 }}>Participants ({onlineUsers.length})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                        {onlineUsers.map(u => {
                          const isMe = u.id === socketRef.current?.id;
                          return (
                            <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255, 255, 255, 0.03)", padding: "6px 12px", borderRadius: 10, fontSize: "0.75rem", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
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
                                    background: "rgba(239, 68, 68, 0.1)",
                                    color: "#ef4444",
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
                    <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 10, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <label onClick={(e) => e.stopPropagation()} style={{ display: "flex", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, cursor: "pointer", fontSize: ".8rem", fontWeight: 700, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>Change avatar<input type="file" accept="image/*" hidden onChange={(e) => openAvatarCrop(e.target.files?.[0])} /></label>
                      <label onClick={(e) => e.stopPropagation()} style={{ display: "flex", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, cursor: backgroundLocked && !ownerToken ? "not-allowed" : "pointer", opacity: backgroundLocked && !ownerToken ? .45 : 1, fontSize: ".8rem", fontWeight: 700, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>{backgroundLocked && !ownerToken ? "Background managed by owner" : "Change chat background"}<input type="file" disabled={backgroundLocked && !ownerToken} accept="image/*" hidden onChange={(e) => requestBackgroundChange(e.target.files?.[0])} /></label>
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
                        <Copy size={14} aria-hidden="true" /> Copy invite link
                      </button>
                      {/* <Link
                        to="/admin"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          width: "100%", padding: "8px 12px", borderRadius: 10,
                          background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)",
                          color: "var(--chakra-colors-textSecondary)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                          textDecoration: "none", boxSizing: "border-box", transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)"; e.currentTarget.style.color = "var(--chakra-colors-textPrimary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)"; e.currentTarget.style.color = "var(--chakra-colors-textSecondary)"; }}
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
            <ThemeSwitcher />
            {(showWhiteboard || showMeeting) && (
              <LiveBadge>
                <div style={{ width: 6, height: 6, background: "white", borderRadius: "50%" }} />
                LIVE
              </LiveBadge>
            )}

            <ActionButton onClick={() => {
              if (!socketRef.current || !socketRef.current.connected) {
                toast.error("Connecting to server. Please wait a moment before starting the call.");
                return;
              }
              socketRef.current.emit("start-call", { roomId, userName, avatar: userAvatar });
              setShowMeeting(true);
            }} title="Start Video Call">
              <FaVideo />
            </ActionButton>

            <ActionButton onClick={() => setShowWhiteboard(true)} title="Open Whiteboard">
              <FaPenNib />
            </ActionButton>

            <ActionButton onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }} title="Search Messages">
              <FaSearch />
            </ActionButton>

            <ActionButton onClick={handleLeaveRoom} title="Leave Room" style={{ color: "var(--chakra-colors-brandPrimary)" }}>
              <FaSignOutAlt color="white" />
            </ActionButton>

            <ActionButton onClick={() => setShowBookmarks(!showBookmarks)} title="Saved messages / Bookmarks" style={{ color: showBookmarks ? "var(--chakra-colors-brandPrimary)" : "inherit" }}>
              🔖
            </ActionButton>

            <ActionButton onClick={() => setShowShortcutsHelp(true)} title="Keyboard Shortcuts Guide" style={{ fontSize: "1.1rem" }}>
              ⌨️
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

          </RoomActions>
        </Header>
        {renderPinnedMessagesBanner()}
        {viewer && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "#000",
              zIndex: 999999,
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                height: 56,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 16px",
                background: "#111",
                borderBottom: "1px solid #222"
              }}
            >
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {viewer}
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(viewer);
                      toast.success("Link copied!");
                    } catch {
                      toast.error("Failed to copy link");
                    }
                  }}
                  style={{
                    marginLeft: "8px"
                  }}
                >
                  📋
                </button>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => window.open(viewer, "_blank")} size='sm'>
                  <ImNewTab />
                </button>

                <button onClick={() => setViewer(null)}>
                  <AiFillCloseSquare />
                </button>
              </div>
            </div>

            <iframe
              src={viewer}
              title="viewer"
              style={{
                flex: 1,
                border: 0,
                width: "100%"
              }}
            />
          </div>
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
          {messages.filter(m => {
            if (!searchQuery) return true;
            if (m.type === "system") return false;
            return m.text?.toLowerCase().includes(searchQuery.toLowerCase());
          }).map((m, i, filteredArr) => {
            const isSystem = m.type === "system";
            const systemType = isSystem ? m.action : null;
            const senderAvatar = m.senderAvatar || participantProfiles[m.senderSocketId]?.avatar || Object.values(participantProfiles).find((profile) => profile.name?.trim().toLocaleLowerCase() === m.userName?.trim().toLocaleLowerCase())?.avatar;
            // const isVisualMedia = Boolean(m.file && (m.file.viewOnce || m.file.type?.startsWith("image/") || m.file.type?.startsWith("video/")));

            // Message grouping: hide avatar/name if same sender within 2 minutes
            const prevMsg = i > 0 ? filteredArr[i - 1] : null;
            const isGrouped = !isSystem && prevMsg && prevMsg.type !== "system" && prevMsg.userName === m.userName && m.ts && prevMsg.ts && (m.ts - prevMsg.ts < 120000);

            if (isSystem && m.userName === userName) return null;

            return (
              <MessageBubble
                key={i}
                ref={(node) => { if (m.id) messageRefs.current[m.id] = node; }}
                $isSender={m.userName === userName}
                $isSystem={isSystem}
                $systemType={systemType}
                $isFile={!!m.file}
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
                  <button type="button" aria-label="Jump to replied message" onClick={() => { const target = messageRefs.current[m.replyTo.id]; target?.scrollIntoView({ behavior: "smooth", block: "center" }); target?.animate([{ boxShadow: "0 0 0 0 rgba(5,150,105,0)", backgroundColor: "transparent" }, { boxShadow: "0 0 0 4px rgba(5,150,105,.9)", backgroundColor: "rgba(5,150,105,.16)", offset: 0.12 }, { boxShadow: "0 0 0 4px rgba(5,150,105,.7)", backgroundColor: "rgba(5,150,105,.12)", offset: 0.82 }, { boxShadow: "0 0 0 0 rgba(5,150,105,0)", backgroundColor: "transparent" }], { duration: 2600, easing: "ease-in-out" }); }} style={{ width: m.file ? "calc(100% - 28px)" : "100%", margin: m.file ? "8px 14px 10px" : "0 0 8px", textAlign: "left", border: 0, borderLeft: "3px solid var(--chakra-colors-brandPrimary)", background: "rgba(255,255,255,.055)", borderRadius: 8, padding: "7px 9px", fontSize: ".76rem", lineHeight: 1.35, display: "flex", gap: 9, alignItems: "center", color: "inherit", cursor: "pointer", boxSizing: "border-box" }}>
                    <ReplyAttachmentPreview reply={m.replyTo} roomKey={roomKey} />
                    <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "var(--chakra-colors-brandPrimary)", fontWeight: 700 }}>{m.replyTo.userName || "Message"}</div><div style={{ opacity: .78, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.replyTo.file?.viewOnce ? "View-once media · unavailable" : (m.replyTo.preview || "Attachment")}</div></div>
                  </button>
                )}

                {isSystem && (
                  <span>
                    {systemType === "ephemeral-change" ? (
                      m.ephemeralDuration > 0
                        ? `💨 ${m.userName} enabled disappearing messages (${m.ephemeralDuration >= 86400 ? `${Math.floor(m.ephemeralDuration / 86400)}d` : m.ephemeralDuration >= 3600 ? `${Math.floor(m.ephemeralDuration / 3600)}h` : m.ephemeralDuration >= 60 ? `${Math.floor(m.ephemeralDuration / 60)}m` : `${m.ephemeralDuration}s`})`
                        : `💨 ${m.userName} turned off disappearing messages`
                    ) : (
                      `${m.userName} ${systemType === "join" ? "joined" : "left"} the room`
                    )}
                  </span>
                )}

                {!isSystem && m.poll && renderPoll(m)}

                {!isSystem && m.text && (
                  editingMessageId === m.id ? (
                    <div style={{ display: "flex", gap: 8, width: "100%", marginTop: 4, minWidth: 200, padding: m.file ? "4px 14px 10px" : "0" }}>
                      <input
                        type="text"
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--chakra-colors-brandPrimary)",
                          background: "rgba(0,0,0,0.2)",
                          color: "#fff",
                          outline: "none"
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(m.id);
                          if (e.key === "Escape") setEditingMessageId(null);
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(m.id)}
                        style={{ background: "var(--chakra-colors-brandPrimary)", border: "none", color: "#fff", padding: "0 10px", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMessageId(null)}
                        style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "inherit", padding: "0 10px", borderRadius: 8, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    m.file ? (
                      <div style={{ padding: "4px 14px 10px" }}>{renderSmartMessage(m.text)}</div>
                    ) : renderSmartMessage(m.text)
                  )
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
                  <div style={{ position: "relative", width: "100%", minWidth: 0, flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.04)", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    {m.file.loading ? (
                      <div style={{
                        width: "100%", padding: "24px 18px", background: "rgba(255, 255, 255, 0.03)", display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(255,255,255,.15)", borderTopColor: "var(--chakra-colors-brandPrimary)", animation: "spin .8s linear infinite" }} />
                          <span style={{ fontSize: ".82rem", fontWeight: 600 }}>Sending {m.file.name}</span>
                          <span style={{ fontSize: ".72rem", opacity: .62 }}>Encrypted and uploading securely…</span>
                        </div>
                      </div>
                    ) : (
                      <E2EEFileAttachment file={m.file} roomKey={roomKey} setFullscreen={setFullscreen} isMobile={isMobile} />
                    )}
                  </div>
                )}

                <div style={m.file ? { padding: "10px 14px 10px", borderTop: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.15)" } : undefined}>
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
                        💨 {Math.max(0, (m.ephemeralDuration || DEFAULT_EPHEMERAL_DURATION) - Math.floor((Date.now() - m.ts) / 1000))}s
                      </span>
                    )}
                  </div>
                  {!isSystem && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: isMobile ? "column" : "row",
                        alignItems: isMobile ? "stretch" : "center",
                        justifyContent: "space-between",
                        gap: isMobile ? 8 : 6,
                        marginTop: 6,
                        position: "relative",
                        minWidth: 0,
                      }}
                    >
                      {Object.keys(m.reactions || {}).length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", minWidth: 0 }}>
                          {Object.entries(m.reactions).map(([emoji, users]) => (
                            <button
                              key={emoji}
                              title={Object.values(users).map((u) => u.name).join(", ")}
                              onClick={() => toggleReaction(m.id, emoji)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                                padding: isMobile ? "2px 6px" : "3px 10px",
                                borderRadius: 20,
                                border: "1px solid rgba(255,255,255,.12)",
                                background: "rgba(255,255,255,.08)",
                                color: "inherit",
                                cursor: "pointer",
                                fontSize: isMobile ? ".68rem" : ".75rem",
                                transition: ".2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,.15)";
                                e.currentTarget.style.transform = "scale(1.05)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,.08)";
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                            >
                              {emoji} {Object.keys(users).length}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, justifyContent: isMobile ? "flex-end" : "flex-start", flexWrap: "wrap", alignItems: "center" }}>
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

                        {ownerToken && (
                          <BubbleActionButton
                            type="button"
                            onClick={() => {
                              const isPinned = pinnedMessages.some(pm => pm.id === m.id);
                              if (isPinned) {
                                socketRef.current?.emit("unpinMessage", { messageId: m.id });
                                toast.success("Message unpinned");
                              } else {
                                socketRef.current?.emit("pinMessage", { messageId: m.id });
                                toast.success("Message pinned");
                              }
                            }}
                            data-tooltip={pinnedMessages.some(pm => pm.id === m.id) ? "Unpin" : "Pin"}
                            $active={pinnedMessages.some(pm => pm.id === m.id)}
                          >
                            <FaThumbtack size={12} style={{ transform: pinnedMessages.some(pm => pm.id === m.id) ? "none" : "rotate(45deg)" }} />
                          </BubbleActionButton>
                        )}

                        {m.userName === userName && m.text && !m.file && !m.poll && (Date.now() - m.ts < 15 * 60 * 1000) && (
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

                        {(m.text || m.file || m.gif) && !m.poll && (
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
                          data-tooltip={isBookmarked(m.id) ? "Saved" : "Bookmark"}
                          $active={isBookmarked(m.id)}
                        >
                          {isBookmarked(m.id) ? <FaBookmark size={11} /> : <FaRegBookmark size={11} />}
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

                        <BubbleActionButton
                          type="button"
                          className={`reaction-btn-${m.id}`}
                          onClick={() =>
                            setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)
                          }
                          data-tooltip="React"
                        >
                          😊
                        </BubbleActionButton>
                      </div>

                      {reactionPickerFor === m.id && (
                        <div
                          className={`reaction-picker-${m.id}`}
                          style={{
                            position: "absolute",
                            bottom: "110%",
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
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                border: 0,
                                background: "transparent",
                                cursor: "pointer",
                                fontSize: "1.1rem",
                                transition: ".15s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,.12)";
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

                </div>
              </MessageBubble>
            );
          })}
          {typingUsers.length > 0 && (
            <TypingIndicator>{typingUsers.join(", ")} typing…</TypingIndicator>
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

                      {pendingFiles.length === 1 ? null : (
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
                  onClick={() => {
                    setPendingFiles([]);
                    setSendAsViewOnce(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <AiOutlineClose />
                </CancelBtn>

                <SendBtn
                  onClick={() => {
                    handleSend();
                    setPendingFiles([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <FaPaperPlane />
                </SendBtn>
              </PreviewActions>
            </PreviewModal>
          </PreviewOverlay>
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
                background: "rgba(255,255,255,.06)",
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
                    background: "rgba(255,255,255,.08)",
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
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; e.currentTarget.style.color = "var(--chakra-colors-textSecondary)"; }}
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
                <IconButton
                  onClick={() => {
                    setShowGifPicker(true);
                    fetchGifs();
                  }}
                  title="Send GIF"
                >
                  <HiGif />
                </IconButton>
                <IconButton
                  onClick={() => setShowPollCreator(true)}
                  title="Create Poll"
                >
                  📊
                </IconButton>
                <IconButton
                  onClick={() => setShowScheduler(!showScheduler)}
                  title="Schedule Message"
                  style={{ color: showScheduler ? "var(--chakra-colors-brandPrimary)" : "inherit" }}
                >
                  ⏰
                </IconButton>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <EphemeralToggle
                    $active={roomEphemeralDuration > 0}
                    onClick={() => setShowEphemeralMenu(!showEphemeralMenu)}
                    title={roomEphemeralDuration > 0 ? `Disappearing messages ON` : "Disappearing messages OFF"}
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
                          {[
                            { label: "Off", value: 0 },
                            { label: "1 Hour", value: 3600 },
                            { label: "24 Hours", value: 86400 },
                            { label: "7 Days", value: 604800 },
                            { label: "30 Days", value: 2592000 }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={`option-btn ${roomEphemeralDuration === opt.value ? 'active' : ''}`}
                              onClick={() => {
                                socketRef.current.emit("updateRoomEphemeral", { roomId, ephemeralDuration: opt.value });
                                setShowEphemeralMenu(false);
                              }}
                            >
                              <span>{opt.label}</span>
                              {roomEphemeralDuration === opt.value && <span className="check">✓</span>}
                            </button>
                          ))}
                        </div>
                      </EphemeralMenuCard>
                    </>
                  )}
                </div>
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
                  border: "1px solid rgba(255, 255, 255, 0.08)",
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
                          background: "rgba(255, 255, 255, 0.1)",
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

            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, width: "100%" }}>
              <InputPill>
                {isMobile && (
                  <IconButton
                    type="button"
                    onClick={() => setShowMobileActions(!showMobileActions)}
                    title="More Actions"
                    style={{ color: showMobileActions ? "var(--chakra-colors-brandPrimary)" : "inherit", transform: showMobileActions ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}
                  >
                    ➕
                  </IconButton>
                )}

                <IconButton as="label" htmlFor="file-input" title="Upload File">
                  <FaPaperclip />
                </IconButton>

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

                <MessageInput
                  placeholder={ephemeralMode ? "💨 Ephemeral message..." : "Type a message..."}
                  value={message}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                />

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
                    <IconButton
                      onClick={() => {
                        setShowGifPicker(true);
                        fetchGifs();
                      }}
                      title="Send GIF"
                    >
                      <HiGif />
                    </IconButton>

                    <IconButton
                      onClick={() => setShowPollCreator(true)}
                      title="Create Poll"
                    >
                      📊
                    </IconButton>

                    <IconButton
                      onClick={() => setShowScheduler(!showScheduler)}
                      title="Schedule Message"
                      style={{ color: showScheduler ? "var(--chakra-colors-brandPrimary)" : "inherit" }}
                    >
                      ⏰
                    </IconButton>

                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <EphemeralToggle
                        $active={roomEphemeralDuration > 0}
                        onClick={() => setShowEphemeralMenu(!showEphemeralMenu)}
                        title={roomEphemeralDuration > 0 ? `Disappearing messages ON` : "Disappearing messages OFF"}
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
                              {[
                                { label: "Off", value: 0 },
                                { label: "1 Hour", value: 3600 },
                                { label: "24 Hours", value: 86400 },
                                { label: "7 Days", value: 604800 },
                                { label: "30 Days", value: 2592000 }
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  className={`option-btn ${roomEphemeralDuration === opt.value ? 'active' : ''}`}
                                  onClick={() => {
                                    socketRef.current.emit("updateRoomEphemeral", { roomId, ephemeralDuration: opt.value });
                                    setShowEphemeralMenu(false);
                                  }}
                                >
                                  <span>{opt.label}</span>
                                  {roomEphemeralDuration === opt.value && <span className="check">✓</span>}
                                </button>
                              ))}
                            </div>
                          </EphemeralMenuCard>
                        </>
                      )}
                    </div>
                  </>
                )}
              </InputPill>

              <SendButton onClick={() => handleSend()} disabled={!message.trim()}>
                <FaPaperPlane />
              </SendButton>
            </div>
          </MessageInputContainer>
        )}

        <style>{`
          @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); } }
          @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        `}</style>

        {showScheduler && (
          <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 22000, background: "rgba(0,0,0,.68)", display: "grid", placeItems: "center", padding: 20 }}>
            <div style={{ width: "min(400px, 100%)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
              <h3 style={{ margin: "0 0 8px" }}>⏰ Schedule Message</h3>
              <p style={{ margin: "0 0 16px", color: "var(--chakra-colors-textSecondary)", fontSize: "0.85rem" }}>
                Choose when to send your composed message.
              </p>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16, fontSize: "0.9rem", color: "var(--chakra-colors-textPrimary)" }}>
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
                <button type="button" onClick={() => setShowScheduler(false)} style={{ border: 0, padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,.08)", color: "#fff", fontWeight: 700 }}>
                  Cancel
                </button>
                <button type="button" onClick={handleScheduleMessage} style={{ border: 0, padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: "var(--chakra-colors-brandPrimary)", color: "#fff", fontWeight: 800 }}>
                  Schedule
                </button>
              </div>

              {scheduledMessages.length > 0 && (
                <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>Pending Scheduled</h4>
                  <div style={{ display: "grid", gap: 8, maxHeight: 150, overflowY: "auto" }}>
                    {scheduledMessages.map((m) => (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 6, fontSize: "0.8rem" }}>
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
          <div role="dialog" aria-modal="true" style={{ position: "fixed", top: 0, bottom: 0, right: 0, width: "min(380px, 100vw)", zIndex: 20000, background: "var(--chakra-colors-surface)", borderLeft: "1px solid rgba(255,255,255,0.12)", boxShadow: "-10px 0 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                  <div key={b.id} style={{ background: "rgba(255,255,255,0.03)", padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--chakra-colors-brandPrimary)" }}>{b.userName}</span>
                      <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>{new Date(b.ts).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "var(--chakra-colors-textPrimary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {b.text}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                      <button type="button" onClick={() => {
                        const target = messageRefs.current[b.id];
                        if (target) {
                          target.scrollIntoView({ behavior: "smooth", block: "center" });
                          target?.animate([{ boxShadow: "0 0 0 0 rgba(5,150,105,0)", backgroundColor: "transparent" }, { boxShadow: "0 0 0 4px rgba(5,150,105,.9)", backgroundColor: "rgba(5,150,105,.16)", offset: 0.12 }, { boxShadow: "0 0 0 4px rgba(5,150,105,.7)", backgroundColor: "rgba(5,150,105,.12)", offset: 0.82 }, { boxShadow: "0 0 0 0 rgba(5,150,105,0)", backgroundColor: "transparent" }], { duration: 2600, easing: "ease-in-out" });
                          setShowBookmarks(false);
                        } else {
                          toast.error("Message not loaded in current view");
                        }
                      }} style={{ border: 0, background: "transparent", color: "var(--chakra-colors-brandPrimary)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
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
            <div style={{ width: "min(400px, 100%)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
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
                        <kbd key={i} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "2px 6px", fontSize: "0.75rem", fontWeight: 700, fontFamily: "monospace" }}>{k}</kbd>
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
        {backgroundTarget && <div role="dialog" aria-modal="true" aria-label="Choose background audience" style={{ position: "fixed", inset: 0, zIndex: 21500, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.68)", backdropFilter: "blur(8px)" }}><section style={{ width: "min(100%, 420px)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.12)" }}><h3 style={{ margin: "0 0 8px" }}>Where should this background apply?</h3><p style={{ margin: "0 0 20px", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.5 }}>Choose a personal background, or enforce one for the whole room.</p><div style={{ display: "grid", gap: 10 }}><button type="button" onClick={() => { const file = backgroundTarget; setBackgroundTarget(null); applyBackgroundChange(file, "personal"); }} style={{ minHeight: 48, borderRadius: 11, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.06)", color: "inherit", cursor: "pointer", fontWeight: 750 }}>Only me</button><button type="button" onClick={() => { const file = backgroundTarget; setBackgroundTarget(null); applyBackgroundChange(file, "everyone"); }} style={{ minHeight: 48, borderRadius: 11, border: 0, background: "var(--chakra-colors-brandPrimary)", color: "white", cursor: "pointer", fontWeight: 800 }}>Everyone in this room</button><button type="button" onClick={() => setBackgroundTarget(null)} style={{ minHeight: 40, border: 0, background: "transparent", color: "var(--chakra-colors-textSecondary)", cursor: "pointer" }}>Cancel</button></div></section></div>}
        {confirmation && (
          <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 21000, background: "rgba(0,0,0,.68)", display: "grid", placeItems: "center", padding: 20 }}>
            <div style={{ width: "min(420px, 100%)", padding: 24, borderRadius: 18, background: "var(--chakra-colors-surface)", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
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
                      background: "rgba(255, 255, 255, 0.08)",
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
                      background: "rgba(255, 255, 255, 0.08)",
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
            {(!fullscreen.type || (!fullscreen.type.startsWith("image") && !fullscreen.type.startsWith("video"))) && (
              <div style={{ textAlign: "center", color: "var(--chakra-colors-textPrimary)", padding: "40px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "24px", border: "1px solid rgba(255, 255, 255, 0.08)", maxWidth: "500px", animation: "popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }} onClick={(e) => e.stopPropagation()}>
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
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 9999, color: '#fff' }}>Loading Whiteboard…</div>}>
          <Whiteboard
            socket={socketRef.current}
            roomId={roomId}
            isAdmin={!!ownerToken}
            onClose={() => setShowWhiteboard(false)}
          />
        </Suspense>
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
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 9999, color: '#fff' }}>Loading Meeting…</div>}>
          <LiveMeeting
            socket={socketRef.current}
            roomId={roomId}
            userName={userName}
            isAdmin={!!ownerToken}
            ownerToken={ownerToken}
            userAvatar={userAvatar}
            onClose={closeMeeting}
          />
        </Suspense>
      )}
      {renderPollCreator()}
      {renderForwardDialog()}
    </>
  );
}
