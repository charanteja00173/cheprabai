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

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const scaleUp = keyframes`
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
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
  padding: clamp(10px, 2vw, 20px);
  min-height: 64px;
  background: rgba(10, 10, 10, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: var(--chakra-colors-textPrimary);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  box-sizing: border-box;
  z-index: 10;

  @media (max-width: 480px) {
    padding: 8px 12px;
    min-height: 52px;
  }
`;

const Avatar = styled.img`
  width: clamp(32px, 4vw, 36px);
  height: clamp(32px, 4vw, 36px);
  border-radius: 50%;
  margin-right: clamp(8px, 1.5vw, 12px);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.25);
`;

const RoomActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: clamp(8px, 2vw, 14px);
  flex-wrap: nowrap;
`;

const ActionButton = styled.button`
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  font-size: 1.15rem;
  min-width: 42px;
  min-height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    border-color: var(--chakra-colors-brandPrimary);
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 480px) {
    min-width: 34px;
    min-height: 34px;
    font-size: 1rem;
    border-radius: 8px;
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
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 14px;
  padding: 8px;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--chakra-colors-brandPrimary);
    transform: translateY(-1px);
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
  width: 100%;
  height: 100%;
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
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: rgba(8, 8, 12, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  animation: ${fadeIn} 0.25s ease-out;
`;

const PreviewModal = styled.div`
  background: rgba(15, 15, 20, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: 24px;
  width: min(90%, 500px);
  max-height: 85vh;
  padding: clamp(20px, 4vw, 28px);
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 
    0 10px 30px rgba(0, 0, 0, 0.3),
    0 30px 60px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  animation: ${scaleUp} 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

  @media (max-width: 600px) {
    width: 95%;
    max-height: calc(100vh - var(--safe-top) - var(--safe-bottom) - 24px);
    padding: 16px;
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
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
`;

const PreviewActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
`;

const PreviewButton = styled.button`
  padding: 12px 24px;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.95rem;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  }

  &:active {
    transform: translateY(0);
  }
`;

const CancelBtn = styled(PreviewButton)`
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--chakra-colors-textPrimary);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
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
  padding: 14px 24px;
  background: rgba(10, 10, 14, 0.5);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  gap: 12px;
  padding-bottom: calc(14px + var(--safe-bottom));
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.15);
  
  @media (max-width: 600px) {
    padding: 10px 12px;
    padding-bottom: calc(10px + var(--safe-bottom));
    gap: 8px;

    /* Target nested timer text */
    span {
      font-size: 0.72rem !important;
      min-width: 24px !important;
    }

    /* Target voice record button and timer controls */
    button {
      width: 38px !important;
      height: 38px !important;
      font-size: 0.9rem !important;
      border-radius: 10px !important;
    }

    /* Target Ephemeral toggle button specifically */
    button[title*="Ephemeral"] {
      padding: 6px 10px !important;
      font-size: 0.82rem !important;
      border-radius: 12px !important;
    }
  }
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 14px 20px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: max(16px, 0.98rem);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
  }

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(0, 0, 0, 0.35);
    box-shadow: 
      0 0 0 1px var(--chakra-colors-brandPrimary),
      0 0 12px rgba(255, 63, 94, 0.15);
  }

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    opacity: 0.6;
  }

  @media (max-width: 600px) {
    padding: 10px 14px;
    font-size: 0.92rem;
    border-radius: 18px;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileUploadLabel = styled.label`
  font-size: 1.3rem;
  cursor: pointer;
  color: var(--chakra-colors-textSecondary);
  min-width: 44px;
  min-height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.25s;

  &:hover {
    color: var(--chakra-colors-textPrimary);
    background: var(--chakra-colors-surfaceHover);
    border-color: var(--chakra-colors-brandPrimary);
    transform: translateY(-2px);
  }

  @media (max-width: 480px) {
    min-width: 34px;
    min-height: 34px;
    font-size: 1.1rem;
    border-radius: 8px;
  }
`;

const SendButton = styled.button`
  width: 44px;
  height: 44px;
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
  box-shadow: 0 4px 10px rgba(0,0,0,0.25);

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 15px var(--chakra-colors-brandGlow);
  }

  &:active {
    transform: scale(0.95);
  }

  @media (max-width: 480px) {
    width: 34px;
    height: 34px;
  }
`;
/* ================= GIF PICKER IMPROVED ================= */

const GifPickerOverlay = styled(PreviewOverlay)`
  background: rgba(8, 8, 12, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
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

  padding: 20px;
  background: rgba(15, 15, 20, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: 24px;

  display: flex;
  flex-direction: column;
  gap: 16px;

  box-shadow: 
    0 10px 30px rgba(0, 0, 0, 0.35),
    0 30px 60px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  overflow: hidden;

  @media (max-width: 600px) {
    width: 95%;
    max-height: calc(100vh - var(--safe-top) - var(--safe-bottom) - 20px);
    padding: 16px;
  }
`;

const GifPickerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
`;

const GifSearchInput = styled.input`
  flex: 1;
  padding: 12px 20px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--chakra-colors-textPrimary);
  font-size: max(16px, 0.95rem);
  outline: none;
  box-sizing: border-box;
  transition: all 0.25s ease;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 10px rgba(255, 63, 94, 0.15);
  }

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    opacity: 0.6;
  }
`;

const SearchGifButton = styled.button`
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  border: none;
  color: #fff;
  border-radius: 24px;
  padding: 8px 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px var(--chakra-colors-brandGlow);
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
                        width: "100%", padding: "18px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.06)",
                        display: "flex", flexDirection: "column", gap: "8px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--chakra-colors-textPrimary)", opacity: 0.8 }}>Uploading: {m.file.name}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--chakra-colors-brandPrimary)", fontWeight: "bold" }}>...</span>
                        </div>
                        <div style={{ width: "100%", height: "4px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "10px", overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `100%`,
                            background: "linear-gradient(90deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary), var(--chakra-colors-brandPrimary))",
                            borderRadius: "10px",
                            animation: "pulse 1.5s infinite"
                          }} />
                        </div>
                      </div>
                    ) : (
                      <FileCard onClick={() => setFullscreen(m.file)}>
                        {m.file.type && m.file.type.startsWith("image") ? (
                          <img alt={m.file.name} src={m.file.url} style={{ width: "100%", borderRadius: 10, display: "block" }} />
                        ) : m.file.type && m.file.type.startsWith("video") ? (
                          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
                            <video src={m.file.url} style={{ width: "100%", display: "block" }} />
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: "50%", background: "var(--chakra-colors-brandPrimary)", boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}>
                                <FaPlay style={{ color: "white", fontSize: "1.2rem", marginLeft: "3px" }} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            display: "flex", alignItems: "center", gap: "12px", padding: "12px",
                            background: "rgba(255, 255, 255, 0.02)", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.05)",
                            minWidth: 0
                          }}>
                            <div style={{ fontSize: "2rem", flexShrink: 0, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" }}>
                              {m.file.name.match(/\.(xlsx|xls|csv)$/i) ? "📊" :
                                m.file.name.match(/\.(docx|doc)$/i) ? "📝" :
                                  m.file.name.match(/\.(zip|rar|7z)$/i) ? "🗜️" : "📎"}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                              <span style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--chakra-colors-textPrimary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {m.file.name}
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "var(--chakra-colors-brandPrimary)", marginTop: "2px", fontWeight: "500" }}>
                                {m.userName === userName ? "Shared File" : "Download Attachment"}
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
                  <div style={{ marginTop: 8, background: "rgba(0,0,0,0.2)", borderRadius: "16px", padding: "6px 12px", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <audio
                      src={m.file.url}
                      controls
                      style={{ width: "100%", maxWidth: "min(280px, 100%)", height: 32 }}
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
