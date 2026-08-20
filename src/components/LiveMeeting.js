import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styled, { keyframes, StyleSheetManager, css } from "styled-components";
import { 
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, 
  FaPhoneSlash, FaSync, FaDesktop, FaRecordVinyl, 
  FaCompress, FaExpand, FaExchangeAlt, 
  FaThLarge, FaUsers, FaHandPaper, 
  FaWifi, FaSignal, FaWindowMinimize, FaTimes, 
  FaTrash, FaVolumeUp, FaVolumeMute, FaVolumeDown, FaChartLine, FaCrown,
  FaLeaf, FaBolt, FaHeadphones, FaGem, FaExclamationTriangle,
  FaPlay, FaPause, FaPlayCircle,
  FaRedo, FaUndo, FaStop, FaThumbtack, FaPaintBrush,
  FaMagic, FaPalette
} from "react-icons/fa";
import * as PeerModule from "peerjs";
import { toast } from "react-toastify";

const Peer = PeerModule.Peer || PeerModule.default || PeerModule;

// Prevent extension interference
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    if (e.message && e.message.includes("chrome-extension")) {
      e.preventDefault();
      return true;
    }
  });
}

/* ═══════════════════════════════ ANIMATIONS ═══════════════════════════════ */
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.97) translateY(8px); } 
  to { opacity: 1; transform: scale(1) translateY(0); }
`;
const slideUp = keyframes`
  from { opacity: 0; transform: translateY(24px) scale(0.96); } 
  to { opacity: 1; transform: translateY(0) scale(1); }
`;
const slideInRight = keyframes`
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
`;
const spin = keyframes`
  from { transform: rotate(0deg); } 
  to { transform: rotate(360deg); }
`;
const pulseGlow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(0, 242, 254, 0.4); } 
  70% { box-shadow: 0 0 0 10px rgba(0, 242, 254, 0); } 
  100% { box-shadow: 0 0 0 0 rgba(0, 242, 254, 0); }
`;
const floatUp = keyframes`
  0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; } 
  100% { transform: translateY(-400px) scale(1.6) rotate(15deg); opacity: 0; }
`;
const eqBar = keyframes`
  0%, 100% { height: 3px; }
  50% { height: 14px; }
`;

/* ═══════════════════════════════ STYLED COMPONENTS ═══════════════════════════════ */
const MeetingContainer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10005;
  background: #090a10;
  display: flex;
  flex-direction: column;
  color: #ffffff;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  animation: ${fadeIn} 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  ${props => props.$minimized && css`
    inset: auto;
    bottom: 24px;
    right: 24px;
    width: 320px;
    height: 190px;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1);
    cursor: grab;
    overflow: hidden;
    z-index: 10010;
    touch-action: none;
    &:active { cursor: grabbing; }
    .meeting-header, .controls-bar, .participant-sidebar, .main-video-area, .file-stream-controls,
    .desktop-only-controls, .mobile-primary-row, .mobile-secondary-row {
      display: none !important;
    }
  `}

  @media (max-width: 768px) {
    ${props => props.$minimized && css`
      width: 200px;
      height: 120px;
      bottom: 80px;
      right: 12px;
      border-radius: 12px;
    `}
  }

  @media (max-width: 480px) {
    ${props => props.$minimized && css`
      width: 160px;
      height: 100px;
      bottom: 70px;
      right: 8px;
      border-radius: 10px;
    `}
  }

  .hide-mobile { @media (max-width: 600px) { display: none !important; } }
  .desktop-only-controls { @media (max-width: 768px) { display: none !important; } }
`;

const BackgroundAtmosphere = styled.div`
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(circle at 15% 20%, rgba(79, 70, 229, 0.08) 0%, transparent 45%),
    radial-gradient(circle at 85% 80%, rgba(14, 165, 233, 0.07) 0%, transparent 45%),
    linear-gradient(180deg, #090a10 0%, #06070a 100%);
  pointer-events: none;
  z-index: 0;
`;

const MeetingHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(13, 15, 24, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  z-index: 20;
  flex-shrink: 0;
  gap: 12px;

  @media (max-width: 768px) {
    padding: 10px 14px;
    gap: 8px;
  }

  @media (max-width: 480px) {
    padding: 8px 10px;
    gap: 6px;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;

  @media (max-width: 480px) {
    gap: 4px;
  }
`;

const BrandBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #00f2fe;
    animation: ${pulseGlow} 2s infinite;
  }

  @media (max-width: 480px) {
    span:not(.live-dot) {
      display: none;
    }
  }
`;

const RoomTag = styled.span`
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 3px 9px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 600px) {
    display: none;
  }
`;

const StatusPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => {
    if (props.$mode === "good") return "rgba(16, 185, 129, 0.12)";
    if (props.$mode === "fair") return "rgba(245, 158, 11, 0.12)";
    if (props.$mode === "poor") return "rgba(239, 68, 68, 0.12)";
    return "rgba(99, 102, 241, 0.12)";
  }};
  border: 1px solid ${props => {
    if (props.$mode === "good") return "rgba(16, 185, 129, 0.25)";
    if (props.$mode === "fair") return "rgba(245, 158, 11, 0.25)";
    if (props.$mode === "poor") return "rgba(239, 68, 68, 0.25)";
    return "rgba(99, 102, 241, 0.25)";
  }};
  color: ${props => {
    if (props.$mode === "good") return "#34d399";
    if (props.$mode === "fair") return "#fbbf24";
    if (props.$mode === "poor") return "#f87171";
    return "#818cf8";
  }};

  &:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  @media (max-width: 500px) {
    padding: 4px 8px;
    font-size: 0.65rem;
    .status-label {
      display: none !important;
    }
  }
`;

const BandwidthDropdown = styled.div`
  position: relative;
`;

const BandwidthMenu = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 240px;
  background: rgba(18, 20, 32, 0.96);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 8px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
  z-index: 1000;
  animation: ${slideUp} 0.2s ease;

  @media (max-width: 600px) {
    left: 0;
    right: auto;
    width: min(240px, calc(100vw - 24px));
  }
`;

const BandwidthOption = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: none;
  background: ${props => props.$selected ? "rgba(99, 102, 241, 0.18)" : "transparent"};
  color: ${props => props.$selected ? "#a5b4fc" : "rgba(255, 255, 255, 0.85)"};
  font-size: 0.78rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }

  .desc {
    font-size: 0.68rem;
    opacity: 0.6;
    display: block;
    margin-top: 2px;
  }
`;

const IconButton = styled.button`
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$primary ? "#ff4757" : props.$active ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)"};
  border: 1px solid ${props => props.$primary ? "rgba(255, 71, 87, 0.35)" : props.$active ? "rgba(99, 102, 241, 0.35)" : "rgba(255, 255, 255, 0.07)"};
  color: ${props => props.$primary ? "#fff" : props.$active ? "#a5b4fc" : "rgba(255, 255, 255, 0.75)"};
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  flex-shrink: 0;

  &:hover {
    background: ${props => props.$primary ? "#ff3344" : "rgba(255, 255, 255, 0.1)"};
    color: #fff;
  }
  &:active { transform: scale(0.94); }

  @media (max-width: 768px) {
    width: 32px;
    height: 32px;
    font-size: 0.78rem;
  }

  @media (max-width: 480px) {
    width: 30px;
    height: 30px;
    font-size: 0.72rem;
    border-radius: 8px;
  }

  .badge {
    position: absolute;
    top: -3px;
    right: -3px;
    background: #4f46e5;
    color: #fff;
    font-size: 0.6rem;
    font-weight: 800;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #090a10;
  }
`;

const ContentArea = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  z-index: 1;
  padding: 10px 14px;
  gap: 8px;
  min-height: 0;

  @media (max-width: 768px) {
    padding: 6px 8px;
    gap: 6px;
  }

  @media (max-width: 600px) {
    padding: 4px 4px;
    gap: 4px;
  }
`;

const MainVideoArea = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  border-radius: 16px;
  overflow: hidden;

  @media (max-width: 768px) {
    border-radius: 12px;
  }

  @media (max-width: 480px) {
    border-radius: 8px;
  }
`;

const VideoGridContainer = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  gap: 8px;
  align-content: center;
  justify-content: center;
  padding: 4px;

  grid-template-columns: ${props => {
    const c = props.$count;
    if (c <= 1) return "1fr";
    if (c === 2) return "repeat(2, 1fr)";
    if (c <= 4) return "repeat(2, 1fr)";
    if (c <= 6) return "repeat(3, 1fr)";
    if (c <= 9) return "repeat(3, 1fr)";
    return "repeat(4, 1fr)";
  }};

  grid-template-rows: ${props => {
    const c = props.$count;
    if (c <= 2) return "1fr";
    if (c <= 4) return "repeat(2, 1fr)";
    if (c <= 6) return "repeat(2, 1fr)";
    if (c <= 9) return "repeat(3, 1fr)";
    return "repeat(3, 1fr)";
  }};

  @media (max-width: 768px) {
    gap: 6px;
    padding: 3px;
  }

  @media (max-width: 600px) {
    grid-template-columns: ${props => {
      const c = props.$count;
      if (c <= 1) return "1fr";
      return "repeat(2, 1fr)";
    }};
    grid-template-rows: auto;
    gap: 4px;
    padding: 2px;
    align-content: ${props => props.$count <= 2 ? "center" : "start"};
  }
`;

const VideoTile = styled.div`
  position: relative;
  background: #11131e;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  border: 2px solid ${props => props.$isSpeaking ? "#00f2fe" : props.$isPinned ? "#f59e0b" : "rgba(255, 255, 255, 0.06)"};
  transition: border-color 0.25s, box-shadow 0.25s;
  min-height: 0;
  min-width: 0;

  ${props => props.$isSpeaking && css`
    box-shadow: 0 0 16px rgba(0, 242, 254, 0.2);
  `}

  &:hover .tile-overlay { opacity: 1; }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #000;
  }

  @media (max-width: 768px) {
    border-radius: 10px;
    border-width: 1.5px;
  }

  @media (max-width: 480px) {
    border-radius: 8px;
  }
`;

const TileOverlay = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;

  @media (max-width: 768px) {
    opacity: 0.8;
    top: 4px;
    right: 4px;
    gap: 3px;
  }

  @media (max-width: 480px) {
    opacity: 1;
    top: 3px;
    right: 3px;
    gap: 2px;
  }
`;

const TileActionButton = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: ${props => {
    if (props.$danger) return "rgba(239, 68, 68, 0.85)";
    if (props.$active) return "rgba(245, 158, 11, 0.9)";
    return "rgba(0, 0, 0, 0.6)";
  }};
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: ${props => props.$active ? "#000" : "#fff"};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    transform: scale(1.1);
    background: ${props => {
      if (props.$danger) return "#ef4444";
      if (props.$active) return "#f59e0b";
      return "rgba(0, 0, 0, 0.85)";
    }};
  }

  @media (max-width: 600px) {
    width: 26px;
    height: 26px;
    font-size: 0.7rem;
    border-radius: 6px;
  }
`;

const TileUserInfo = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(10, 12, 20, 0.78);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  z-index: 5;
  max-width: calc(100% - 16px);

  @media (max-width: 768px) {
    bottom: 5px;
    left: 5px;
    padding: 2px 6px;
    font-size: 0.65rem;
    border-radius: 8px;
    gap: 3px;
    max-width: calc(100% - 10px);
  }

  @media (max-width: 480px) {
    bottom: 3px;
    left: 3px;
    padding: 2px 5px;
    font-size: 0.6rem;
    border-radius: 6px;
  }
`;

const EqualizerWaves = styled.div`
  display: inline-flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 12px;

  span {
    width: 2px;
    background: #00f2fe;
    border-radius: 1px;
    animation: ${eqBar} 0.8s ease-in-out infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }

  @media (max-width: 480px) { height: 10px; span { width: 1.5px; } }
`;

const AvatarPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #131728 0%, #0d0f1a 100%);
  gap: 10px;

  .circle {
    width: clamp(48px, 10vw, 90px);
    height: clamp(48px, 10vw, 90px);
    border-radius: 50%;
    background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(1.2rem, 2.5vw, 2.2rem);
    font-weight: 800;
    color: #fff;
    box-shadow: 0 8px 24px rgba(6, 182, 212, 0.25);
  }

  @media (max-width: 600px) { gap: 6px; }
`;

const ControlsDock = styled.footer`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  background: rgba(13, 15, 24, 0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  z-index: 20;
  gap: 8px;

  @media (max-width: 768px) {
    padding: 10px 12px;
    gap: 6px;
  }

  @media (max-width: 600px) {
    flex-direction: column;
    padding: 6px 8px;
    gap: 0;
    padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
  }
`;

const MobilePrimaryRow = styled.div`
  display: none;

  @media (max-width: 600px) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 4px 0;
  }
`;

const MobileSecondaryRow = styled.div`
  display: none;

  @media (max-width: 600px) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    overflow-x: auto;
    padding: 4px 0 2px;
    -webkit-overflow-scrolling: touch;
    &::-webkit-scrollbar { height: 0; }
  }
`;

const DockButton = styled.button`
  min-width: 42px;
  height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid ${props => {
    if (props.$danger) return "rgba(255, 71, 87, 0.45)";
    if (props.$warning) return "rgba(245, 158, 11, 0.35)";
    if (props.$active) return "rgba(79, 70, 229, 0.45)";
    return "rgba(255, 255, 255, 0.08)";
  }};
  background: ${props => {
    if (props.$danger) return "#ff4757";
    if (props.$warning) return "rgba(245, 158, 11, 0.15)";
    if (props.$active) return "rgba(79, 70, 229, 0.2)";
    return "rgba(255, 255, 255, 0.05)";
  }};
  color: ${props => {
    if (props.$danger) return "#fff";
    if (props.$warning) return "#fbbf24";
    if (props.$active) return "#a5b4fc";
    return "rgba(255, 255, 255, 0.85)";
  }};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
  position: relative;

  &:hover {
    background: ${props => props.$danger ? "#ff3344" : "rgba(255, 255, 255, 0.1)"};
    transform: translateY(-1px);
  }
  &:active { transform: scale(0.96); }

  @media (max-width: 768px) {
    min-width: 38px;
    height: 38px;
    padding: 0 10px;
    font-size: 0.78rem;
    gap: 5px;
  }

  @media (max-width: 600px) {
    min-width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
    font-size: 1rem;
    span { display: none !important; }
  }

  @media (max-width: 380px) {
    min-width: 40px;
    height: 40px;
  }
`;

const EmojiTray = styled.div`
  display: flex;
  gap: 4px;

  @media (max-width: 768px) { gap: 3px; }
  @media (max-width: 600px) { display: none !important; }
`;

const DockDivider = styled.div`
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 4px;
  flex-shrink: 0;

  @media (max-width: 768px) { height: 20px; margin: 0 2px; }
  @media (max-width: 600px) { display: none; }
`;

const ParticipantsDrawer = styled.aside`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 300px;
  background: rgba(15, 17, 28, 0.96);
  backdrop-filter: blur(24px);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  z-index: 50;
  animation: ${slideInRight} 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 600px) {
    width: 100%;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px 16px 0 0;
    top: auto;
    bottom: 0;
    max-height: 70vh;
  }
`;

const DrawerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  @media (max-width: 480px) {
    padding: 12px 14px;
    h3 { font-size: 0.82rem; }
  }
`;

const ParticipantList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ParticipantCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }
`;

const ParticipantRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const AvatarSmall = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  z-index: 10020;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  animation: ${fadeIn} 0.15s ease;

  @media (max-width: 480px) {
    padding: 8px;
    align-items: flex-end;
  }
`;

const ModalContent = styled.div`
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  padding: 22px;
  width: min(420px, calc(100% - 24px));
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  animation: ${slideUp} 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 480px) {
    padding: 18px 16px;
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-height: 85vh;
    h3 { font-size: 0.95rem !important; }
    p { font-size: 0.72rem !important; }
  }
`;

const ReactionParticle = styled.div`
  position: absolute;
  bottom: 60px;
  left: ${props => props.$x}%;
  font-size: 2rem;
  animation: ${floatUp} 2.5s ease-out forwards;
  pointer-events: none;
  z-index: 40;

  @media (max-width: 600px) { font-size: 1.6rem; bottom: 40px; }
`;

const SpinnerIcon = styled(FaSync)`
  animation: ${spin} 1.2s linear infinite;
  color: #00f2fe;
  font-size: 28px;

  @media (max-width: 480px) { font-size: 24px; }
`;

const PipWidget = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  background: #11131e;
  display: flex;
  align-items: center;
  justify-content: center;

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .pip-controls {
    position: absolute;
    bottom: 6px;
    left: 6px;
    right: 6px;
    display: flex;
    justify-content: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    padding: 4px;
    border-radius: 8px;
  }

  @media (max-width: 480px) {
    .pip-controls { bottom: 4px; left: 4px; right: 4px; gap: 4px; padding: 3px; border-radius: 6px; }
  }
`;

const SpotlightContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  gap: 8px;
  position: relative;
  box-sizing: border-box;

  @media (max-width: 600px) { gap: 4px; }
`;

const SpotlightMain = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  box-sizing: border-box;

  @media (max-width: 600px) { border-radius: 8px; }
`;

const SpotlightStrip = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 0 8px;
  flex-shrink: 0;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { height: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 2px; }

  @media (max-width: 480px) { gap: 4px; padding: 2px 0 4px; }
`;

const SpotlightThumbnail = styled.div`
  width: 140px;
  height: 90px;
  flex-shrink: 0;
  position: relative;
  background: #11131e;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid ${props => props.$isSpeaking ? "#00f2fe" : props.$isActive ? "#f59e0b" : "rgba(255, 255, 255, 0.06)"};
  cursor: pointer;
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:hover { transform: translateY(-1px); border-color: rgba(255, 255, 255, 0.2); }
  video { width: 100%; height: 100%; object-fit: cover; }

  @media (max-width: 768px) { width: 110px; height: 72px; }
  @media (max-width: 480px) { width: 90px; height: 60px; border-radius: 8px; }
`;

const ParticipantStrip = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  overflow-x: auto;
  flex-shrink: 0;
  background: rgba(13, 15, 24, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { height: 3px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  @media (max-width: 768px) {
    padding: 6px 8px;
    gap: 6px;
  }

  @media (max-width: 480px) {
    padding: 4px 6px;
    gap: 4px;
  }
`;

const ParticipantWidget = styled.div`
  width: 160px;
  height: 100px;
  flex-shrink: 0;
  position: relative;
  background: #11131e;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid ${props => props.$isHighlighted ? "#f59e0b" : props.$isSpeaking ? "#00f2fe" : props.$isMinimized ? "rgba(255,255,255,0.04)" : "rgba(255, 255, 255, 0.06)"};
  cursor: pointer;
  transition: all 0.2s ease;
  box-sizing: border-box;
  opacity: ${props => props.$isMinimized ? 0.5 : 1};

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.2);
    opacity: 1;
    .widget-controls { opacity: 1; }
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: 768px) {
    width: 120px;
    height: 78px;
  }

  @media (max-width: 480px) {
    width: 100px;
    height: 66px;
    border-radius: 8px;
  }

  @media (max-width: 380px) {
    width: 88px;
    height: 58px;
  }
`;

const WidgetControls = styled.div`
  position: absolute;
  top: 3px;
  right: 3px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 5;

  @media (max-width: 480px) { opacity: 0.8; }
`;

const WidgetBtn = styled.button`
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.6rem;
  transition: all 0.15s;
  background: ${props => props.$active ? "rgba(245, 158, 11, 0.3)" : "rgba(0,0,0,0.6)"};
  color: ${props => props.$active ? "#fbbf24" : "rgba(255,255,255,0.8)"};

  &:hover { background: ${props => props.$active ? "rgba(245, 158, 11, 0.5)" : "rgba(255,255,255,0.2)"}; }

  @media (max-width: 480px) { width: 18px; height: 18px; font-size: 0.55rem; }
`;

const WidgetNameTag = styled.div`
  position: absolute;
  bottom: 3px;
  left: 3px;
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(0,0,0,0.65);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.58rem;
  color: rgba(255,255,255,0.9);
  max-width: calc(100% - 6px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(4px);

  @media (max-width: 480px) { font-size: 0.52rem; padding: 1px 4px; }
`;

const FileStreamControlsCard = styled.div`
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(17, 19, 32, 0.97), rgba(10, 11, 20, 0.99));
  border: 1px solid rgba(129, 140, 248, 0.15);
  border-radius: 14px;
  padding: 12px 16px;
  width: min(90vw, 420px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 768px) {
    bottom: 70px;
    width: min(92vw, 380px);
    padding: 10px 14px;
    gap: 6px;
    border-radius: 12px;
  }

  @media (max-width: 600px) {
    bottom: auto;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(94vw, 340px);
    padding: 10px 12px;
    border-radius: 12px;
  }

  @media (max-width: 380px) {
    width: calc(100vw - 16px);
    padding: 8px 10px;
    gap: 5px;
    border-radius: 10px;
  }

  .stream-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .stream-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #fff;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1;

    .pulse-icon {
      color: #ef4444;
      animation: pulse-glow 1.5s infinite;
      flex-shrink: 0;
    }
  }

  .stream-time {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    font-variant-numeric: tabular-nums;

    input[type="range"] {
      flex: 1;
      height: 4px;
      border-radius: 2px;
      outline: none;
      background: rgba(255, 255, 255, 0.1);
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
      
      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #818cf8;
        cursor: pointer;
        box-shadow: 0 0 6px rgba(129, 140, 248, 0.5);
      }
    }
  }

  .stream-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .controls-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .volume-control {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.04);
    padding: 3px 6px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);

    .vol-icon {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.75rem;
      flex-shrink: 0;
      cursor: pointer;
      transition: color 0.2s;
      &:hover { color: #818cf8; }
    }

    .vol-slider {
      width: 50px;
      height: 3px;
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 2px;
      outline: none;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #818cf8;
      }
    }
  }

  .ctrl-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    width: 34px;
    height: 34px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;

    &:hover {
      background: rgba(255, 255, 255, 0.14);
      transform: scale(1.05);
    }
    &:active { transform: scale(0.95); }

    &.play-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      color: #fff;
      font-size: 0.92rem;
      border: none;
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
      &:hover {
        background: linear-gradient(135deg, #4f46e5, #6366f1);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.55);
      }
    }

    &.stop-btn {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.3);
      &:hover { background: #ef4444; color: #fff; }
    }

    &.speed-btn {
      width: auto;
      padding: 0 8px;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      background: rgba(129, 140, 248, 0.1);
      border-color: rgba(129, 140, 248, 0.2);
      color: #a5b4fc;
    }
  }

  @keyframes pulse-glow {
    0% { opacity: 0.3; }
    50% { opacity: 1; }
    100% { opacity: 0.3; }
  }

  @media (max-width: 480px) {
    .stream-info { font-size: 0.68rem; }
    .stream-time { gap: 4px; font-size: 0.65rem; }
    .controls-group { gap: 3px; }

    .ctrl-btn {
      width: 30px;
      height: 30px;
      border-radius: 7px;
      font-size: 0.7rem;
      &.play-btn { width: 38px; height: 38px; font-size: 0.85rem; }
      &.speed-btn { padding: 0 6px; font-size: 0.62rem; }
    }

    .volume-control {
      padding: 2px 5px;
      .vol-slider { width: 36px; }
    }
  }
`;

/* ═══════════════════════════════ STREAM MIXER UTILITY ═══════════════════════════════ */
// Dynamically overlays local camera as a PiP circle/card onto the main screen/file track,
// and mixes computer audio with the local microphone so everyone can hear both.
const createMixedStream = (mainStream, cameraStream, options = {}) => {
  const mixAudio = options.mixAudio !== false;
  const getVideoFilter = options.getVideoFilter || (() => "none");
  const getVoiceFilter = options.getVoiceFilter || (() => "none");

  const mainVideoTrack = mainStream.getVideoTracks()[0];
  const cameraVideoTrack = cameraStream?.getVideoTracks()[0];
  
  let mixedVideoTrack = mainVideoTrack;
  let mixerCleanup = () => {};
  
  if (cameraVideoTrack && mainVideoTrack) {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    
    const mainVideo = document.createElement("video");
    mainVideo.srcObject = new MediaStream([mainVideoTrack]);
    mainVideo.muted = true;
    mainVideo.playsInline = true;
    mainVideo.play().catch(() => {});
    
    const cameraVideo = document.createElement("video");
    cameraVideo.srcObject = new MediaStream([cameraVideoTrack]);
    cameraVideo.muted = true;
    cameraVideo.playsInline = true;
    cameraVideo.play().catch(() => {});
    
    let active = true;
    const draw = () => {
      if (!active) return;
      
      // Draw main track
      if (mainVideo.readyState >= 2) {
        ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#0c0d14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Draw camera track in corner if camera is enabled (not muted/black)
      if (cameraVideo.readyState >= 2 && cameraVideoTrack.enabled) {
        const pipW = 240;
        const pipH = 135;
        const x = canvas.width - pipW - 24;
        const y = canvas.height - pipH - 24;
        
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, pipW, pipH, 12);
        } else {
          ctx.rect(x, y, pipW, pipH);
        }
        ctx.closePath();
        ctx.clip();
        
        // 🔮 Apply dynamic camera video filters
        const activeFilter = getVideoFilter();
        if (activeFilter && activeFilter !== "none") {
          if (activeFilter === "grayscale") ctx.filter = "grayscale(100%)";
          else if (activeFilter === "sepia") ctx.filter = "sepia(100%)";
          else if (activeFilter === "invert") ctx.filter = "invert(100%)";
          else if (activeFilter === "blur") ctx.filter = "blur(6px)";
          else if (activeFilter === "vintage") ctx.filter = "contrast(125%) sepia(45%) saturate(140%)";
        }
        
        ctx.drawImage(cameraVideo, x, y, pipW, pipH);
        ctx.restore();
      }
      
      requestAnimationFrame(draw);
    };
    
    draw();
    
    const canvasStream = canvas.captureStream(30);
    mixedVideoTrack = canvasStream.getVideoTracks()[0];
    
    mixerCleanup = () => {
      active = false;
      mainVideo.pause();
      mainVideo.srcObject = null;
      mainVideo.remove();
      cameraVideo.pause();
      cameraVideo.srcObject = null;
      cameraVideo.remove();
      canvas.remove();
    };
  }
  
  // Audio mixing
  let mixedAudioTrack = null;
  const mainAudioTrack = mainStream.getAudioTracks()[0];
  const cameraAudioTrack = cameraStream?.getAudioTracks()[0];
  
  if (mixAudio && cameraAudioTrack && mainAudioTrack) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const mainSrc = audioCtx.createMediaStreamSource(new MediaStream([mainAudioTrack]));
      const camSrc = audioCtx.createMediaStreamSource(new MediaStream([cameraAudioTrack]));
      const dst = audioCtx.createMediaStreamDestination();
      
      mainSrc.connect(dst);
      
      // Dynamic DSP effects routing
      const camGain = audioCtx.createGain();
      camGain.gain.value = 1.0;
      camSrc.connect(camGain);
      
      const effects = {
        clean: audioCtx.createGain(),
        robot: audioCtx.createGain(),
        telephone: audioCtx.createGain(),
        echo: audioCtx.createGain(),
      };
      
      // Clean path
      effects.clean.gain.value = 1.0;
      camGain.connect(effects.clean);
      effects.clean.connect(dst);
      
      // Robot path
      const carrier = audioCtx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = 55;
      const multiplier = audioCtx.createGain();
      multiplier.gain.value = 1.0;
      const carrierGain = audioCtx.createGain();
      carrierGain.gain.value = 0.5;
      carrier.connect(carrierGain);
      carrierGain.connect(multiplier.gain);
      camGain.connect(multiplier);
      effects.robot.gain.value = 0.0;
      multiplier.connect(effects.robot);
      effects.robot.connect(dst);
      carrier.start();
      
      // Telephone path
      const filterNode = audioCtx.createBiquadFilter();
      filterNode.type = "bandpass";
      filterNode.frequency.value = 1000;
      filterNode.Q.value = 8;
      const teleGain = audioCtx.createGain();
      teleGain.gain.value = 2.0;
      camGain.connect(filterNode);
      filterNode.connect(teleGain);
      effects.telephone.gain.value = 0.0;
      teleGain.connect(effects.telephone);
      effects.telephone.connect(dst);
      
      // Echo path
      const delayNode = audioCtx.createDelay(1.0);
      delayNode.delayTime.value = 0.18;
      const feedbackNode = audioCtx.createGain();
      feedbackNode.gain.value = 0.4;
      const echoOut = audioCtx.createGain();
      camGain.connect(delayNode);
      delayNode.connect(feedbackNode);
      feedbackNode.connect(delayNode);
      feedbackNode.connect(echoOut);
      effects.echo.gain.value = 0.0;
      echoOut.connect(effects.echo);
      effects.echo.connect(dst);

      // Smoothly fade between effects based on current options
      let filterInterval = setInterval(() => {
        try {
          const currentFilter = getVoiceFilter();
          effects.clean.gain.setTargetAtTime(currentFilter === "none" ? 1.0 : 0.0, audioCtx.currentTime, 0.05);
          effects.robot.gain.setTargetAtTime(currentFilter === "robot" ? 1.0 : 0.0, audioCtx.currentTime, 0.05);
          effects.telephone.gain.setTargetAtTime(currentFilter === "telephone" ? 1.0 : 0.0, audioCtx.currentTime, 0.05);
          effects.echo.gain.setTargetAtTime(currentFilter === "echo" ? 1.0 : 0.0, audioCtx.currentTime, 0.05);
        } catch (e) {
          clearInterval(filterInterval);
        }
      }, 500);
      
      const originalCleanup = mixerCleanup;
      mixerCleanup = () => {
        originalCleanup();
        clearInterval(filterInterval);
        try {
          carrier.stop();
          audioCtx.close();
        } catch (err) {}
      };
      
      mixedAudioTrack = dst.stream.getAudioTracks()[0];
    } catch (e) {
      console.warn("Audio mixing failed, using main audio track:", e);
      mixedAudioTrack = mainAudioTrack;
    }
  } else {
    mixedAudioTrack = mainAudioTrack || cameraAudioTrack || null;
  }
  
  const tracks = [];
  if (mixedVideoTrack) tracks.push(mixedVideoTrack);
  if (mixedAudioTrack) tracks.push(mixedAudioTrack);
  
  const mixedStream = new MediaStream(tracks);
  
  return { stream: mixedStream, cleanup: mixerCleanup };
};

/* ═══════════════════════════════ PURE FUNCTIONS (outside component) ═══════════════════════════════ */
const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/* ═══════════════════════════════ CallDuration (isolated to prevent parent re-renders) ═══════════════════════════════ */
const CallDuration = React.memo(({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return <>{formatDuration(elapsed)}</>;
});

/* ═══════════════════════════════ MAIN COMPONENT ═══════════════════════════════ */
export default function LiveMeeting({ socket, roomId, userName, onClose, isAdmin, ownerToken, userAvatar, onOpenWhiteboard }) {
  // ── States ──
  const [localStream, setLocalStream] = useState(null);

  // 🎙️ Voice & Video Filters (All-In-One Studio)
  const [voiceFilter, setVoiceFilter] = useState("none");
  const [videoFilter, setVideoFilter] = useState("none");
  const voiceFilterRef = useRef("none");
  const videoFilterRef = useRef("none");

  useEffect(() => {
    voiceFilterRef.current = voiceFilter;
  }, [voiceFilter]);

  useEffect(() => {
    videoFilterRef.current = videoFilter;
  }, [videoFilter]);
  const [displayStream, setDisplayStream] = useState(null); // tracks active display (camera or screenshare)
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: { stream, name, isMuted, isVideoOff, volume } }
  const [participantStates, setParticipantStates] = useState({}); // { [peerId]: { isMuted, isVideoOff, role } }
  const [myPeerId, setMyPeerId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const pipPositionRef = useRef({ x: 0, y: 0 });
  useEffect(() => { pipPositionRef.current = pipPosition; }, [pipPosition]);
  const [layoutMode, setLayoutMode] = useState("grid"); // "grid" | "spotlight"
  const [pinnedPeerId, setPinnedPeerId] = useState(null);
  const [speakingPeers, setSpeakingPeers] = useState({});
  const [showParticipants, setShowParticipants] = useState(false);
  const [showBandwidthMenu, setShowBandwidthMenu] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [bandwidthMode, setBandwidthMode] = useState("auto"); // "auto" | "saver" | "audio-only" | "hd"
  const bandwidthModeRef = useRef("auto");
  useEffect(() => { bandwidthModeRef.current = bandwidthMode; }, [bandwidthMode]);
  const [networkQuality, setNetworkQuality] = useState({ rtt: 35, loss: 0, bitrate: 650, status: "good" });
  const [reactions, setReactions] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [kickTarget, setKickTarget] = useState(null); // { id, name }
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isFileStreaming, setIsFileStreaming] = useState(false);
  const [fileStreamDuration, setFileStreamDuration] = useState(0);
  const [fileStreamProgress, setFileStreamProgress] = useState(0);
  const [isFileStreamPaused, setIsFileStreamPaused] = useState(false);
  const [fileStreamName, setFileStreamName] = useState("");
  const [fileStreamSpeed, setFileStreamSpeed] = useState(1);
  const [fileStreamVolume, setFileStreamVolume] = useState(1);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [streamUrlInput, setStreamUrlInput] = useState("");
  const [minimizedPeers, setMinimizedPeers] = useState(new Set());
  const [highlightedPeers, setHighlightedPeers] = useState(new Set());

  const toggleMinimizePeer = useCallback((peerId) => {
    setMinimizedPeers(prev => {
      const next = new Set(prev);
      if (next.has(peerId)) next.delete(peerId);
      else next.add(peerId);
      return next;
    });
  }, []);

  const toggleHighlightPeer = useCallback((peerId) => {
    setHighlightedPeers(prev => {
      const next = new Set(prev);
      if (next.has(peerId)) next.delete(peerId);
      else next.add(peerId);
      return next;
    });
  }, []);

  // ── Refs ──
  const containerRef = useRef(null);
  const peerRef = useRef(null);
  const peers = useRef({}); // { [peerId]: MediaConnection }
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false); // true if mouse moved during drag (prevents click-to-expand)
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const callStartTimeRef = useRef(Date.now());
  const pendingCallsRef = useRef([]); // queued incoming calls before local stream is ready
  const isVideoOffRef = useRef(false); // stable ref for isVideoOff (avoids effect re-trigger)
  const fileVideoRef = useRef(null);
  const fileStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const mixedStreamCleanupRef = useRef(null);
  const originalTracksRef = useRef({ video: null, audio: null });
  const fileInputRef = useRef(null);
  const isRoomHost = useMemo(() => Boolean(isAdmin || ownerToken), [isAdmin, ownerToken]);

  // Keep isVideoOffRef in sync with state
  useEffect(() => { isVideoOffRef.current = isVideoOff; }, [isVideoOff]);

  // ── Reactive callback ref for local video element ──
  // Binds displayStream to any <video> element it is attached to, surviving mount/unmount cycles (PiP, minimize)
  const localVideoCallbackRef = useCallback((videoEl) => {
    if (videoEl && displayStream) {
      videoEl.srcObject = displayStream;
    }
  }, [displayStream]);

  // Reset PIP position on state change
  useEffect(() => {
    if (!isMinimized) {
      setPipPosition({ x: 0, y: 0 });
    }
  }, [isMinimized]);

  // Minimized Window Drag & Drop Handler — uses direct DOM manipulation during drag
  // to avoid React state updates (and full component re-renders) at 60fps.
  const handleDragStart = useCallback((e) => {
    if (e.type === "mousedown" && e.button !== 0) return;
    
    if (e.target.closest(".pip-controls") || e.target.closest("button")) {
      return;
    }

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    const pos = pipPositionRef.current;
    dragStartRef.current = { x: clientX - pos.x, y: clientY - pos.y };

    const handleDragMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const currentX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;

      let newX = currentX - dragStartRef.current.x;
      let newY = currentY - dragStartRef.current.y;

      const boundsPadding = 10;
      const pipWidth = window.innerWidth <= 768 ? 260 : 320;
      const pipHeight = window.innerWidth <= 768 ? 160 : 190;
      const initialRight = window.innerWidth <= 768 ? 16 : 24;
      const initialBottom = window.innerWidth <= 768 ? 16 : 24;

      const minX = -(window.innerWidth - pipWidth - initialRight - boundsPadding);
      const maxX = initialRight - boundsPadding;
      const minY = -(window.innerHeight - pipHeight - initialBottom - boundsPadding);
      const maxY = initialBottom - boundsPadding;

      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));

      const dx = Math.abs(currentX - (dragStartRef.current.x + pos.x));
      const dy = Math.abs(currentY - (dragStartRef.current.y + pos.y));
      if (dx > 5 || dy > 5) hasDraggedRef.current = true;

      // Update ref + DOM directly — no React state update
      pipPositionRef.current = { x: newX, y: newY };
      const pipEl = document.querySelector('[data-pip-container]');
      if (pipEl) {
        pipEl.style.transform = `translate(${newX}px, ${newY}px)`;
      }
    };

    const handleDragEnd = () => {
      isDraggingRef.current = false;
      // Commit final position to React state (one update, not 60/sec)
      setPipPosition({ ...pipPositionRef.current });
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("touchmove", handleDragMove);
      document.removeEventListener("touchend", handleDragEnd);
    };

    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleDragMove, { passive: false });
    document.addEventListener("touchend", handleDragEnd);
  }, []);

  // ─── WebRTC Bitrate / ABR Controller (Dynamic Low Bandwidth Optimizer) ───
  const applyBandwidthMode = useCallback((mode) => {
    setBandwidthMode(mode);
    const targetBitrate = mode === "audio-only" ? 24000 : mode === "saver" ? 120000 : mode === "hd" ? 1800000 : 600000;
    const scaleFactor = mode === "saver" ? 2.5 : mode === "hd" ? 1.0 : 1.5;
    const maxFps = mode === "saver" ? 15 : mode === "hd" ? 30 : 24;

    // Adjust local video track if audio-only
    if (localStreamRef.current) {
      const vTrack = localStreamRef.current.getVideoTracks()[0];
      if (vTrack) {
        vTrack.enabled = mode !== "audio-only" && !isVideoOff;
      }
    }

    // Apply RTCRtpSender encoding parameters across all connected peers
    Object.values(peers.current).forEach(call => {
      try {
        const pc = call.peerConnection;
        if (!pc) return;
        pc.getSenders().forEach(sender => {
          if (sender.track?.kind === "video") {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = targetBitrate;
            params.encodings[0].scaleResolutionDownBy = scaleFactor;
            params.encodings[0].maxFramerate = maxFps;
            sender.setParameters(params).catch(() => {});
          } else if (sender.track?.kind === "audio") {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = mode === "saver" ? 24000 : 48000;
            sender.setParameters(params).catch(() => {});
          }
        });
      } catch (e) {}
    });

    toast.info(`Bandwidth mode updated: ${mode.toUpperCase()}`);
  }, [isVideoOff]);

  // ─── Network Quality Poller (getStats) ───
  useEffect(() => {
    statsIntervalRef.current = setInterval(async () => {
      const activeCalls = Object.values(peers.current);
      if (activeCalls.length === 0) return;

      try {
        let totalRtt = 0;
        let totalLoss = 0;
        let count = 0;

        for (const call of activeCalls) {
          const pc = call.peerConnection;
          if (!pc || pc.connectionState !== "connected") continue;
          const stats = await pc.getStats();
          for (const report of stats.values()) {
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              if (report.currentRoundTripTime) {
                totalRtt += report.currentRoundTripTime * 1000;
                count++;
              }
            }
            if (report.type === "inbound-rtp" && report.packetsLost && report.packetsReceived) {
              const totalPackets = report.packetsLost + report.packetsReceived;
              if (totalPackets > 0) {
                totalLoss = (report.packetsLost / totalPackets) * 100;
              }
            }
          }
        }

        const avgRtt = count > 0 ? Math.round(totalRtt / count) : 35;
        const lossPercent = Math.min(100, Math.round(totalLoss * 10) / 10);
        let status = "good";
        if (avgRtt > 350 || lossPercent > 12) status = "poor";
        else if (avgRtt > 180 || lossPercent > 5) status = "fair";

        const newBitrate = bandwidthModeRef.current === "saver" ? 120 : 650;
        setNetworkQuality(prev => {
          if (prev.rtt === avgRtt && prev.loss === lossPercent && prev.status === status && prev.bitrate === newBitrate) return prev;
          return { rtt: avgRtt, loss: lossPercent, bitrate: newBitrate, status };
        });

        // Auto-adapt when network degrades
        if (bandwidthModeRef.current === "auto" && status === "poor") {
          applyBandwidthMode("saver");
          toast.warning("Network unstable: Auto-switched to Data Saver mode to protect voice quality.");
        }
      } catch (e) {}
    }, 3000);

    return () => clearInterval(statsIntervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // bandwidthMode/applyBandwidthMode changes handled via refs

  // ─── Fullscreen Change Event Listener (Sync State on Escape Key) ───
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // ─── Web Audio Activity Detection (Speaking Indicator) ───
  const setupAudioAnalysis = useCallback((stream, id) => {
    if (!stream || !stream.getAudioTracks().length) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      let animId;
      const checkVolume = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const isSpeaking = avg > 24;
        setSpeakingPeers(prev => prev[id] === isSpeaking ? prev : { ...prev, [id]: isSpeaking });
        animId = requestAnimationFrame(checkVolume);
      };
      checkVolume();
      return () => cancelAnimationFrame(animId);
    } catch (e) {}
  }, []);

  // ─── Peer Call Event Handler ───
  const handleCallEvents = useCallback((call, remotePeerId) => {
    call.on("stream", (remoteStream) => {
      setRemoteStreams(prev => ({
        ...prev,
        [remotePeerId]: {
          stream: remoteStream,
          name: prev[remotePeerId]?.name || "Participant",
          volume: 100
        }
      }));
      setupAudioAnalysis(remoteStream, remotePeerId);
    });

    call.on("close", () => {
      if (peers.current[remotePeerId]) {
        try { peers.current[remotePeerId].close(); } catch (e) {}
        delete peers.current[remotePeerId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[remotePeerId];
        return next;
      });
    });

    call.on("error", (err) => {
      console.warn(`Call error with ${remotePeerId}:`, err);
    });
  }, [setupAudioAnalysis]);

  // ─── Call Peer Function ───
  const callPeer = useCallback((targetPeerId) => {
    if (!peerRef.current || !localStreamRef.current) return false;
    // Use ref instead of myPeerId state to avoid dependency loop
    if (peers.current[targetPeerId] || targetPeerId === peerRef.current?.id) return false;

    try {
      const call = peerRef.current.call(targetPeerId, localStreamRef.current);
      if (call) {
        peers.current[targetPeerId] = call;
        handleCallEvents(call, targetPeerId);
        return true;
      }
    } catch (e) {
      console.error(`Failed to call peer ${targetPeerId}:`, e);
    }
    return false;
  }, [handleCallEvents]);

  // ─── Kick / Remove User Capability (Admin / Room Owner) ───
  const handleKickParticipant = useCallback((targetPeerId, targetName) => {
    if (!isRoomHost) {
      toast.error("Only the room owner and admins can remove participants.");
      return;
    }

    if (socket && typeof socket.emit === "function") {
      socket.emit("kick-from-call", {
        roomId,
        targetPeerId,
        targetName,
        adminName: userName,
        token: ownerToken
      });
      socket.emit("admin-kick-user", {
        roomId,
        peerId: targetPeerId,
        name: targetName,
        adminName: userName
      });
    }

    // Clean up locally
    if (peers.current[targetPeerId]) {
      try { peers.current[targetPeerId].close(); } catch (e) {}
      delete peers.current[targetPeerId];
    }
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[targetPeerId];
      return next;
    });

    toast.success(`Removed ${targetName} from the video call.`);
    setKickTarget(null);
  }, [isRoomHost, socket, roomId, userName, ownerToken]);

  // ─── Mute Participant for Everyone (Admin Action) ───
  const handleMuteParticipant = useCallback((targetPeerId, targetName) => {
    if (!isRoomHost) return;
    if (socket) {
      socket.emit("admin-mute-user", { roomId, peerId: targetPeerId, name: targetName });
      toast.info(`Mute command sent for ${targetName}`);
    }
  }, [isRoomHost, socket, roomId]);

  // ─── Graceful Leave with Cleanup ───
  const handleLeaveCall = useCallback(() => {
    // Stop recording if active
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch (e) {}
    }
    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    // Close all peer connections
    Object.values(peers.current).forEach(c => {
      try { c.close(); } catch (e) {}
    });
    peers.current = {};
    // Destroy PeerJS instance
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (e) {}
    }
    // Notify server
    if (socket && typeof socket.emit === "function") {
      socket.emit("leave-call", { roomId });
    }
    setShowLeaveConfirm(false);
    onClose();
  }, [socket, roomId, onClose]);

  // ─── Main WebRTC & PeerJS Lifecycle ───
  useEffect(() => {
    let isCancelled = false;

    const initCall = async () => {
      setIsConnecting(true);

      // 1. Acquire Local Media (with resilient fallback)
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (err) {
        console.warn("Full video/audio getUserMedia failed, attempting audio-only...", err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setIsVideoOff(true);
          toast.info("Camera unavailable — joined with audio only.");
        } catch (audioErr) {
          console.warn("Audio getUserMedia failed, fallback to listener mode...", audioErr);
          // Dummy listener canvas + silent audio track
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          const dummyVideoTrack = canvas.captureStream(1).getVideoTracks()[0];
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const dst = audioCtx.createMediaStreamDestination();
          osc.connect(dst);
          const dummyAudioTrack = dst.stream.getAudioTracks()[0];
          dummyAudioTrack.enabled = false;
          stream = new MediaStream([dummyVideoTrack, dummyAudioTrack]);
          setIsVideoOff(true);
          setIsMuted(true);
          toast.warning("Microphone & Camera denied — joined in Listener Mode.");
        }
      }

      if (isCancelled) {
        if (stream) stream.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setDisplayStream(stream); // bind to callback ref
      setupAudioAnalysis(stream, "local");

      // Answer any calls that arrived before our stream was ready
      if (pendingCallsRef.current.length > 0) {
        pendingCallsRef.current.forEach(pendingCall => {
          try {
            pendingCall.answer(stream);
            peers.current[pendingCall.peer] = pendingCall;
            handleCallEvents(pendingCall, pendingCall.peer);
          } catch (e) { console.warn("Failed to answer pending call:", e); }
        });
        pendingCallsRef.current = [];
      }

      // 2. Multi-tier ICE Configuration (reliable STUN + TURN for production NAT traversal)
      const iceServers = [
        // Google STUN (fast, reliable — works when both peers are on open networks)
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        // Open Relay TURN (free, reliable — needed when peers are behind symmetric NAT/firewalls)
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

      if (process.env.REACT_APP_TURN_URL) {
        iceServers.push({
          urls: process.env.REACT_APP_TURN_URL,
          username: process.env.REACT_APP_TURN_USERNAME,
          credential: process.env.REACT_APP_TURN_PASSWORD
        });
      }

      // 3. PeerJS Signaling Server Configuration
      // Default: use PeerJS Cloud (0.peerjs.com) — free, reliable, works everywhere
      // Only override if REACT_APP_PEER_HOST is explicitly set (e.g., self-hosted PeerJS)
      const peerOptions = {
        config: { iceServers },
        debug: 1 // 0=none, 1=errors, 2=warnings, 3=all
      };

      // Use custom PeerJS signaling server ONLY if explicitly configured
      if (process.env.REACT_APP_PEER_HOST) {
        peerOptions.host = process.env.REACT_APP_PEER_HOST;
        peerOptions.port = Number(process.env.REACT_APP_PEER_PORT) || 443;
        peerOptions.path = process.env.REACT_APP_PEER_PATH || "/peerjs";
        peerOptions.secure = true;
      }
      // Otherwise, PeerJS uses its built-in cloud server at 0.peerjs.com (no config needed)

      const peer = new Peer(undefined, peerOptions);
      peerRef.current = peer;

      peer.on("open", (id) => {
        if (isCancelled) return;
        setMyPeerId(id);
        setIsConnecting(false);
        if (socket && typeof socket.emit === "function") {
          socket.emit("join-call", {
            roomId,
            peerId: id,
            userName,
            isMuted: false,
            isVideoOff: isVideoOffRef.current,
            isAdmin: isRoomHost,
            avatar: userAvatar
          });
        }
      });

      // Handle incoming calls — queue if local stream not ready yet
      peer.on("call", (incomingCall) => {
        if (localStreamRef.current) {
          incomingCall.answer(localStreamRef.current);
          peers.current[incomingCall.peer] = incomingCall;
          handleCallEvents(incomingCall, incomingCall.peer);
        } else {
          // Stream not acquired yet — queue and answer once ready
          console.log("[PeerJS] Incoming call queued — local stream not ready yet");
          pendingCallsRef.current.push(incomingCall);
        }
      });

      // Auto-reconnect if signaling server drops
      peer.on("disconnected", () => {
        console.warn("[PeerJS] Signaling server disconnected. Attempting reconnect...");
        if (peerRef.current && !peerRef.current.destroyed) {
          try {
            peerRef.current.reconnect();
          } catch (e) {
            console.error("[PeerJS] Reconnect failed:", e);
          }
        }
      });

      peer.on("error", (err) => {
        console.warn("PeerJS error:", err);
        setIsConnecting(false);
        if (err.type === "peer-unavailable") {
          const unavailableId = err.message.split(" ").pop();
          if (unavailableId && peers.current[unavailableId]) {
            delete peers.current[unavailableId];
          }
        }
      });

      // 4. Socket Listeners & Deterministic Calling (Fixing Glare Race Condition)
      if (socket && typeof socket.on === "function") {
        // When joining, newcomer calls all existing participants
        socket.on("existing-callers", (callers) => {
          if (!callers || !Array.isArray(callers)) return;
          callers.forEach(({ peerId, name, isMuted: remoteMuted, isVideoOff: remoteVideoOff }) => {
            if (peerId && peerId !== peerRef.current?.id) {
              setRemoteStreams(prev => ({
                ...prev,
                [peerId]: { stream: prev[peerId]?.stream || null, name, volume: 100 }
              }));
              setParticipantStates(prev => ({
                ...prev,
                [peerId]: { isMuted: remoteMuted, isVideoOff: remoteVideoOff }
              }));
              // Newcomer calls existing peer
              setTimeout(() => {
                callPeer(peerId);
              }, 400);
            }
          });
        });

        // When a new user connects, register them and WAIT for their call (prevents double call)
        socket.on("user-connected-call", ({ peerId, name, isMuted: remoteMuted, isVideoOff: remoteVideoOff }) => {
          if (!peerId || peerId === peerRef.current?.id) return;
          setRemoteStreams(prev => ({
            ...prev,
            [peerId]: { stream: prev[peerId]?.stream || null, name, volume: 100 }
          }));
          setParticipantStates(prev => ({
            ...prev,
            [peerId]: { isMuted: remoteMuted, isVideoOff: remoteVideoOff }
          }));

          // Tie-breaker fallback: If after 3s no incoming call was received, initiate call
          setTimeout(() => {
            if (!peers.current[peerId]) {
              callPeer(peerId);
            }
          }, 3000);
        });

        socket.on("user-disconnected-call", (disconnectedId) => {
          if (peers.current[disconnectedId]) {
            try { peers.current[disconnectedId].close(); } catch (e) {}
            delete peers.current[disconnectedId];
          }
          setRemoteStreams(prev => {
            const next = { ...prev };
            delete next[disconnectedId];
            return next;
          });
        });

        socket.on("user-media-change", ({ peerId, isMuted: remoteMuted, isVideoOff: remoteVideoOff }) => {
          setParticipantStates(prev => ({
            ...prev,
            [peerId]: { ...prev[peerId], isMuted: remoteMuted, isVideoOff: remoteVideoOff }
          }));
        });

        // KICK / REMOVAL LISTENERS
        socket.on("kicked-from-call", ({ peerId, targetName, adminName }) => {
          if (peerId === peerRef.current?.id || targetName === userName) {
            toast.error(`🚫 You have been removed from the video call by ${adminName || 'the room host'}.`);
            handleLeaveCall();
          } else {
            toast.info(`ℹ️ ${targetName || 'A participant'} was removed by the host.`);
            if (peers.current[peerId]) {
              try { peers.current[peerId].close(); } catch (e) {}
              delete peers.current[peerId];
            }
            setRemoteStreams(prev => {
              const next = { ...prev };
              delete next[peerId];
              return next;
            });
          }
        });

        socket.on("admin-kick-user", ({ peerId, name, adminName }) => {
          if (peerId === peerRef.current?.id || name === userName) {
            toast.error(`🚫 You have been removed from the call by ${adminName || 'an admin'}.`);
            handleLeaveCall();
          }
        });

        socket.on("admin-mute-user", ({ peerId }) => {
          if (peerId === peerRef.current?.id) {
            if (localStreamRef.current) {
              const aTrack = localStreamRef.current.getAudioTracks()[0];
              if (aTrack) aTrack.enabled = false;
            }
            setIsMuted(true);
            toast.info("🔇 You were muted by the room host.");
          }
        });

        socket.on("reaction", (emoji) => {
          const id = Date.now() + Math.random();
          setReactions(prev => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
          setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2800);
        });
      }
    };

    initCall();

    return () => {
      isCancelled = true;
      if (socket && typeof socket.emit === "function") {
        socket.emit("leave-call", { roomId });
        socket.off("existing-callers");
        socket.off("user-connected-call");
        socket.off("user-disconnected-call");
        socket.off("user-media-change");
        socket.off("kicked-from-call");
        socket.off("admin-kick-user");
        socket.off("admin-mute-user");
        socket.off("reaction");
      }
      stopFileStream();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      Object.values(peers.current).forEach(c => {
        try { c.close(); } catch (e) {}
      });
      peers.current = {};
      pendingCallsRef.current = [];
      if (peerRef.current) {
        try { peerRef.current.destroy(); } catch (e) {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socket]);

  // ─── Actions & Toggles ───
  const toggleMute = () => {
    if (localStreamRef.current) {
      const aTrack = localStreamRef.current.getAudioTracks()[0];
      if (aTrack) {
        aTrack.enabled = !aTrack.enabled;
        setIsMuted(!aTrack.enabled);
        if (socket) {
          socket.emit("media-state-change", { peerId: myPeerId, isMuted: !aTrack.enabled, isVideoOff });
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const vTrack = localStreamRef.current.getVideoTracks()[0];
      if (vTrack) {
        vTrack.enabled = !vTrack.enabled;
        setIsVideoOff(!vTrack.enabled);
        if (socket) {
          socket.emit("media-state-change", { peerId: myPeerId, isMuted, isVideoOff: !vTrack.enabled });
        }
        // Re-bind display stream so callback ref picks it up
        setDisplayStream(localStreamRef.current);
      }
    }
  };

  const handleFullscreenVideo = (e) => {
    e.stopPropagation();
    const tile = e.currentTarget.closest(".video-tile");
    if (!tile) return;
    const video = tile.querySelector("video");
    if (video) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else if (video.msRequestFullscreen) {
        video.msRequestFullscreen();
      } else {
        toast.error("Fullscreen is not supported on this browser/device.");
      }
    } else {
      toast.error("No active video feed to display in fullscreen.");
    }
  };

  const flipCamera = async () => {
    try {
      const currentTrack = localStreamRef.current?.getVideoTracks()[0];
      if (!currentTrack) return;
      currentTrack.stop();

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (localStreamRef.current) {
        localStreamRef.current.removeTrack(currentTrack);
        localStreamRef.current.addTrack(newVideoTrack);
      }

      Object.values(peers.current).forEach(call => {
        const sender = call.peerConnection?.getSenders().find(s => s.track?.kind === "video");
        if (sender) sender.replaceTrack(newVideoTrack);
      });

      setDisplayStream(localStreamRef.current);
      toast.success("Camera flipped");
    } catch (e) {
      toast.error("Camera flip unavailable on this device.");
    }
  };

  const stopScreenShare = useCallback(() => {
    if (mixedStreamCleanupRef.current) {
      try { mixedStreamCleanupRef.current(); } catch (e) {}
      mixedStreamCleanupRef.current = null;
    }
    if (screenStreamRef.current) {
      try { screenStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      screenStreamRef.current = null;
    }

    const origVideo = originalTracksRef.current?.video;
    const origAudio = originalTracksRef.current?.audio;

    if (origVideo || origAudio) {
      Object.values(peers.current).forEach(call => {
        const pc = call.peerConnection;
        if (!pc) return;
        pc.getSenders().forEach(sender => {
          if (sender.track?.kind === "video" && origVideo) {
            sender.replaceTrack(origVideo);
          }
          if (sender.track?.kind === "audio" && origAudio) {
            sender.replaceTrack(origAudio);
          }
        });
      });
    }

    originalTracksRef.current = { video: null, audio: null };
    setDisplayStream(localStreamRef.current);
    toast.info("Screen sharing ended.");
  }, []);

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;

      const hasAudioTrack = screenStream.getAudioTracks().length > 0;
      if (!hasAudioTrack) {
        toast.info("💡 Tip: To share computer sound, select 'Tab' or check 'Share audio' in the browser popup.", { autoClose: 7000 });
      }

      const mixed = createMixedStream(screenStream, localStreamRef.current, {
        mixAudio: true,
        getVideoFilter: () => videoFilterRef.current,
        getVoiceFilter: () => voiceFilterRef.current
      });
      mixedStreamCleanupRef.current = mixed.cleanup;

      const origVideo = localStreamRef.current?.getVideoTracks()[0];
      const origAudio = localStreamRef.current?.getAudioTracks()[0];
      originalTracksRef.current = { video: origVideo, audio: origAudio };

      const mixedVideoTrack = mixed.stream.getVideoTracks()[0];
      const mixedAudioTrack = mixed.stream.getAudioTracks()[0];

      if (mixedAudioTrack) {
        mixedAudioTrack.enabled = true;
      }

      Object.values(peers.current).forEach(call => {
        const pc = call.peerConnection;
        if (!pc) return;
        pc.getSenders().forEach(sender => {
          if (sender.track?.kind === "video" && mixedVideoTrack) {
            sender.replaceTrack(mixedVideoTrack);
          }
          if (sender.track?.kind === "audio" && mixedAudioTrack) {
            sender.replaceTrack(mixedAudioTrack);
          }
        });
      });

      setDisplayStream(mixed.stream);

      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      toast.success(hasAudioTrack ? "Screen sharing started (with audio)" : "Screen sharing started");
    } catch (e) {
      console.warn("Screen share cancelled or failed:", e);
    }
  };

  const sendReaction = (emoji) => {
    if (socket) socket.emit("reaction", { emoji, roomId });
    const id = Date.now() + Math.random();
    setReactions(prev => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2800);
  };

  // ─── Video/Audio & Link Media Streaming Capabilities ───
  const startMediaStream = async ({ file, url, name }) => {
    try {
      const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";
      let mediaSrc = "";
      let mediaName = name || "Media Stream";

      if (file) {
        mediaSrc = URL.createObjectURL(file);
        mediaName = file.name;
      } else if (url) {
        mediaSrc = `${backendUrl}/api/proxy-file?url=${encodeURIComponent(url)}`;
        mediaName = url.length > 40 ? url.substring(0, 40) + "..." : url;
      }

      if (!mediaSrc) return;

      const video = document.createElement("video");
      video.src = mediaSrc;
      video.crossOrigin = "anonymous";
      video.playsInline = true;
      video.autoplay = true;
      video.volume = fileStreamVolume;

      video.style.position = "fixed";
      video.style.top = "-9999px";
      video.style.left = "-9999px";
      video.style.width = "1px";
      video.style.height = "1px";
      document.body.appendChild(video);

      fileVideoRef.current = video;
      setFileStreamName(mediaName);
      setIsFileStreamPaused(false);

      video.onerror = () => {
        const errCode = video.error?.code || 0;
        const errMsg = video.error?.message || "Unknown error";
        console.error(`Video load error (code ${errCode}):`, errMsg);
        if (errCode === 3) {
          toast.error("Failed to load media — decoding error. The file format may not be supported.");
        } else if (errCode === 4) {
          toast.error("Failed to load media — source not found or network error. Check the URL and try again.");
        } else {
          toast.error(`Failed to load media: ${errMsg}`);
        }
        video.remove();
      };

      video.onloadedmetadata = () => {
        setFileStreamDuration(video.duration || 0);
        const stream = video.captureStream ? video.captureStream() : (video.mozCaptureStream ? video.mozCaptureStream() : null);
        if (!stream) {
          toast.error("Media stream capture is not supported for this source format.");
          video.remove();
          return;
        }

        const mixed = createMixedStream(stream, localStreamRef.current, {
          mixAudio: true,
          getVideoFilter: () => videoFilterRef.current,
          getVoiceFilter: () => voiceFilterRef.current
        });
        fileStreamRef.current = mixed.stream;
        mixedStreamCleanupRef.current = mixed.cleanup;

        const origVideo = localStreamRef.current?.getVideoTracks()[0];
        const origAudio = localStreamRef.current?.getAudioTracks()[0];
        originalTracksRef.current = { video: origVideo, audio: origAudio };

        const mixedVideoTrack = mixed.stream.getVideoTracks()[0];
        const mixedAudioTrack = mixed.stream.getAudioTracks()[0];

        Object.values(peers.current).forEach(call => {
          const pc = call.peerConnection;
          if (!pc) return;
          pc.getSenders().forEach(sender => {
            if (sender.track?.kind === "video" && mixedVideoTrack) {
              sender.replaceTrack(mixedVideoTrack);
            }
            if (sender.track?.kind === "audio" && mixedAudioTrack) {
              sender.replaceTrack(mixedAudioTrack);
            }
          });
        });

        setDisplayStream(mixed.stream);
        setIsFileStreaming(true);
        setShowStreamModal(false);
        toast.success(`Started streaming: ${mediaName}`);
      };

      let lastProgressUpdate = 0;
      video.ontimeupdate = () => {
        const now = Date.now();
        if (now - lastProgressUpdate < 1000) return; // throttle to 1/sec
        lastProgressUpdate = now;
        setFileStreamProgress(video.currentTime);
      };

      video.onended = () => {
        stopFileStream();
      };
    } catch (err) {
      console.error("Failed to start media stream:", err);
      toast.error("An error occurred while loading the media source.");
    }
  };

  const stopFileStream = useCallback(() => {
    if (mixedStreamCleanupRef.current) {
      try { mixedStreamCleanupRef.current(); } catch (e) {}
      mixedStreamCleanupRef.current = null;
    }

    if (fileVideoRef.current) {
      fileVideoRef.current.pause();
      try {
        const src = fileVideoRef.current.src;
        if (src && src.startsWith("blob:")) URL.revokeObjectURL(src);
      } catch (e) {}
      fileVideoRef.current.remove();
      fileVideoRef.current = null;
    }

    if (fileStreamRef.current) {
      fileStreamRef.current.getTracks().forEach(t => t.stop());
      fileStreamRef.current = null;
    }

    const origVideo = originalTracksRef.current?.video;
    const origAudio = originalTracksRef.current?.audio;

    if (origVideo || origAudio) {
      Object.values(peers.current).forEach(call => {
        const pc = call.peerConnection;
        if (!pc) return;
        pc.getSenders().forEach(sender => {
          if (sender.track?.kind === "video" && origVideo) {
            sender.replaceTrack(origVideo);
          }
          if (sender.track?.kind === "audio" && origAudio) {
            sender.replaceTrack(origAudio);
          }
        });
      });
    }

    originalTracksRef.current = { video: null, audio: null };

    setDisplayStream(localStreamRef.current);
    setIsFileStreaming(false);
    setFileStreamName("");
    setFileStreamDuration(0);
    setFileStreamProgress(0);
    toast.info("Media stream stopped.");
  }, []);

  const toggleFileStreamPlay = () => {
    if (fileVideoRef.current) {
      if (fileVideoRef.current.paused) {
        fileVideoRef.current.play();
        setIsFileStreamPaused(false);
      } else {
        fileVideoRef.current.pause();
        setIsFileStreamPaused(true);
      }
    }
  };

  const seekFileStream = (time) => {
    if (fileVideoRef.current) {
      fileVideoRef.current.currentTime = time;
      setFileStreamProgress(time);
    }
  };

  const skipFileStream = (seconds) => {
    if (fileVideoRef.current) {
      const newTime = Math.max(0, Math.min(fileVideoRef.current.duration || 0, fileVideoRef.current.currentTime + seconds));
      fileVideoRef.current.currentTime = newTime;
      setFileStreamProgress(newTime);
    }
  };

  const cycleFileStreamSpeed = () => {
    if (fileVideoRef.current) {
      const currentIdx = SPEED_OPTIONS.indexOf(fileStreamSpeed);
      const nextIdx = (currentIdx + 1) % SPEED_OPTIONS.length;
      const newSpeed = SPEED_OPTIONS[nextIdx];
      fileVideoRef.current.playbackRate = newSpeed;
      setFileStreamSpeed(newSpeed);
    }
  };

  const changeFileStreamVolume = (vol) => {
    if (fileVideoRef.current) {
      fileVideoRef.current.volume = vol;
      setFileStreamVolume(vol);
    }
  };

  const toggleFileStreamMute = () => {
    if (fileVideoRef.current) {
      if (fileVideoRef.current.volume > 0) {
        fileVideoRef.current.volume = 0;
        setFileStreamVolume(0);
      } else {
        fileVideoRef.current.volume = 1;
        setFileStreamVolume(1);
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      try {
        if (!localStreamRef.current) return;
        const recorder = new MediaRecorder(localStreamRef.current);
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `meeting-recording-${Date.now()}.webm`;
          a.click();
          toast.success("Recording saved!");
        };
        recorder.start(1000);
        recorderRef.current = recorder;
        setIsRecording(true);
        toast.info("Meeting recording started...");
      } catch (e) {
        toast.error("Recording not supported on this browser.");
      }
    }
  };

  const setParticipantVolume = (peerId, vol) => {
    setRemoteStreams(prev => {
      if (!prev[peerId]) return prev;
      return {
        ...prev,
        [peerId]: { ...prev[peerId], volume: vol }
      };
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // ─── Computed Participants ───
  const remoteEntries = useMemo(() => Object.entries(remoteStreams), [remoteStreams]);
  const gridRemoteEntries = useMemo(() => remoteEntries.filter(([peerId]) => !minimizedPeers.has(peerId)), [remoteEntries, minimizedPeers]);
  const gridCount = 1 + gridRemoteEntries.length;
  const totalCount = 1 + remoteEntries.length;

  // ─── Spotlight Peer Computation ───
  const spotlightPeerId = useMemo(() => {
    if (pinnedPeerId && (pinnedPeerId === "local" || remoteStreams[pinnedPeerId])) {
      return pinnedPeerId;
    }
    const activeSpeakers = Object.keys(speakingPeers).filter(id => speakingPeers[id]);
    if (activeSpeakers.length > 0) {
      const remoteSpeaker = activeSpeakers.find(id => id !== "local" && remoteStreams[id]);
      if (remoteSpeaker) return remoteSpeaker;
      if (activeSpeakers.includes("local")) return "local";
    }
    const remotes = Object.keys(remoteStreams);
    if (remotes.length > 0) return remotes[0];
    return "local";
  }, [pinnedPeerId, speakingPeers, remoteStreams]);

  return (
    <StyleSheetManager shouldForwardProp={(prop) => !prop.startsWith('$')}>
      <MeetingContainer 
        ref={containerRef} 
        $minimized={isMinimized}
        data-pip-container={isMinimized ? "" : undefined}
        style={isMinimized ? { transform: `translate3d(${pipPositionRef.current.x}px, ${pipPositionRef.current.y}px, 0)` } : {}}
        onMouseDown={isMinimized ? handleDragStart : undefined}
        onTouchStart={isMinimized ? handleDragStart : undefined}
      >
        <BackgroundAtmosphere />

        {/* ═══ MINIMIZED PIP VIEW ═══ */}
        {isMinimized && (
          <PipWidget onClick={() => { if (!hasDraggedRef.current) setIsMinimized(false); }}>
            {(() => {
              // Priority: 1. File stream video, 2. First remote participant, 3. Local camera
              const firstRemote = Object.entries(remoteStreams)[0];
              if (isFileStreaming && fileVideoRef.current) {
                // Show file stream in PIP
                return (
                  <video
                    autoPlay playsInline muted
                    ref={el => {
                      if (el && fileStreamRef.current && el.srcObject !== fileStreamRef.current) {
                        el.srcObject = fileStreamRef.current;
                      }
                    }}
                  />
                );
              } else if (firstRemote && firstRemote[1]?.stream) {
                // Show the first remote participant's stream (like WhatsApp/Teams)
                const [, remoteInfo] = firstRemote;
                const remoteState = participantStates[firstRemote[0]] || {};
                if (remoteState.isVideoOff) {
                  return (
                    <AvatarPlaceholder>
                      <div className="circle">{getInitials(remoteInfo.name)}</div>
                    </AvatarPlaceholder>
                  );
                }
                return (
                  <video
                    autoPlay playsInline
                    ref={el => {
                      if (el && remoteInfo.stream && el.srcObject !== remoteInfo.stream) {
                        el.srcObject = remoteInfo.stream;
                        el.volume = (remoteInfo.volume || 100) / 100;
                      }
                    }}
                  />
                );
              } else if (isVideoOff || !localStream) {
                return (
                  <AvatarPlaceholder>
                    <div className="circle">{getInitials(userName)}</div>
                  </AvatarPlaceholder>
                );
              } else {
                return <video ref={localVideoCallbackRef} autoPlay playsInline muted />;
              }
            })()}
            <div 
              className="pip-controls" 
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
            >
              <IconButton $active={isMuted} onClick={toggleMute}>
                {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
              </IconButton>
              <IconButton $active={isVideoOff} onClick={toggleVideo}>
                {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
              </IconButton>
              <IconButton onClick={() => setIsMinimized(false)}>
                <FaExpand />
              </IconButton>
            </div>
          </PipWidget>
        )}

        {/* ═══ FULL MEETING HEADER ═══ */}
        <MeetingHeader className="meeting-header">
          <HeaderLeft>
            <BrandBadge>
              <span className="live-dot" />
              <span>Live Call</span>
            </BrandBadge>
            <RoomTag title={`Room: ${roomId}`}>#{roomId}</RoomTag>
            
            {/* Live Network & Latency Pill */}
            <StatusPill 
              $mode={networkQuality.status} 
              onClick={() => setShowDiagnostics(true)}
              title="Click for Connection Diagnostics"
            >
              {networkQuality.status === "good" ? <FaWifi size={10} /> : <FaSignal size={10} />}
              <span>{networkQuality.rtt}ms<span className="status-label"> • {networkQuality.status.toUpperCase()}</span></span>
            </StatusPill>

            {/* Bandwidth Mode Pill */}
            <BandwidthDropdown>
              <StatusPill $mode="indigo" onClick={() => setShowBandwidthMenu(!showBandwidthMenu)}>
                {bandwidthMode === "saver" ? <FaLeaf size={10} /> : bandwidthMode === "audio-only" ? <FaHeadphones size={10} /> : bandwidthMode === "hd" ? <FaGem size={10} /> : <FaBolt size={10} />}
                <span>{bandwidthMode === "saver" ? "Data Saver" : bandwidthMode === "audio-only" ? "Audio Only" : bandwidthMode === "hd" ? "HD Quality" : "Auto ABR"}</span>
              </StatusPill>

              {showBandwidthMenu && (
                <BandwidthMenu>
                  <BandwidthOption $selected={bandwidthMode === "auto"} onClick={() => { applyBandwidthMode("auto"); setShowBandwidthMenu(false); }}>
                    <FaBolt color="#818cf8" />
                    <div>
                      <span>⚡ Auto Adaptive (Recommended)</span>
                      <span className="desc">Dynamically adjusts to your network</span>
                    </div>
                  </BandwidthOption>
                  <BandwidthOption $selected={bandwidthMode === "saver"} onClick={() => { applyBandwidthMode("saver"); setShowBandwidthMenu(false); }}>
                    <FaLeaf color="#34d399" />
                    <div>
                      <span>🍃 Data Saver (Low Bandwidth)</span>
                      <span className="desc">120 kbps • 240p/360p @ 15fps</span>
                    </div>
                  </BandwidthOption>
                  <BandwidthOption $selected={bandwidthMode === "audio-only"} onClick={() => { applyBandwidthMode("audio-only"); setShowBandwidthMenu(false); }}>
                    <FaHeadphones color="#f59e0b" />
                    <div>
                      <span>🎙 Audio-Only (Ultra Low)</span>
                      <span className="desc">&lt; 30 kbps • Crystal voice on 2G/3G</span>
                    </div>
                  </BandwidthOption>
                  <BandwidthOption $selected={bandwidthMode === "hd"} onClick={() => { applyBandwidthMode("hd"); setShowBandwidthMenu(false); }}>
                    <FaGem color="#38bdf8" />
                    <div>
                      <span>💎 High Definition (HD)</span>
                      <span className="desc">1.8 Mbps • 720p/1080p @ 30fps</span>
                    </div>
                  </BandwidthOption>
                </BandwidthMenu>
              )}
            </BandwidthDropdown>

            <span style={{ fontSize: "0.75rem", opacity: 0.5, fontWeight: 700 }}>
              <CallDuration startTime={callStartTimeRef.current} />
            </span>
          </HeaderLeft>

          <HeaderRight>
            {/* Diagnostics Button */}
            <IconButton className="hide-mobile" onClick={() => setShowDiagnostics(true)} title="Connection Diagnostics">
              <FaChartLine />
            </IconButton>

            {/* Collaborative Whiteboard */}
            {onOpenWhiteboard && (
              <IconButton onClick={onOpenWhiteboard} title="Open Collaborative Whiteboard & Screen Annotations">
                <FaPaintBrush color="#38bdf8" />
              </IconButton>
            )}

            {/* Participants Toggle */}
            <IconButton 
              $active={showParticipants} 
              onClick={() => setShowParticipants(!showParticipants)} 
              title="Participants"
            >
              <FaUsers />
              {totalCount > 1 && <span className="badge">{totalCount}</span>}
            </IconButton>

            {/* Layout Toggle */}
            <IconButton 
              onClick={() => setLayoutMode(prev => prev === "grid" ? "spotlight" : "grid")}
              title={layoutMode === "grid" ? "Spotlight View" : "Grid View"}
            >
              <FaThLarge />
            </IconButton>

            {/* Fullscreen Toggle */}
            <IconButton className="hide-mobile" onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              {isFullscreen ? <FaCompress /> : <FaExpand />}
            </IconButton>

            {/* Minimize */}
            <IconButton className="hide-mobile" onClick={() => setIsMinimized(true)} title="Picture-in-Picture">
              <FaWindowMinimize />
            </IconButton>
          </HeaderRight>
        </MeetingHeader>

        {/* ═══ MAIN CONTENT / VIDEO GRID ═══ */}
        <ContentArea className="content-area">
          <MainVideoArea className="main-video-area">
            {isConnecting ? (
              <AvatarPlaceholder>
                <SpinnerIcon size={32} />
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Connecting to meeting...</h3>
                <p style={{ margin: 0, opacity: 0.6, fontSize: "0.8rem" }}>Optimizing network & media devices</p>
              </AvatarPlaceholder>
            ) : layoutMode === "spotlight" ? (
              <SpotlightContainer>
                {/* 1. Large Main Spotlight View */}
                <SpotlightMain>
                  {spotlightPeerId === "local" ? (
                    <VideoTile 
                      className="video-tile"
                      $isSpeaking={speakingPeers.local}
                      $isPinned={pinnedPeerId === "local"}
                      onDoubleClick={() => setPinnedPeerId(prev => prev === "local" ? null : "local")}
                      style={{ width: "100%", height: "100%" }}
                    >
                      <TileOverlay className="tile-overlay">
                        <TileActionButton 
                          $active={pinnedPeerId === "local"}
                          onClick={() => setPinnedPeerId(prev => prev === "local" ? null : "local")}
                          title={pinnedPeerId === "local" ? "Unpin Spotlight" : "Pin Spotlight"}
                        >
                          <FaThumbtack />
                        </TileActionButton>
                        <TileActionButton 
                          onClick={handleFullscreenVideo}
                          title="View Fullscreen"
                        >
                          <FaExpand />
                        </TileActionButton>
                      </TileOverlay>
                      {isVideoOff || !localStream || bandwidthMode === "audio-only" ? (
                        <AvatarPlaceholder>
                          <div className="circle">{getInitials(userName)}</div>
                        </AvatarPlaceholder>
                      ) : (
                        <video ref={localVideoCallbackRef} autoPlay playsInline muted />
                      )}
                      <TileUserInfo>
                        <span>{userName} (You)</span>
                        {isRoomHost && <FaCrown color="#fbbf24" size={11} title="Room Owner / Admin" />}
                        {isMuted && <FaMicrophoneSlash color="#ff4757" size={11} />}
                        {speakingPeers.local && (
                          <EqualizerWaves>
                            <span /><span /><span />
                          </EqualizerWaves>
                        )}
                      </TileUserInfo>
                    </VideoTile>
                  ) : (() => {
                    const info = remoteStreams[spotlightPeerId];
                    if (!info) return null;
                    const state = participantStates[spotlightPeerId] || {};
                    const isPeerMuted = state.isMuted;
                    const isPeerVideoOff = state.isVideoOff || bandwidthMode === "audio-only";
                    const isSpeaking = speakingPeers[spotlightPeerId];
                    return (
                      <VideoTile 
                        className="video-tile"
                        $isSpeaking={isSpeaking}
                        $isPinned={pinnedPeerId === spotlightPeerId}
                        onDoubleClick={() => setPinnedPeerId(prev => prev === spotlightPeerId ? null : spotlightPeerId)}
                        style={{ width: "100%", height: "100%" }}
                      >
                        <TileOverlay className="tile-overlay">
                          {isRoomHost && (
                            <>
                              <TileActionButton 
                                $danger 
                                onClick={() => setKickTarget({ id: spotlightPeerId, name: info.name || "Participant" })}
                                title="Remove participant from call"
                              >
                                <FaTrash />
                              </TileActionButton>
                              <TileActionButton 
                                onClick={() => handleMuteParticipant(spotlightPeerId, info.name || "Participant")}
                                title="Mute for everyone"
                              >
                                <FaVolumeMute />
                              </TileActionButton>
                            </>
                          )}
                          <TileActionButton 
                            $active={pinnedPeerId === spotlightPeerId}
                            onClick={() => setPinnedPeerId(prev => prev === spotlightPeerId ? null : spotlightPeerId)}
                            title={pinnedPeerId === spotlightPeerId ? "Unpin Spotlight" : "Pin Spotlight"}
                          >
                            <FaThumbtack />
                          </TileActionButton>
                          <TileActionButton 
                            onClick={handleFullscreenVideo}
                            title="View Fullscreen"
                          >
                            <FaExpand />
                          </TileActionButton>
                        </TileOverlay>
                        {isPeerVideoOff || !info.stream ? (
                          <AvatarPlaceholder>
                            <div className="circle">{getInitials(info.name)}</div>
                          </AvatarPlaceholder>
                        ) : (
                          <video
                            autoPlay
                            playsInline
                            ref={el => {
                              if (el && info.stream && el.srcObject !== info.stream) {
                                el.srcObject = info.stream;
                                el.volume = (info.volume || 100) / 100;
                              }
                            }}
                          />
                        )}
                        <TileUserInfo>
                          <span>{info.name || "Participant"}</span>
                          {isPeerMuted && <FaMicrophoneSlash color="#ff4757" size={11} />}
                          {isSpeaking && (
                            <EqualizerWaves>
                              <span /><span /><span />
                            </EqualizerWaves>
                          )}
                        </TileUserInfo>
                      </VideoTile>
                    );
                  })()}
                </SpotlightMain>

                {/* 2. Horizontal Strip of Thumbnails */}
                {totalCount > 1 && (
                  <SpotlightStrip>
                    {/* Local Thumbnail */}
                    {spotlightPeerId !== "local" && (
                      <SpotlightThumbnail 
                        $isSpeaking={speakingPeers.local}
                        $isActive={false}
                        onClick={() => setPinnedPeerId("local")}
                      >
                        {isVideoOff || !localStream || bandwidthMode === "audio-only" ? (
                          <AvatarPlaceholder>
                            <div className="circle" style={{ fontSize: "1.2rem", width: 44, height: 44 }}>{getInitials(userName)}</div>
                          </AvatarPlaceholder>
                        ) : (
                          <video ref={localVideoCallbackRef} autoPlay playsInline muted />
                        )}
                        <div style={{ position: "absolute", bottom: 6, left: 6, display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 8, fontSize: "0.68rem" }}>
                          <span>You</span>
                          {isMuted && <FaMicrophoneSlash color="#ff4757" size={9} />}
                        </div>
                      </SpotlightThumbnail>
                    )}

                    {/* Remote Thumbnails */}
                    {remoteEntries.map(([peerId, info]) => {
                      if (spotlightPeerId === peerId) return null;
                      const state = participantStates[peerId] || {};
                      const isPeerMuted = state.isMuted;
                      const isPeerVideoOff = state.isVideoOff || bandwidthMode === "audio-only";
                      const isSpeaking = speakingPeers[peerId];
                      return (
                        <SpotlightThumbnail 
                          key={peerId}
                          $isSpeaking={isSpeaking}
                          $isActive={pinnedPeerId === peerId}
                          onClick={() => setPinnedPeerId(peerId)}
                        >
                          {isPeerVideoOff || !info.stream ? (
                            <AvatarPlaceholder>
                              <div className="circle" style={{ fontSize: "1.2rem", width: 44, height: 44 }}>{getInitials(info.name)}</div>
                            </AvatarPlaceholder>
                          ) : (
                            <video
                              autoPlay
                              playsInline
                              ref={el => {
                                if (el && info.stream && el.srcObject !== info.stream) {
                                  el.srcObject = info.stream;
                                  el.volume = (info.volume || 100) / 100;
                                }
                              }}
                            />
                          )}
                          <div style={{ position: "absolute", bottom: 6, left: 6, display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 8, fontSize: "0.68rem" }}>
                            <span>{info.name || "Participant"}</span>
                            {isPeerMuted && <FaMicrophoneSlash color="#ff4757" size={9} />}
                          </div>
                        </SpotlightThumbnail>
                      );
                    })}
                  </SpotlightStrip>
                )}
              </SpotlightContainer>
            ) : (
              <VideoGridContainer $count={gridCount}>
                {/* Local Video Tile */}
                <VideoTile 
                  className="video-tile"
                  $isSpeaking={speakingPeers.local}
                  $isPinned={pinnedPeerId === "local"}
                  onDoubleClick={() => setPinnedPeerId(prev => prev === "local" ? null : "local")}
                >
                  <TileOverlay className="tile-overlay">
                    <TileActionButton 
                      $active={pinnedPeerId === "local"}
                      onClick={() => setPinnedPeerId(prev => prev === "local" ? null : "local")}
                      title={pinnedPeerId === "local" ? "Unpin Spotlight" : "Pin Spotlight"}
                    >
                      <FaThumbtack />
                    </TileActionButton>
                    <TileActionButton 
                      onClick={handleFullscreenVideo}
                      title="View Fullscreen"
                    >
                      <FaExpand />
                    </TileActionButton>
                  </TileOverlay>
                  {isVideoOff || !localStream || bandwidthMode === "audio-only" ? (
                    <AvatarPlaceholder>
                      <div className="circle">{getInitials(userName)}</div>
                    </AvatarPlaceholder>
                  ) : (
                    <video ref={localVideoCallbackRef} autoPlay playsInline muted />
                  )}

                  <TileUserInfo>
                    <span>{userName} (You)</span>
                    {isRoomHost && <FaCrown color="#fbbf24" size={11} title="Room Owner / Admin" />}
                    {isMuted && <FaMicrophoneSlash color="#ff4757" size={11} />}
                    {speakingPeers.local && (
                      <EqualizerWaves>
                        <span /><span /><span />
                      </EqualizerWaves>
                    )}
                  </TileUserInfo>
                </VideoTile>

                {/* Remote Participant Tiles */}
                {gridRemoteEntries.map(([peerId, info]) => {
                  const state = participantStates[peerId] || {};
                  const isPeerMuted = state.isMuted;
                  const isPeerVideoOff = state.isVideoOff || bandwidthMode === "audio-only";
                  const isSpeaking = speakingPeers[peerId];

                  return (
                    <VideoTile 
                      key={peerId}
                      className="video-tile"
                      $isSpeaking={isSpeaking}
                      $isPinned={pinnedPeerId === peerId}
                      onDoubleClick={() => setPinnedPeerId(prev => prev === peerId ? null : peerId)}
                    >
                      <TileOverlay className="tile-overlay">
                        {isRoomHost && (
                          <>
                            <TileActionButton 
                              $danger 
                              onClick={() => setKickTarget({ id: peerId, name: info.name || "Participant" })}
                              title="Remove participant from call"
                            >
                              <FaTrash />
                            </TileActionButton>
                            <TileActionButton 
                              onClick={() => handleMuteParticipant(peerId, info.name || "Participant")}
                              title="Mute for everyone"
                            >
                              <FaVolumeMute />
                            </TileActionButton>
                          </>
                        )}
                        <TileActionButton 
                          $active={pinnedPeerId === peerId}
                          onClick={() => setPinnedPeerId(prev => prev === peerId ? null : peerId)}
                          title={pinnedPeerId === peerId ? "Unpin Spotlight" : "Pin Spotlight"}
                        >
                          <FaThumbtack />
                        </TileActionButton>
                        <TileActionButton 
                          onClick={handleFullscreenVideo}
                          title="View Fullscreen"
                        >
                          <FaExpand />
                        </TileActionButton>
                      </TileOverlay>

                      {isPeerVideoOff || !info.stream ? (
                        <AvatarPlaceholder>
                          <div className="circle">{getInitials(info.name)}</div>
                        </AvatarPlaceholder>
                      ) : (
                        <video
                          autoPlay
                          playsInline
                          ref={el => {
                            if (el && info.stream && el.srcObject !== info.stream) {
                              el.srcObject = info.stream;
                              el.volume = (info.volume || 100) / 100;
                            }
                          }}
                        />
                      )}

                      <TileUserInfo>
                        <span>{info.name || "Participant"}</span>
                        {isPeerMuted && <FaMicrophoneSlash color="#ff4757" size={11} />}
                        {isSpeaking && (
                          <EqualizerWaves>
                            <span /><span /><span />
                          </EqualizerWaves>
                        )}
                      </TileUserInfo>
                    </VideoTile>
                  );
                })}
              </VideoGridContainer>
            )}

            {/* Floating Reactions */}
            {reactions.map(r => (
              <ReactionParticle key={r.id} $x={r.x}>
                {r.emoji}
              </ReactionParticle>
            ))}
          </MainVideoArea>

          {/* ═══ PARTICIPANT STRIP (Teams-style bottom bar) ═══ */}
          {totalCount > 1 && (
            <ParticipantStrip>
              {/* Local Widget */}
              <ParticipantWidget
                $isSpeaking={speakingPeers.local}
                $isHighlighted={highlightedPeers.has("local")}
                $isMinimized={minimizedPeers.has("local")}
                onClick={() => toggleHighlightPeer("local")}
                title={`${userName} (You) - Click to ${highlightedPeers.has("local") ? "unhighlight" : "highlight"}`}
              >
                {isVideoOff || !localStream || bandwidthMode === "audio-only" ? (
                  <AvatarPlaceholder>
                    <div className="circle" style={{ fontSize: "1rem", width: 36, height: 36 }}>{getInitials(userName)}</div>
                  </AvatarPlaceholder>
                ) : (
                  <video ref={localVideoCallbackRef} autoPlay playsInline muted />
                )}
                <WidgetControls className="widget-controls">
                  <WidgetBtn
                    $active={minimizedPeers.has("local")}
                    onClick={(e) => { e.stopPropagation(); toggleMinimizePeer("local"); }}
                    title={minimizedPeers.has("local") ? "Restore to grid" : "Minimize from grid"}
                  >
                    {minimizedPeers.has("local") ? "↗" : "↙"}
                  </WidgetBtn>
                  <WidgetBtn
                    $active={highlightedPeers.has("local")}
                    onClick={(e) => { e.stopPropagation(); toggleHighlightPeer("local"); }}
                    title={highlightedPeers.has("local") ? "Remove highlight" : "Highlight for me"}
                  >
                    ★
                  </WidgetBtn>
                </WidgetControls>
                <WidgetNameTag>
                  <span>You</span>
                  {isMuted && <FaMicrophoneSlash color="#ff4757" size={8} />}
                  {speakingPeers.local && <span style={{ color: "#00f2fe" }}>●</span>}
                </WidgetNameTag>
              </ParticipantWidget>

              {/* Remote Participant Widgets */}
              {remoteEntries.map(([peerId, info]) => {
                const state = participantStates[peerId] || {};
                const isPeerMuted = state.isMuted;
                const isPeerVideoOff = state.isVideoOff || bandwidthMode === "audio-only";
                const isSpeaking = speakingPeers[peerId];
                return (
                  <ParticipantWidget
                    key={peerId}
                    $isSpeaking={isSpeaking}
                    $isHighlighted={highlightedPeers.has(peerId)}
                    $isMinimized={minimizedPeers.has(peerId)}
                    onClick={() => toggleHighlightPeer(peerId)}
                    title={`${info.name || "Participant"} - Click to ${highlightedPeers.has(peerId) ? "unhighlight" : "highlight"}`}
                  >
                    {isPeerVideoOff || !info.stream ? (
                      <AvatarPlaceholder>
                        <div className="circle" style={{ fontSize: "1rem", width: 36, height: 36 }}>{getInitials(info.name)}</div>
                      </AvatarPlaceholder>
                    ) : (
                      <video
                        autoPlay
                        playsInline
                        ref={el => {
                          if (el && info.stream && el.srcObject !== info.stream) {
                            el.srcObject = info.stream;
                            el.volume = (info.volume || 100) / 100;
                          }
                        }}
                      />
                    )}
                    <WidgetControls className="widget-controls">
                      <WidgetBtn
                        $active={minimizedPeers.has(peerId)}
                        onClick={(e) => { e.stopPropagation(); toggleMinimizePeer(peerId); }}
                        title={minimizedPeers.has(peerId) ? "Restore to grid" : "Minimize from grid"}
                      >
                        {minimizedPeers.has(peerId) ? "↗" : "↙"}
                      </WidgetBtn>
                      <WidgetBtn
                        $active={highlightedPeers.has(peerId)}
                        onClick={(e) => { e.stopPropagation(); toggleHighlightPeer(peerId); }}
                        title={highlightedPeers.has(peerId) ? "Remove highlight" : "Highlight for me"}
                      >
                        ★
                      </WidgetBtn>
                    </WidgetControls>
                    <WidgetNameTag>
                      <span>{info.name || "Participant"}</span>
                      {isPeerMuted && <FaMicrophoneSlash color="#ff4757" size={8} />}
                      {isSpeaking && <span style={{ color: "#00f2fe" }}>●</span>}
                    </WidgetNameTag>
                  </ParticipantWidget>
                );
              })}
            </ParticipantStrip>
          )}

          {/* ═══ PARTICIPANTS SLIDE-OVER DRAWER ═══ */}
          {showParticipants && (
            <ParticipantsDrawer>
              <DrawerHeader>
                <h3>
                  <FaUsers color="#818cf8" />
                  <span>Participants ({totalCount})</span>
                </h3>
                <IconButton onClick={() => setShowParticipants(false)}>
                  <FaTimes />
                </IconButton>
              </DrawerHeader>

              <ParticipantList>
                {/* Local User Card */}
                <ParticipantCard>
                  <ParticipantRow>
                    <AvatarSmall>{getInitials(userName)}</AvatarSmall>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{userName} (You)</span>
                        {isRoomHost && <FaCrown color="#fbbf24" size={10} title="Room Owner / Admin" />}
                      </div>
                      <span style={{ fontSize: "0.68rem", opacity: 0.6 }}>Local Participant</span>
                    </div>
                    {isMuted ? <FaMicrophoneSlash color="#ff4757" size={13} /> : <FaMicrophone color="#10b981" size={13} />}
                    {isVideoOff ? <FaVideoSlash color="#ff4757" size={13} /> : <FaVideo color="#10b981" size={13} />}
                  </ParticipantRow>
                </ParticipantCard>

                {/* Remote Participants */}
                {remoteEntries.map(([peerId, info]) => {
                  const state = participantStates[peerId] || {};
                  return (
                    <ParticipantCard key={peerId}>
                      <ParticipantRow>
                        <AvatarSmall>{getInitials(info.name)}</AvatarSmall>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {info.name || "Participant"}
                          </div>
                          <span style={{ fontSize: "0.68rem", opacity: 0.6 }}>Connected</span>
                        </div>
                        {state.isMuted ? <FaMicrophoneSlash color="#ff4757" size={13} /> : <FaMicrophone color="#10b981" size={13} />}
                        {state.isVideoOff ? <FaVideoSlash color="#ff4757" size={13} /> : <FaVideo color="#10b981" size={13} />}
                      </ParticipantRow>

                      {/* Individual Volume Slider */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <FaVolumeUp size={11} style={{ opacity: 0.5 }} />
                        <input
                          type="range"
                          min="0"
                          max="150"
                          value={info.volume ?? 100}
                          onChange={(e) => setParticipantVolume(peerId, Number(e.target.value))}
                          style={{ flex: 1, accentColor: "#4f46e5", height: 4 }}
                        />
                        <span style={{ fontSize: "0.68rem", opacity: 0.6, width: 32 }}>{info.volume ?? 100}%</span>
                      </div>

                      {/* Host Moderation: Remove & Mute Buttons */}
                      {isRoomHost && (
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <DockButton 
                            $danger 
                            style={{ flex: 1, height: 32, fontSize: "0.72rem", padding: "0 8px" }}
                            onClick={() => setKickTarget({ id: peerId, name: info.name || "Participant" })}
                          >
                            <FaTrash size={10} /> Remove User
                          </DockButton>
                          <DockButton 
                            style={{ flex: 1, height: 32, fontSize: "0.72rem", padding: "0 8px" }}
                            onClick={() => handleMuteParticipant(peerId, info.name || "Participant")}
                          >
                            <FaVolumeMute size={10} /> Mute
                          </DockButton>
                        </div>
                      )}
                    </ParticipantCard>
                  );
                })}
              </ParticipantList>
            </ParticipantsDrawer>
          )}
        </ContentArea>

        {/* File Streaming Playback Controls (Host Only) */}
        {isFileStreaming && isRoomHost && (
          <FileStreamControlsCard className="file-stream-controls">
            {/* Row 1: Title + Stop */}
            <div className="stream-header">
              <div className="stream-info">
                <FaPlayCircle className="pulse-icon" />
                <span>{fileStreamName}</span>
              </div>
              <button className="ctrl-btn stop-btn" onClick={stopFileStream} title="Stop Stream">
                <FaStop size={10} />
              </button>
            </div>

            {/* Row 2: Seek Bar */}
            <div className="stream-time">
              <span>{formatDuration(Math.round(fileStreamProgress))}</span>
              <input 
                type="range" 
                min={0} 
                max={fileStreamDuration || 100} 
                step={0.1}
                value={fileStreamProgress} 
                onChange={e => seekFileStream(Number(e.target.value))}
              />
              <span>{formatDuration(Math.round(fileStreamDuration))}</span>
            </div>

            {/* Row 3: Speed | Skip/Play Controls | Volume */}
            <div className="stream-footer">
              <button className="ctrl-btn speed-btn" onClick={cycleFileStreamSpeed} title="Playback Speed">
                {fileStreamSpeed}x
              </button>

              <div className="controls-group">
                <button className="ctrl-btn" onClick={() => skipFileStream(-10)} title="Back 10s">
                  <FaUndo />
                </button>
                <button className="ctrl-btn play-btn" onClick={toggleFileStreamPlay} title={isFileStreamPaused ? "Play" : "Pause"}>
                  {isFileStreamPaused ? <FaPlay style={{ marginLeft: 2 }} /> : <FaPause />}
                </button>
                <button className="ctrl-btn" onClick={() => skipFileStream(10)} title="Forward 10s">
                  <FaRedo />
                </button>
              </div>

              <div className="volume-control">
                <span className="vol-icon" onClick={toggleFileStreamMute}>
                  {fileStreamVolume === 0 ? <FaVolumeMute /> : fileStreamVolume < 0.5 ? <FaVolumeDown /> : <FaVolumeUp />}
                </span>
                <input
                  className="vol-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={fileStreamVolume}
                  onChange={e => changeFileStreamVolume(Number(e.target.value))}
                  title={`Volume: ${Math.round(fileStreamVolume * 100)}%`}
                />
              </div>
            </div>
          </FileStreamControlsCard>
        )}

        {/* ═══ FLOATING CONTROLS DOCK ═══ */}
        <ControlsDock className="controls-bar">
          {/* ── Desktop: single row ── */}
          <span className="desktop-only-controls" style={{ display: "contents" }}>
            <DockButton $danger={isMuted} onClick={toggleMute} title={isMuted ? "Unmute Mic" : "Mute Mic"}>
              {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
              <span style={{ fontSize: "0.75rem" }}>{isMuted ? "Unmute" : "Mute"}</span>
            </DockButton>

            <DockButton $danger={isVideoOff} onClick={toggleVideo} title={isVideoOff ? "Start Video" : "Stop Video"}>
              {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
              <span style={{ fontSize: "0.75rem" }}>{isVideoOff ? "Start Video" : "Stop Video"}</span>
            </DockButton>

            <DockButton onClick={flipCamera} title="Flip Camera">
              <FaExchangeAlt />
            </DockButton>

            {/* Voice Changer */}
            <div style={{ position: "relative" }}>
              <DockButton $active={voiceFilter !== "none"} onClick={() => { setShowVoiceMenu(!showVoiceMenu); setShowVideoMenu(false); }} title="Voice Changer">
                <FaMagic />
                <span style={{ fontSize: "0.75rem" }}>Voice</span>
              </DockButton>
              {showVoiceMenu && (
                <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", width: 220, background: "rgba(18,20,32,0.96)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 8, boxShadow: "0 16px 40px rgba(0,0,0,0.6)", zIndex: 1000 }}>
                  {[
                    { id: "none", label: "🎙️ Normal Voice", desc: "No effects" },
                    { id: "robot", label: "🤖 Robot", desc: "Ring modulation 55Hz" },
                    { id: "telephone", label: "📞 Telephone", desc: "Bandpass megaphone" },
                    { id: "echo", label: "🏔️ Echo / Cave", desc: "Delay + feedback loop" },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => { setVoiceFilter(opt.id); setShowVoiceMenu(false); toast.info(`Voice: ${opt.label}`, { autoClose: 1500 }); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "none", background: voiceFilter === opt.id ? "rgba(99,102,241,0.18)" : "transparent", color: voiceFilter === opt.id ? "#a5b4fc" : "rgba(255,255,255,0.85)", fontSize: "0.78rem", fontWeight: 600, textAlign: "left", cursor: "pointer" }}>
                      <div><span>{opt.label}</span><br /><span style={{ fontSize: "0.65rem", opacity: 0.6 }}>{opt.desc}</span></div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Video Filter */}
            <div style={{ position: "relative" }}>
              <DockButton $active={videoFilter !== "none"} onClick={() => { setShowVideoMenu(!showVideoMenu); setShowVoiceMenu(false); }} title="Video Filter">
                <FaPalette />
                <span style={{ fontSize: "0.75rem" }}>Filter</span>
              </DockButton>
              {showVideoMenu && (
                <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", width: 220, background: "rgba(18,20,32,0.96)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 8, boxShadow: "0 16px 40px rgba(0,0,0,0.6)", zIndex: 1000 }}>
                  {[
                    { id: "none", label: "✨ Normal", desc: "No filter" },
                    { id: "grayscale", label: "🖤 Grayscale", desc: "Black & white" },
                    { id: "sepia", label: "🟤 Sepia", desc: "Warm vintage tone" },
                    { id: "blur", label: "🌫️ Privacy Blur", desc: "Background blur" },
                    { id: "invert", label: "🔄 Invert", desc: "Inverted colors" },
                    { id: "vintage", label: "📸 Vintage", desc: "Retro film look" },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => { setVideoFilter(opt.id); setShowVideoMenu(false); toast.info(`Filter: ${opt.label}`, { autoClose: 1500 }); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "none", background: videoFilter === opt.id ? "rgba(99,102,241,0.18)" : "transparent", color: videoFilter === opt.id ? "#a5b4fc" : "rgba(255,255,255,0.85)", fontSize: "0.78rem", fontWeight: 600, textAlign: "left", cursor: "pointer" }}>
                      <div><span>{opt.label}</span><br /><span style={{ fontSize: "0.65rem", opacity: 0.6 }}>{opt.desc}</span></div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <DockButton onClick={startScreenShare} title="Share Screen">
              <FaDesktop />
              <span style={{ fontSize: "0.75rem" }}>Share</span>
            </DockButton>

            {/* Admin Video & Audio / Link Streaming */}
            {isRoomHost && (
              <>
                <DockButton 
                  $active={isFileStreaming} 
                  onClick={() => {
                    if (isFileStreaming) {
                      stopFileStream();
                    } else {
                      setShowStreamModal(true);
                    }
                  }} 
                  title={isFileStreaming ? "Stop Media Stream" : "Stream File or Media Link"}
                >
                  <FaPlayCircle />
                  <span style={{ fontSize: "0.75rem" }}>{isFileStreaming ? "Stop" : "Stream Media"}</span>
                </DockButton>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="video/*,audio/*" 
                  style={{ display: "none" }} 
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      startMediaStream({ file });
                      e.target.value = "";
                    }
                  }}
                />
              </>
            )}

            <DockDivider />

            {/* Emoji Reactions */}
            <EmojiTray>
              {["👏", "❤️", "😂", "🔥"].map(emoji => (
                <DockButton key={emoji} onClick={() => sendReaction(emoji)} style={{ minWidth: 38, padding: "0 8px" }}>
                  {emoji}
                </DockButton>
              ))}
            </EmojiTray>

            <DockButton onClick={() => sendReaction("✋")} title="Raise Hand">
              <FaHandPaper />
            </DockButton>

            <DockDivider />

            {/* Recording (Host) */}
            {isRoomHost && (
              <DockButton $danger={isRecording} onClick={toggleRecording} title="Record Meeting">
                <FaRecordVinyl />
                <span style={{ fontSize: "0.75rem" }}>{isRecording ? "Recording..." : "Record"}</span>
              </DockButton>
            )}

            {/* End Call Button */}
            <DockButton $danger className="leave-btn" onClick={() => setShowLeaveConfirm(true)} style={{ padding: "0 18px" }}>
              <FaPhoneSlash />
              <span>Leave</span>
            </DockButton>
          </span>

          {/* ── Mobile: two-row layout ── */}
          <MobilePrimaryRow>
            <DockButton $danger={isMuted} onClick={toggleMute} title={isMuted ? "Unmute Mic" : "Mute Mic"}>
              {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            </DockButton>
            <DockButton $danger={isVideoOff} onClick={toggleVideo} title={isVideoOff ? "Start Video" : "Stop Video"}>
              {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
            </DockButton>
            <DockButton onClick={startScreenShare} title="Share Screen">
              <FaDesktop />
            </DockButton>
            {isRoomHost && (
              <DockButton $active={isFileStreaming} onClick={() => isFileStreaming ? stopFileStream() : setShowStreamModal(true)} title={isFileStreaming ? "Stop Stream" : "Stream Media"}>
                <FaPlayCircle />
              </DockButton>
            )}
            {isRoomHost && (
              <DockButton $danger={isRecording} onClick={toggleRecording} title="Record Meeting">
                <FaRecordVinyl />
              </DockButton>
            )}
            <DockButton onClick={() => sendReaction("✋")} title="Raise Hand">
              <FaHandPaper />
            </DockButton>
            <DockButton $danger className="leave-btn" onClick={() => setShowLeaveConfirm(true)} title="Leave Call">
              <FaPhoneSlash />
            </DockButton>
          </MobilePrimaryRow>

          <MobileSecondaryRow>
            <DockButton onClick={flipCamera} title="Flip Camera">
              <FaExchangeAlt />
            </DockButton>
            <div style={{ position: "relative" }}>
              <DockButton $active={voiceFilter !== "none"} onClick={() => { setShowVoiceMenu(!showVoiceMenu); setShowVideoMenu(false); }} title="Voice Changer">
                <FaMagic />
              </DockButton>
              {showVoiceMenu && (
                <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", width: 220, background: "rgba(18,20,32,0.96)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 8, boxShadow: "0 16px 40px rgba(0,0,0,0.6)", zIndex: 1000 }}>
                  {[
                    { id: "none", label: "🎙️ Normal Voice", desc: "No effects" },
                    { id: "robot", label: "🤖 Robot", desc: "Ring modulation 55Hz" },
                    { id: "telephone", label: "📞 Telephone", desc: "Bandpass megaphone" },
                    { id: "echo", label: "🏔️ Echo / Cave", desc: "Delay + feedback loop" },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => { setVoiceFilter(opt.id); setShowVoiceMenu(false); toast.info(`Voice: ${opt.label}`, { autoClose: 1500 }); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "none", background: voiceFilter === opt.id ? "rgba(99,102,241,0.18)" : "transparent", color: voiceFilter === opt.id ? "#a5b4fc" : "rgba(255,255,255,0.85)", fontSize: "0.78rem", fontWeight: 600, textAlign: "left", cursor: "pointer" }}>
                      <div><span>{opt.label}</span><br /><span style={{ fontSize: "0.65rem", opacity: 0.6 }}>{opt.desc}</span></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <DockButton $active={videoFilter !== "none"} onClick={() => { setShowVideoMenu(!showVideoMenu); setShowVoiceMenu(false); }} title="Video Filter">
                <FaPalette />
              </DockButton>
              {showVideoMenu && (
                <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", width: 220, background: "rgba(18,20,32,0.96)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 8, boxShadow: "0 16px 40px rgba(0,0,0,0.6)", zIndex: 1000 }}>
                  {[
                    { id: "none", label: "✨ Normal", desc: "No filter" },
                    { id: "grayscale", label: "🖤 Grayscale", desc: "Black & white" },
                    { id: "sepia", label: "🟤 Sepia", desc: "Warm vintage tone" },
                    { id: "blur", label: "🌫️ Privacy Blur", desc: "Background blur" },
                    { id: "invert", label: "🔄 Invert", desc: "Inverted colors" },
                    { id: "vintage", label: "📸 Vintage", desc: "Retro film look" },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => { setVideoFilter(opt.id); setShowVideoMenu(false); toast.info(`Filter: ${opt.label}`, { autoClose: 1500 }); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "none", background: videoFilter === opt.id ? "rgba(99,102,241,0.18)" : "transparent", color: videoFilter === opt.id ? "#a5b4fc" : "rgba(255,255,255,0.85)", fontSize: "0.78rem", fontWeight: 600, textAlign: "left", cursor: "pointer" }}>
                      <div><span>{opt.label}</span><br /><span style={{ fontSize: "0.65rem", opacity: 0.6 }}>{opt.desc}</span></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {["👏", "❤️", "😂", "🔥"].map(emoji => (
              <DockButton key={emoji} onClick={() => sendReaction(emoji)} style={{ minWidth: 42 }}>
                {emoji}
              </DockButton>
            ))}
            {isRoomHost && (
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="video/*,audio/*" 
                style={{ display: "none" }} 
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    startMediaStream({ file });
                    e.target.value = "";
                  }
                }}
              />
            )}
          </MobileSecondaryRow>
        </ControlsDock>

        {/* ═══ STREAM MEDIA OPTIONS MODAL (Files + Web Links) ═══ */}
        {showStreamModal && (
          <ModalBackdrop onClick={() => setShowStreamModal(false)}>
            <ModalContent onClick={e => e.stopPropagation()} style={{ width: "min(460px, 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <FaPlayCircle color="#818cf8" />
                  <span>Stream Video, Audio or Link</span>
                </h3>
                <IconButton onClick={() => setShowStreamModal(false)}>
                  <FaTimes />
                </IconButton>
              </div>

              <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0 0 16px", lineHeight: 1.4 }}>
                Stream a local video/audio file or paste any media link (YouTube, MP4, MP3, Web stream) directly into the room call while keeping your microphone & webcam active.
              </p>

              {/* Option 1: File Upload */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 6, color: "#a5b4fc" }}>
                  📁 Option 1: Upload Video or Audio File
                </div>
                <p style={{ fontSize: "0.72rem", opacity: 0.6, margin: "0 0 10px" }}>
                  Select any MP4, MKV, MP3, WAV or media file from your device.
                </p>
                <DockButton
                  style={{ width: "100%", justifyContent: "center", height: 38, borderRadius: 10, background: "rgba(129, 140, 248, 0.15)", color: "#818cf8", border: "1px solid rgba(129, 140, 248, 0.3)" }}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >
                  Choose Media File...
                </DockButton>
              </div>

              {/* Option 2: External Media Link */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 6, color: "#38bdf8" }}>
                  🔗 Option 2: Stream URL / Media Link
                </div>
                <p style={{ fontSize: "0.72rem", opacity: 0.6, margin: "0 0 10px" }}>
                  Paste a direct video/audio URL, YouTube, Instagram or stream link.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="url"
                    placeholder="https://example.com/video.mp4 or link..."
                    value={streamUrlInput}
                    onChange={e => setStreamUrlInput(e.target.value)}
                    style={{
                      flex: 1,
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10,
                      padding: "0 12px",
                      color: "#fff",
                      fontSize: "0.8rem",
                      outline: "none"
                    }}
                  />
                  <DockButton
                    style={{ height: 38, borderRadius: 10, padding: "0 14px", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", border: "none" }}
                    onClick={() => {
                      if (!streamUrlInput.trim()) {
                        toast.warn("Please enter a valid media link.");
                        return;
                      }
                      startMediaStream({ url: streamUrlInput.trim() });
                      setStreamUrlInput("");
                    }}
                  >
                    Start Stream
                  </DockButton>
                </div>
              </div>
            </ModalContent>
          </ModalBackdrop>
        )}

        {/* ═══ KICK CONFIRMATION MODAL ═══ */}
        {kickTarget && (
          <ModalBackdrop onClick={() => setKickTarget(null)}>
            <ModalContent onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                  <FaExclamationTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>Remove Participant?</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", opacity: 0.6 }}>This will immediately disconnect them from the video call.</p>
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.04)", padding: 12, borderRadius: 12, marginBottom: 20, fontSize: "0.85rem" }}>
                Target: <strong>{kickTarget.name}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <DockButton onClick={() => setKickTarget(null)}>Cancel</DockButton>
                <DockButton $danger onClick={() => handleKickParticipant(kickTarget.id, kickTarget.name)}>
                  Yes, Remove User
                </DockButton>
              </div>
            </ModalContent>
          </ModalBackdrop>
        )}

        {/* ═══ CONNECTION DIAGNOSTICS MODAL ═══ */}
        {showDiagnostics && (
          <ModalBackdrop onClick={() => setShowDiagnostics(false)}>
            <ModalContent onClick={e => e.stopPropagation()} style={{ width: "min(480px, 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <FaChartLine color="#818cf8" />
                  <span>Connection Diagnostics</span>
                </h3>
                <IconButton onClick={() => setShowDiagnostics(false)}>
                  <FaTimes />
                </IconButton>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                  <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>Latency (RTT)</span>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: networkQuality.rtt < 150 ? "#34d399" : "#fbbf24" }}>
                    {networkQuality.rtt} ms
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                  <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>Packet Loss</span>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: networkQuality.loss < 3 ? "#34d399" : "#f87171" }}>
                    {networkQuality.loss}%
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                  <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>Current Bitrate</span>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#818cf8" }}>
                    {networkQuality.bitrate} kbps
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                  <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>Bandwidth Profile</span>
                  <div style={{ fontSize: "1.0rem", fontWeight: 800, textTransform: "capitalize" }}>
                    {bandwidthMode}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "0.75rem", opacity: 0.7, lineHeight: 1.5, background: "rgba(99,102,241,0.08)", padding: 12, borderRadius: 10, border: "1px solid rgba(99,102,241,0.2)" }}>
                💡 <strong>Tip for Low Bandwidth:</strong> Switch to <em>Data Saver</em> (120kbps) or <em>Audio-Only</em> mode in the top bar to preserve smooth audio when your connection is slow.
              </div>
            </ModalContent>
          </ModalBackdrop>
        )}

        {/* ═══ LEAVE CONFIRMATION MODAL ═══ */}
        {showLeaveConfirm && (
          <ModalBackdrop onClick={() => setShowLeaveConfirm(false)}>
            <ModalContent onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, minWidth: 44, borderRadius: "50%", background: "rgba(255,71,87,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ff4757", flexShrink: 0 }}>
                  <FaPhoneSlash size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, lineHeight: 1.3 }}>Leave Meeting?</h3>
                  <p style={{ margin: "4px 0 0", fontSize: "0.78rem", opacity: 0.6, lineHeight: 1.4 }}>You will be disconnected from all participants.</p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                <DockButton 
                  onClick={() => setShowLeaveConfirm(false)}
                  style={{ minWidth: 80, height: 42, borderRadius: 12, justifyContent: "center" }}
                >Cancel</DockButton>
                <DockButton 
                  $danger 
                  onClick={handleLeaveCall}
                  style={{ minWidth: 130, height: 42, borderRadius: 12, justifyContent: "center", gap: 6 }}
                >
                  <FaPhoneSlash size={12} />
                  Leave Meeting
                </DockButton>
              </div>
            </ModalContent>
          </ModalBackdrop>
        )}
      </MeetingContainer>
    </StyleSheetManager>
  );
}