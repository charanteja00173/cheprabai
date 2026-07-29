import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { io } from "socket.io-client";
import { Link } from "react-router-dom";
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
import { 
  generateKeyFromSecret, 
  encryptMessage, 
  decryptMessage, 
  encryptBinary, 
  decryptBinary 
} from "../utils/crypto";
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
  background: rgba(10, 10, 10, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: var(--chakra-colors-textPrimary);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.25);
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
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
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
  max-width: ${(p) => (p.isSystem ? "80%" : "clamp(70%, 80vw, 80%)")};
  padding: ${(p) => (p.isSystem ? "6px 14px" : p.isFile ? "10px" : "12px 20px")};

  background: ${(p) =>
    p.isSystem ? "transparent" :
      p.isSender ? "linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary))" :
        "rgba(255, 255, 255, 0.03)"};
  
  backdrop-filter: ${(p) => (p.isSystem ? "none" : p.isSender ? "none" : "blur(16px)")};
  -webkit-backdrop-filter: ${(p) => (p.isSystem ? "none" : p.isSender ? "none" : "blur(16px)")};

  border: ${(p) =>
    p.isSystem ? "none" :
      p.isSender ? "1px solid rgba(255, 255, 255, 0.08)" :
        "1px solid rgba(255, 255, 255, 0.06)"};

  border-radius: ${(p) =>
    p.isSystem ? "12px" :
      p.isSender ? "22px 22px 4px 22px" :
        "22px 22px 22px 4px"};

  box-shadow: ${(p) => p.isSystem ? "none" : "0 8px 24px rgba(0,0,0,0.15)"};

  align-self: ${(p) =>
    p.isSystem ? "center" : p.isSender ? "flex-end" : "flex-start"};

  color: ${(p) =>
    p.isSystem ? (p.systemType === "join" ? "#2ecc71" : "#e74c3c") :
      p.isSender ? "#fff" :
        "var(--chakra-colors-textPrimary)"};

  font-size: ${(p) => (p.isSystem ? "0.8rem" : "clamp(0.92rem, 0.25vw + 0.88rem, 1.05rem)")};
  font-style: ${(p) => (p.isSystem ? "italic" : "normal")};
  opacity: ${(p) => (p.isSystem ? 0.85 : 1)};
  text-align: left;
  position: relative;
  word-wrap: break-word;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: ${(p) => (p.isSystem ? "none" : "translateY(-1px)")};
    box-shadow: ${(p) => p.isSystem ? "none" : "0 10px 30px rgba(0,0,0,0.25)"};
  }

  @media (max-width: 480px) {
    max-width: ${(p) => (p.isSystem ? "90%" : "88%")};
    padding: ${(p) => (p.isSystem ? "4px 10px" : p.isFile ? "8px" : "10px 14px")};
    font-size: ${(p) => (p.isSystem ? "0.75rem" : "0.92rem")};
    border-radius: ${(p) =>
      p.isSystem ? "10px" :
        p.isSender ? "16px 16px 4px 16px" :
          "16px 16px 16px 4px"};
  }

  @media (max-width: 375px) {
    max-width: ${(p) => (p.isSystem ? "95%" : "92%")};
    padding: ${(p) => (p.isSystem ? "4px 8px" : p.isFile ? "6px" : "8px 12px")};
    font-size: ${(p) => (p.isSystem ? "0.72rem" : "0.88rem")};
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

const FileAttachmentWrapper = styled.div`
  width: 280px;
  max-width: 100%;
  box-sizing: border-box;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--chakra-colors-brandPrimary);
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  }

  @media (max-width: 480px) {
    width: 230px;
  }

  @media (max-width: 360px) {
    width: 200px;
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
  height: 100dvh;
  position: relative;
  background: var(--chakra-colors-bg);
  overflow: hidden;
  box-sizing: border-box;

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
`;

const JoinContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: min(420px, calc(100vw - 32px));
  background: rgba(15, 15, 20, 0.55);
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  padding: clamp(24px, 5vw, 40px);
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 4px 30px rgba(0, 0, 0, 0.4),
    0 25px 60px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  margin: 0 16px;
  box-sizing: border-box;
  z-index: 2;
  position: relative;

  @media (max-width: 480px) {
    padding: 20px;
    gap: 14px;
    border-radius: 24px;
  }
`;

const JoinInput = styled.input`
  padding: 14px 20px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 1rem;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);

  &:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.04);
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
    padding: 12px 16px;
    font-size: 0.95rem;
    border-radius: 12px;
  }
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
  padding: 0;
  z-index: 10;
  transition: color 0.2s;

  &:hover {
    color: var(--chakra-colors-textPrimary);
  }
`;

const JoinButton = styled.button`
  padding: 14px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 12px;
  min-height: 52px;
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
    padding: 12px;
    font-size: 0.95rem;
    min-height: 46px;
    border-radius: 12px;
    margin-top: 8px;
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
  background: linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(15, 15, 25, 0.98) 100%);
  border: ${(props) => (props.$isMobile ? "none" : "1px solid rgba(255, 255, 255, 0.06)")};
  border-radius: ${(props) => (props.$isMobile ? "0" : "24px")};
  padding: ${(props) => (props.$isMobile ? "0" : "20px")};
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  box-shadow: ${(props) => (props.$isMobile ? "none" : "0 20px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05)")};
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  background: linear-gradient(180deg, rgba(20, 20, 30, 0.98) 0%, rgba(15, 15, 25, 0.88) 100%);
  backdrop-filter: blur(20px);
  z-index: 3;
`;

const PreviewTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const PreviewTitle = styled.div`
  background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.92) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 1.18rem;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

const PreviewSubtitle = styled.div`
  color: rgba(255, 255, 255, 0.65);
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
  align-content: center;

  @media (max-width: 767px) {
    padding: 16px;
    gap: 12px;
    grid-template-columns: 1fr;
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
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
  transition: all 0.24s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform, border-color;
  backface-visibility: hidden;

  @media (hover: hover) {
    &:hover {
      transform: ${(props) => (props.$singleFile ? "none" : "translateY(-3px)")};
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
  }
`;

const PreviewMediaWrapper = styled.div`
  position: relative;
  width: 100%;
  flex: ${(props) => (props.$singleFile ? "1 1 auto" : "0 0 auto")};
  min-height: ${(props) => (props.$singleFile ? "360px" : "180px")};
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0.08) 100%);
  overflow: hidden;
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
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.75);
  text-align: center;
`;

const PreviewFileInfo = styled.div`
  padding: 18px 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PreviewFileName = styled.div`
  color: var(--chakra-colors-textPrimary);
  font-weight: 700;
  font-size: 0.96rem;
  line-height: 1.35;
  word-break: break-word;
`;

const PreviewFileMeta = styled.div`
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.82rem;
`;

const PreviewRemoveButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
  font-size: 0.82rem;

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.2);
  }
`;

const PreviewActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding: 22px 24px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  background: linear-gradient(180deg, rgba(15, 15, 25, 0.5) 0%, rgba(20, 20, 30, 0.6) 100%);

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
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--chakra-colors-textPrimary);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
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
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: rgba(10, 10, 14, 0.5);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  gap: 12px;
  padding-bottom: calc(10px + var(--safe-bottom));
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.15);
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 4px 8px;
  gap: 4px;
  min-width: 0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.25s ease;

  &:focus-within {
    border-color: var(--chakra-colors-brandPrimary);
    box-shadow: 
      inset 0 2px 4px rgba(0, 0, 0, 0.2),
      0 0 15px var(--chakra-colors-brandGlow);
    background: rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 480px) {
    padding: 2px 6px;
    border-radius: 20px;
    gap: 2px;
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
    background: rgba(255, 255, 255, 0.05);
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
    background: ${(p) => (p.$active ? "rgba(255, 71, 87, 0.18)" : "rgba(255, 255, 255, 0.05)")};
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
  background: linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(15, 15, 25, 0.98) 100%);
  border: ${(props) => (props.$isMobile ? "none" : "1px solid rgba(255, 255, 255, 0.06)")};
  border-radius: ${(props) => (props.$isMobile ? "0" : "24px")};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: auto;
  box-shadow: ${(props) => (props.$isMobile ? "none" : "0 20px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05)")};
  animation: ${scaleUp} 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);

  @media (max-width: 767px) {
    height: 100dvh;
    animation: ${slideUpMobile} 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
`;

const GifDrawerHandle = styled.div`
  display: none;
  @media (max-width: 767px) {
    display: flex;
    justify-content: center;
    padding: 10px 0 2px;
    background: rgba(255, 255, 255, 0.03);
    &::after {
      content: '';
      width: 42px;
      height: 4px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.22);
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
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.8) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  span.badge {
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ff6b6b;
    background: linear-gradient(135deg, rgba(255, 107, 107, 0.15) 0%, rgba(255, 63, 94, 0.1) 100%);
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
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.95rem;
  line-height: 1.55;
  max-width: 780px;
  letter-spacing: 0.01em;
  opacity: 0.95;

  @media (max-width: 767px) {
    font-size: 0.9rem;
  }
`;

const CloseGifPickerButton = styled.button`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  background: linear-gradient(180deg, rgba(20, 20, 30, 0.98) 0%, rgba(15, 15, 25, 0.88) 100%);
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
  color: rgba(255, 255, 255, 0.35);
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
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
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
  color: rgba(255, 255, 255, 0.38);
  flex: 1;

  .icon {
    font-size: 2.4rem;
    color: rgba(255, 255, 255, 0.18);
    margin-bottom: 14px;
  }

  .text {
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 6px;
    color: rgba(255, 255, 255, 0.78);
  }

  .subtext {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.45);
  }
`;

const GiphyAttribution = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 16px;
  background: rgba(11, 11, 18, 0.92);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.38);
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
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--chakra-colors-textPrimary);
  font-size: max(16px, 0.9rem);
  font-weight: 500;
  outline: none;
  box-sizing: border-box;
  transition: all 0.25s ease;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 0 3px rgba(255, 63, 94, 0.08);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.3);
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
  background: rgba(10, 10, 14, 0.65);
  padding: 10px 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  display: flex;
  gap: 12px;
  align-items: center;
  box-shadow: 
    0 10px 30px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
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
  position: absolute;
  top: 130%;
  left: 0;
  width: 290px;
  background: rgba(12, 12, 16, 0.7);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 20px;
  z-index: 1000;
  box-shadow: 
    0 10px 35px rgba(0, 0, 0, 0.4),
    0 30px 70px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  box-sizing: border-box;
  animation: slide-down-fade 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 480px) {
    position: fixed;
    top: 60px;
    left: 16px;
    right: 16px;
    width: auto;
  }
`;

// Stateful component to handle downloading, decrypting and displaying E2EE files
function E2EEFileAttachment({ file, roomKey, setFullscreen, isMobile }) {
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const lastDecryptedIvRef = useRef(null);
  const lastDecryptedSourceUrlRef = useRef(null);

  useEffect(() => {
    if (!file.iv || !roomKey) {
      setDecryptedUrl(file.url);
      setLoading(false);
      return;
    }

    // Optimization: If we already decrypted this exact payload (matching IV), reuse the blob URL
    if (decryptedUrl && lastDecryptedIvRef.current === file.iv) {
      lastDecryptedSourceUrlRef.current = file.url;
      return;
    }

    let active = true;
    const decrypt = async () => {
      try {
        setLoading(true);
        setError(false);

        // If the URL is external (e.g. Cloudinary), fetch via our backend proxy to avoid client-side CORS blocks
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

        const decryptedBuffer = await decryptBinary(roomKey, {
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
      // Note: Only revoke if the source URL actually changed or we unmount
      // Since we want to preserve blob during local-to-cloud transition, do not revoke if the IV matches
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.url, file.iv, roomKey]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "10px" }}>
        <div style={{
          width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)",
          borderTop: "2px solid var(--chakra-colors-brandPrimary)",
          borderRadius: "50%", animation: "spin 0.8s linear infinite"
        }} />
        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Decrypting secure payload...</span>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "rgba(255, 107, 107, 0.05)", borderRadius: "10px", border: "1px solid rgba(255, 107, 107, 0.2)", color: "#ff6b6b" }}>
        <span style={{ fontSize: "0.85rem" }}>🔒 File decryption failed</span>
      </div>
    );
  }

  if (file.type && file.type.startsWith("audio")) {
    return (
      <FileAttachmentWrapper style={{ padding: "10px 12px", background: "rgba(255, 255, 255, 0.02)", cursor: "default" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: "1.1rem" }}>🎵</span>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--chakra-colors-textPrimary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
        </div>
        <audio
          src={decryptedUrl}
          controls
          style={{ width: "100%", height: 32, display: "block" }}
        />
      </FileAttachmentWrapper>
    );
  }

  return (
    <FileAttachmentWrapper onClick={() => setFullscreen({ ...file, url: decryptedUrl })}>
      {file.type && file.type.startsWith("image") ? (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}>
          <img alt={file.name} src={decryptedUrl} style={{ width: "100%", maxHeight: "240px", objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "#eee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{file.name}</span>
            <FaSearch style={{ fontSize: "0.75rem", color: "#eee" }} />
          </div>
        </div>
      ) : file.type && file.type.startsWith("video") ? (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}>
          <video src={decryptedUrl} style={{ width: "100%", maxHeight: "240px", objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "50%", background: "var(--chakra-colors-brandPrimary)", boxShadow: "0 4px 15px rgba(0,0,0,0.35)" }}>
              <FaPlay style={{ color: "white", fontSize: "1rem", marginLeft: "2px" }} />
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "#eee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{file.name}</span>
          </div>
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: "12px", padding: "12px",
          background: "rgba(255, 255, 255, 0.02)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.05)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.15)", minWidth: 0
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 42, height: 42, borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            fontSize: "1.5rem", flexShrink: 0
          }}>
            {file.name.match(/\.(xlsx|xls|csv)$/i) ? "📊" :
              file.name.match(/\.(docx|doc)$/i) ? "📝" :
                file.name.match(/\.(zip|rar|7z)$/i) ? "🗜️" :
                  file.name.match(/\.pdf$/i) ? "📕" : "📎"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, flex: 1 }}>
            <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "var(--chakra-colors-textPrimary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {file.name}
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--chakra-colors-brandPrimary)", marginTop: "2px", fontWeight: "600" }}>
              🔒 Secure E2EE Payload
            </span>
          </div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: "50%",
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
        src={gif.images.fixed_height.url}
        alt={gif.title || "GIF"}
        loading="lazy"
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
  const socketRef = useRef(null);
  const audioRef = useRef(new Audio(notificationSound));
  const userColorsRef = useRef({});

  const [joined, setJoined] = useState(false);
  const [roomKey, setRoomKey] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);

  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingFilesUrls, setPendingFilesUrls] = useState({});
  const [fullscreen, setFullscreen] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
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

  const lastMessageIdRef = useRef(null);

  // ── Manage blob URLs for pending files to prevent flickering ──
  useEffect(() => {
    const newUrls = {};
    pendingFiles.forEach((file, idx) => {
      const key = `${file.name}-${file.size}-${idx}`;
      if (!pendingFilesUrls[key]) {
        newUrls[key] = URL.createObjectURL(file);
      } else {
        newUrls[key] = pendingFilesUrls[key];
      }
    });

    setPendingFilesUrls(newUrls);

    return () => {
      // Only revoke URLs for files that are no longer in pendingFiles
      Object.entries(pendingFilesUrls).forEach(([key, url]) => {
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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchGifs = async (query = "", offset = 0) => {
    if (loadingGifsRef.current) return;
    loadingGifsRef.current = true;

    const API_KEY = process.env.REACT_APP_GIPHY_API_KEY;
    const url = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${query}&limit=${GIF_LIMIT}&offset=${offset}`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&limit=${GIF_LIMIT}&offset=${offset}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.data.length < GIF_LIMIT) setHasMoreGifs(false);
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
      console.error("GIF fetch error:", err);
    } finally {
      loadingGifsRef.current = false;
    }
  };

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
        const nextOffset = gifOffset + GIF_LIMIT;
        setGifOffset(nextOffset);
        fetchGifs(gifQuery, nextOffset);
      }
    };

    grid.addEventListener("scroll", handleScroll, { passive: true });
    return () => grid.removeEventListener("scroll", handleScroll);
  }, [showGifPicker, gifOffset, gifQuery, hasMoreGifs]);

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

  const handleLeaveRoom = () => {
    const confirmLeave = window.confirm(
      "Are you sure you want to leave this room? Your session history will be cleared.",
    );
    if (!confirmLeave) return;

    if (socketRef.current) {
      socketRef.current.emit("leaveRoom", { roomId, userName });
    }

    // Reset local state completely
    setJoined(false);
    setMessages([]);
    setRoomId("");
    setUserName("");
    setSecurityCode("");
    setRoomKey(null);
    setOwnerToken(null);
    setPendingFiles([]);
    setUploadProgress(0);
    setOnlineUsers([]);
    setShowMeeting(false);
    setShowWhiteboard(false);
    setLatency(0);
  };
  /* ================= SOCKET ================= */

  useEffect(() => {
    socketRef.current = io(process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com", {
      transports: ["polling", "websocket"]
    });
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

    socketRef.current.emit("joinRoom", { roomId, userName, securityCode });

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
        socketRef.current.emit("joinRoom", { roomId, userName, securityCode });
      }
    });

    socketRef.current.on("disconnect", () => { });

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
  }, [joined, roomId, userName, roomKey, securityCode]);

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

  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file) => {
    try {
      const tempId = `uploading-${Date.now()}`;
      setUploadProgress(0);
      setMessages(m => [...m, { id: tempId, userName, file: { name: file.name, loading: true }, ts: Date.now() }]);

      let fileToUpload = file;
      let ivString = null;

      if (roomKey) {
        const fileBuffer = await file.arrayBuffer();
        const encrypted = await encryptBinary(roomKey, fileBuffer);
        const encryptedBlob = new Blob([encrypted.data], { type: "application/octet-stream" });
        fileToUpload = new File([encryptedBlob], file.name + ".enc", { type: "application/octet-stream" });
        ivString = btoa(String.fromCharCode(...new Uint8Array(encrypted.iv)));
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
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      );

      setMessages(m => m.filter(msg => msg.id !== tempId));
      setUploadProgress(0);

      const fileData = { 
        url: res.data.secure_url, 
        name: file.name, 
        type: file.type || res.data.format,
        ...(ivString && { iv: ivString })
      };
      handleSend({ file: fileData });
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.error || "File upload failed!";
      toast.error(errorMsg);
      setMessages(m => m.filter(msg => !msg.id?.startsWith("uploading-")));
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

  const handleSend = async (customData = null) => {
    if (!customData && pendingFiles.length > 0) {
      const filesToUpload = [...pendingFiles];
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      filesToUpload.forEach((f) => uploadFile(f));
      return;
    }
    if (!customData && !message.trim()) return;

    let payload = customData || { text: message };

    if (roomKey) {
      // Encrypt the entire payload object as a JSON string for complete E2EE (covers text, file metadata, and GIFs)
      const plainPayload = customData || { text: message };
      const encrypted = await encryptMessage(roomKey, JSON.stringify(plainPayload));
      payload = { 
        encryptedPayload: encrypted,
        ...(customData && customData.file && { file: customData.file })
      };
    }

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
        <LandingWrapper>
          <FloatingBlob />
          <JoinContainer>
            <div style={{ textAlign: "center", marginBottom: "15px" }}>
              <div style={{
                display: "inline-flex",
                background: "rgba(255, 63, 94, 0.08)",
                border: "1px solid rgba(255, 63, 94, 0.25)",
                boxShadow: "0 0 15px rgba(255, 63, 94, 0.15)",
                padding: "16px",
                borderRadius: "50%",
                marginBottom: "20px"
              }}>
                <ShieldCheck size={36} color="var(--chakra-colors-brandPrimary)" />
              </div>
              <h2 style={{ color: "var(--chakra-colors-textPrimary)", margin: 0, fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.5px" }}>Secure Session</h2>
              <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "clamp(0.85rem, 2vw, 0.95rem)", marginTop: "8px", opacity: 0.85 }}>Enter details to join the encrypted room</p>
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

            <PasswordInputContainer>
              <PasswordInput
                type={showPassword ? "text" : "password"}
                placeholder="Security Code"
                value={securityCode}
                onChange={(e) => setSecurityCode(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    const code = securityCode.trim();
                    if (!SECURITY_CODE.includes(code)) {
                      toast.error("Invalid security code! Please check and try again.");
                      return;
                    }
                    try {
                      const key = await generateKeyFromSecret(code + roomId);
                      setRoomKey(key);
                      setJoined(true);
                    } catch (err) {
                      toast.error("Failed to initialize secure session keys");
                    }
                  }
                }}
              />
              <EyeButton 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide security code" : "Show security code"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </EyeButton>
            </PasswordInputContainer>

            <JoinButton
              onClick={async () => {
                const code = securityCode.trim();

                if (!SECURITY_CODE.includes(code)) {
                  toast.error(
                    "Invalid security code! Please check and try again.",
                  );
                  return;
                }

                try {
                  const key = await generateKeyFromSecret(code + roomId);
                  setRoomKey(key);
                  setJoined(true);
                } catch (err) {
                  toast.error("Failed to initialize secure session keys");
                }
              }}
            >
              Join Secure Room
            </JoinButton>

            <Link
              to="/admin"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "16px",
                color: "var(--chakra-colors-textSecondary)",
                fontSize: "0.85rem",
                textDecoration: "none",
                fontWeight: "600",
                transition: "color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.color = "var(--chakra-colors-brandPrimary)"}
              onMouseLeave={(e) => e.target.style.color = "var(--chakra-colors-textSecondary)"}
            >
              🛡️ Super Admin Console
            </Link>
          </JoinContainer>
        </LandingWrapper>
      </>
    );
  }

  return (
    <>
      <ChatContainer>
        <Header>
          <Avatar src={image} alt="Logo" />
          <div
            style={{ display: "flex", flexDirection: "column", cursor: "pointer", position: "relative", minWidth: 0, flex: "1 1 auto", overflow: "hidden" }}
            onClick={() => setShowRoomInfo(!showRoomInfo)}
          >
            <div style={{ fontWeight: "bold", fontSize: "clamp(0.85rem, 2.5vw, 1.1rem)", display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "clamp(60px, 25vw, 300px)" }}>{roomId}</span>
              <span style={{ fontSize: "0.55rem", opacity: 0.5, flexShrink: 0 }}>▼</span>
            </div>
            <div style={{ fontSize: "clamp(0.65rem, 1.8vw, 0.8rem)", color: "#aaa" }}>
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
                  <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 10, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
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
                    <Link
                      to="/admin"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        width: "100%", padding: "8px 12px", borderRadius: 10,
                        background: "rgba(255, 63, 94, 0.08)", border: "1px solid rgba(255, 63, 94, 0.25)",
                        color: "var(--chakra-colors-brandPrimary)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                        textDecoration: "none", boxSizing: "border-box", transition: "all 0.2s"
                      }}
                    >
                      🛡️ Super Admin Panel
                    </Link>
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

            <ActionButton onClick={handleLeaveRoom} title="Leave Room" style={{ color: "var(--chakra-colors-brandPrimary)" }}>
              <FaSignOutAlt />
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
                title="Destroy Room"
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
                      <a
                        key={j}
                        href={part}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "var(--chakra-colors-brandPrimary)",
                          textDecoration: "underline",
                          fontWeight: "600",
                          wordBreak: "break-all"
                        }}
                      >
                        {part}
                      </a>
                    );
                  })}

                {m.gif && (
                  <img
                    src={m.gif}
                    alt="GIF"
                    style={{ maxWidth: "clamp(150px, 50vw, 200px)", borderRadius: 10, marginTop: "8px", cursor: "pointer" }}
                    onClick={() => setFullscreen({ url: m.gif, type: "image" })}
                  />
                )}

                {m.file && (
                  <div style={{ position: "relative" }}>
                    {m.file.loading ? (
                       <div style={{
                         width: "100%", padding: "18px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.06)",
                         display: "flex", flexDirection: "column", gap: "8px"
                       }}>
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                           <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--chakra-colors-textPrimary)", opacity: 0.8 }}>Uploading: {m.file.name}</span>
                           <span style={{ fontSize: "0.75rem", color: "var(--chakra-colors-brandPrimary)", fontWeight: "bold" }}>{uploadProgress > 0 ? `${uploadProgress}%` : "Preparing..."}</span>
                         </div>
                         <div style={{ width: "100%", height: "4px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "10px", overflow: "hidden" }}>
                           <div style={{
                             height: "100%",
                             width: uploadProgress > 0 ? `${uploadProgress}%` : "30%",
                             background: "linear-gradient(90deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary))",
                             borderRadius: "10px",
                             transition: "width 0.3s ease",
                             ...(uploadProgress === 0 && { animation: "pulse 1.5s infinite" })
                           }} />
                         </div>
                       </div>
                    ) : (
                      <E2EEFileAttachment file={m.file} roomKey={roomKey} setFullscreen={setFullscreen} isMobile={isMobile} />
                    )}
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
                      setShowGifPicker(false);
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
          <PreviewOverlay onClick={() => setPendingFiles([])}>
            <PreviewModal $isMobile={isMobile} onClick={(e) => e.stopPropagation()}>
              <PreviewHeader>
                <PreviewTitleGroup>
                  <PreviewTitle>
                    {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""} selected
                  </PreviewTitle>
                  <PreviewSubtitle>
                    Review your selected files before sending — tap any preview to inspect it in full size.
                  </PreviewSubtitle>
                </PreviewTitleGroup>
                <PreviewCloseButton
                  onClick={() => {
                    setPendingFiles([]);
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

        <MessageInputContainer>
          <InputPill>
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
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping?.(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSend?.()}
            />

            <IconButton
              onClick={() => {
                setShowGifPicker(true);
                fetchGifs();
              }}
              title="Send GIF"
            >
              <HiGif />
            </IconButton>

            <EphemeralToggle
              $active={ephemeralMode}
              onClick={() => {
                setEphemeralMode(!ephemeralMode);
                toast.info(ephemeralMode ? 'Ephemeral mode OFF' : 'Ephemeral mode ON — messages vanish in 15s');
              }}
              title={ephemeralMode ? "Ephemeral ON (messages vanish in 15s)" : "Ephemeral OFF"}
            >
              <FaClock />
            </EphemeralToggle>
          </InputPill>

          <SendButton onClick={() => handleSend()} disabled={!message.trim()}>
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

            {fullscreen.type && fullscreen.type.startsWith("image") && (
              <img
                alt={fullscreen.name}
                src={fullscreen.url}
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "95%", maxHeight: "85vh", objectFit: "contain", borderRadius: "20px", animation: "popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}
              />
            )}
            {fullscreen.type && fullscreen.type.startsWith("video") && (
              <video
                src={fullscreen.url}
                controls
                autoPlay
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "95%", maxHeight: "85vh", objectFit: "contain", borderRadius: "20px", animation: "popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)", background: "rgba(0, 0, 0, 0.16)" }}
              />
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
