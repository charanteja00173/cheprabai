import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes, StyleSheetManager, css } from "styled-components";
import { 
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, 
  FaPhoneSlash, FaSync, FaDesktop, FaFolderOpen, FaRecordVinyl, 
  FaCompress, FaExpand, FaExchangeAlt, FaLink, 
  FaThLarge, FaStop, FaUsers, FaHandPaper, FaPlay, 
  FaPause, FaStepBackward, FaStepForward, FaTachometerAlt,
  FaWifi, FaSignal
} from "react-icons/fa";
import { Peer } from "peerjs";
import { toast } from "react-toastify";

// Prevent extension interference
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e.message && e.message.includes('chrome-extension')) {
      e.preventDefault();
      return true;
    }
  });
}

/* ═══════════════════════════════ ANIMATIONS ═══════════════════════════════ */
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.96) translateY(10px); } 
  to { opacity: 1; transform: scale(1) translateY(0); }
`;
const slideUp = keyframes`
  from { opacity: 0; transform: translateY(30px) scale(0.95); } 
  to { opacity: 1; transform: translateY(0) scale(1); }
`;
const floatUp = keyframes`
  0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; } 
  100% { transform: translateY(-600px) scale(2) rotate(20deg); opacity: 0; }
`;
const spin = keyframes`
  from { transform: rotate(0deg); } 
  to { transform: rotate(360deg); }
`;
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); } 
  70% { box-shadow: 0 0 0 12px rgba(255, 71, 87, 0); } 
  100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
`;
const shimmer = keyframes`
  0% { background-position: -200% 0; } 
  100% { background-position: 200% 0; }
`;
const tileEnter = keyframes`
  from { opacity: 0; transform: scale(0.85) rotateY(-10deg); } 
  to { opacity: 1; transform: scale(1) rotateY(0); }
`;
const breathe = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

/* ═══════════════════════════════ STYLED COMPONENTS ═══════════════════════════════ */
const MeetingContainer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10005;
  background: var(--chakra-colors-bg, #0a0a12);
  display: flex;
  flex-direction: column;
  color: var(--chakra-colors-textPrimary, #ffffff);
  overflow: hidden;
  animation: ${fadeIn} 0.4s cubic-bezier(0.4, 0, 0.2, 1);
`;

const GradientBackground = styled.div`
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(ellipse at 20% 50%, rgba(74, 158, 255, 0.05) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 50%, rgba(108, 92, 231, 0.05) 0%, transparent 60%),
    var(--chakra-colors-bg, #0a0a12);
  z-index: 0;
`;

const MeetingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(10, 10, 18, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 10;
  flex-shrink: 0;
  gap: 12px;

  @media (max-width: 768px) {
    padding: 12px 16px;
    gap: 8px;
  }

  @media (max-width: 480px) {
    padding: 8px 12px;
    gap: 4px;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;

  @media (max-width: 768px) {
    gap: 8px;
  }

  @media (max-width: 480px) {
    gap: 4px;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    gap: 4px;
  }

  @media (max-width: 480px) {
    gap: 2px;
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: clamp(1rem, 1.5vw, 1.2rem);
  font-weight: 700;
  color: #4a9eff;

  .logo-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4a9eff;
    animation: ${pulse} 2s infinite;
  }

  @media (max-width: 480px) {
    gap: 4px;
    .logo-dot {
      width: 6px;
      height: 6px;
    }
  }
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: clamp(0.6rem, 0.9vw, 0.75rem);
  font-weight: 600;
  background: ${props => {
    if (props.$status === 'good') return 'rgba(46, 213, 115, 0.15)';
    if (props.$status === 'poor') return 'rgba(255, 165, 2, 0.15)';
    return 'rgba(255, 71, 87, 0.15)';
  }};
  color: ${props => {
    if (props.$status === 'good') return '#2ed573';
    if (props.$status === 'poor') return '#ffa502';
    return '#ff4757';
  }};
  border: 1px solid ${props => {
    if (props.$status === 'good') return 'rgba(46, 213, 115, 0.2)';
    if (props.$status === 'poor') return 'rgba(255, 165, 2, 0.2)';
    return 'rgba(255, 71, 87, 0.2)';
  }};

  @media (max-width: 768px) {
    padding: 2px 8px;
    font-size: 0.55rem;
  }

  @media (max-width: 480px) {
    padding: 2px 6px;
    font-size: 0.5rem;
    gap: 3px;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px 24px;
  position: relative;
  z-index: 1;
  min-height: 0;

  @media (max-width: 1024px) {
    flex-direction: column;
    padding: 12px 16px;
    gap: 12px;
  }

  @media (max-width: 768px) {
    padding: 8px 12px;
    gap: 8px;
  }

  @media (max-width: 480px) {
    padding: 6px 8px;
    gap: 6px;
  }
`;

const MainVideoArea = styled.div`
  flex: 1;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.06);
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;

  @media (max-width: 768px) {
    border-radius: 16px;
    min-height: 200px;
  }

  @media (max-width: 480px) {
    border-radius: 12px;
    min-height: 150px;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const ParticipantSidebar = styled.div`
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 24px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  max-height: 100%;
  overflow: hidden;

  @media (max-width: 1024px) {
    width: 100%;
    flex-direction: row;
    padding: 12px;
    gap: 8px;
    max-height: 160px;
    overflow-x: auto;
    overflow-y: hidden;
    &::-webkit-scrollbar { display: none; }
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  @media (max-width: 768px) {
    max-height: 120px;
    padding: 8px;
    gap: 6px;
    border-radius: 16px;
  }

  @media (max-width: 480px) {
    max-height: 90px;
    padding: 6px;
    gap: 4px;
    border-radius: 12px;
  }
`;

const ParticipantTile = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 16/9;
  border: 2px solid ${props => 
    props.$isTalking ? 'rgba(46, 213, 115, 0.6)' : 
    props.$isActive ? 'rgba(74, 158, 255, 0.4)' : 
    'rgba(255, 255, 255, 0.06)'
  };
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: ${tileEnter} 0.4s ease-out;

  &:hover {
    transform: scale(1.02);
    border-color: ${props => props.$isTalking ? 'rgba(46, 213, 115, 0.8)' : 'rgba(74, 158, 255, 0.6)'};
  }

  ${props => props.$isActive && css`
    animation: ${breathe} 2s ease-in-out infinite;
  `}

  @media (max-width: 1024px) {
    min-width: 160px;
    width: clamp(120px, 20vw, 200px);
    height: auto;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    min-width: 120px;
    width: clamp(80px, 18vw, 140px);
    border-radius: 12px;
  }

  @media (max-width: 480px) {
    min-width: 80px;
    width: clamp(60px, 15vw, 100px);
    border-radius: 8px;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const ControlsBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(10, 10, 18, 0.9);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    padding: 10px 12px;
    gap: 6px;
  }

  @media (max-width: 480px) {
    padding: 8px 8px;
    gap: 4px;
  }
`;

const ControlButton = styled.button`
  width: clamp(40px, 5vw, 48px);
  height: clamp(40px, 5vw, 48px);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: ${props => props.$active ? 'rgba(255, 71, 87, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
  color: ${props => props.$active ? '#ff4757' : 'var(--chakra-colors-textPrimary, #ffffff)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.85rem, 1.2vw, 1.1rem);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  position: relative;

  ${props => props.$primary && `
    background: #ff4757;
    border-color: #ff4757;
    color: white;
    &:hover {
      background: #ff6b81;
      border-color: #ff6b81;
    }
  `}

  ${props => props.$success && `
    background: rgba(46, 213, 115, 0.2);
    border-color: rgba(46, 213, 115, 0.3);
    color: #2ed573;
    &:hover {
      background: rgba(46, 213, 115, 0.3);
    }
  `}

  &:hover {
    transform: translateY(-2px);
    background: ${props => props.$active ? 'rgba(255, 71, 87, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
    border-color: ${props => props.$active ? 'rgba(255, 71, 87, 0.5)' : 'rgba(255, 255, 255, 0.15)'};
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    font-size: 0.8rem;
  }

  @media (max-width: 480px) {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 0.7rem;
  }

  .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ff4757;
    color: white;
    font-size: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;

    @media (max-width: 480px) {
      width: 12px;
      height: 12px;
      font-size: 0.4rem;
    }
  }
`;

const ControlDivider = styled.div`
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0 4px;
  flex-shrink: 0;

  @media (max-width: 480px) {
    height: 24px;
    margin: 0 2px;
  }
`;

const MediaControlsOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%);
  padding: 30px 20px 16px;
  z-index: 20;
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 0.3s ease;

  @media (max-width: 768px) {
    padding: 20px 12px 12px;
  }

  @media (max-width: 480px) {
    padding: 16px 8px 8px;
  }
`;

const MediaControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(6px, 1.5vw, 12px);
  flex-wrap: wrap;

  @media (max-width: 480px) {
    gap: 4px;
  }
`;

const MediaButton = styled.button`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  padding: clamp(4px, 0.6vw, 8px) clamp(6px, 1vw, 12px);
  cursor: pointer;
  font-size: clamp(0.7rem, 1vw, 0.9rem);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  @media (max-width: 480px) {
    padding: 3px 6px;
    font-size: 0.6rem;
    border-radius: 6px;
  }
`;

const SeekBar = styled.input`
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
  min-width: 60px;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #4a9eff;
    cursor: pointer;
    border: 2px solid rgba(255,255,255,0.2);
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #4a9eff;
    cursor: pointer;
    border: 2px solid rgba(255,255,255,0.2);
  }

  @media (max-width: 768px) {
    &::-webkit-slider-thumb {
      width: 12px;
      height: 12px;
    }
  }

  @media (max-width: 480px) {
    &::-webkit-slider-thumb {
      width: 10px;
      height: 10px;
    }
  }
`;

const SpeedSelect = styled.select`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: white;
  padding: clamp(2px, 0.4vw, 4px) clamp(4px, 0.6vw, 8px);
  border-radius: 6px;
  font-size: clamp(0.6rem, 0.8vw, 0.75rem);
  cursor: pointer;

  @media (max-width: 480px) {
    font-size: 0.55rem;
    padding: 2px 4px;
  }
`;

const NameTag = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: clamp(0.55rem, 0.8vw, 0.7rem);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  max-width: 90%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 768px) {
    padding: 3px 8px;
    font-size: 0.5rem;
    border-radius: 8px;
  }

  @media (max-width: 480px) {
    padding: 2px 6px;
    font-size: 0.45rem;
    border-radius: 6px;
    bottom: 4px;
    left: 4px;
  }
`;

const StatusBadge = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  background: ${props => props.$type === 'muted' ? 'rgba(255, 71, 87, 0.9)' : 'rgba(74, 158, 255, 0.9)'};
  color: white;
  width: clamp(20px, 3vw, 28px);
  height: clamp(20px, 3vw, 28px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.5rem, 0.8vw, 0.7rem);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);

  @media (max-width: 768px) {
    width: 18px;
    height: 18px;
    font-size: 0.5rem;
    top: 4px;
    right: 4px;
  }

  @media (max-width: 480px) {
    width: 14px;
    height: 14px;
    font-size: 0.4rem;
    top: 3px;
    right: 3px;
  }
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 5;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: white;
  text-align: center;
  padding: 20px;

  h3 {
    font-size: clamp(1rem, 2vw, 1.5rem);
    margin: 0;
  }

  p {
    font-size: clamp(0.7rem, 1.2vw, 0.9rem);
    opacity: 0.7;
    margin: 0;
  }

  @media (max-width: 768px) {
    gap: 10px;
  }
`;

const ConnectingSpinner = styled.div`
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #4a9eff;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
  }
`;

const UrlInputOverlay = styled.div`
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 20, 35, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  gap: 10px;
  width: min(500px, 90%);
  z-index: 100;
  animation: ${slideUp} 0.3s ease-out;

  input {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 8px 14px;
    color: white;
    font-size: clamp(0.8rem, 1.2vw, 0.9rem);
    outline: none;

    &:focus {
      border-color: #4a9eff;
    }
  }

  button {
    background: #4a9eff;
    border: none;
    border-radius: 8px;
    padding: 8px 20px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    font-size: clamp(0.8rem, 1.2vw, 0.9rem);
    transition: background 0.2s;
    white-space: nowrap;

    &:hover {
      background: #6cb0ff;
    }
  }

  @media (max-width: 768px) {
    bottom: 70px;
    padding: 12px 16px;
    border-radius: 12px;
    gap: 8px;
    width: 92%;
  }

  @media (max-width: 480px) {
    bottom: 60px;
    padding: 10px 12px;
    border-radius: 10px;
    gap: 6px;
    width: 94%;

    input {
      padding: 6px 10px;
      font-size: 0.75rem;
    }

    button {
      padding: 6px 12px;
      font-size: 0.75rem;
    }
  }
`;

const ReactionFloat = styled.div`
  position: absolute;
  bottom: 0;
  left: ${props => props.$x}%;
  font-size: clamp(2rem, 4vw, 3rem);
  animation: ${floatUp} 3s ease-out forwards;
  z-index: 50;
  pointer-events: none;
`;

const SyncIndicator = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  padding: 6px 14px;
  border-radius: 12px;
  font-size: clamp(0.6rem, 0.9vw, 0.75rem);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.2);
  z-index: 30;
  animation: ${slideUp} 0.3s ease-out;

  @media (max-width: 768px) {
    top: 12px;
    right: 12px;
    padding: 4px 10px;
    font-size: 0.55rem;
  }

  @media (max-width: 480px) {
    top: 8px;
    right: 8px;
    padding: 3px 8px;
    font-size: 0.5rem;
    gap: 4px;
  }

  svg {
    animation: ${spin} 1s linear infinite;
  }
`;

/* ═══════════════════════════════ HELPERS ═══════════════════════════════ */
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/* ═══════════════════════════════ COMPONENT ═══════════════════════════════ */
export default function LiveMeeting({ socket, roomId, userName, onClose, isAdmin }) {
  // State
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeMedia, setActiveMedia] = useState(null);
  const [speakingPeers, setSpeakingPeers] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [focusedPeerId, setFocusedPeerId] = useState(null);
  const [networkStatus, setNetworkStatus] = useState("good");
  const [layoutMode, setLayoutMode] = useState("grid");
  const [participantStates, setParticipantStates] = useState({});
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [broadcastUrl, setBroadcastUrl] = useState("");
  const [streamMediaSource, setStreamMediaSource] = useState(null);
  const [myPeerId, setMyPeerId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);
  const [remoteFileBroadcast, setRemoteFileBroadcast] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [localPlaybackState, setLocalPlaybackState] = useState({ playing: false, time: 0, duration: 0 });
  const [videoDuration, setVideoDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [controlTimeout, setControlTimeout] = useState(null);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // Refs
  const containerRef = useRef();
  const peerRef = useRef(null);
  const myVideoRef = useRef();
  const mediaRef = useRef();
  const localMediaRef = useRef(null);
  const isRemoteUpdate = useRef(false);
  const peers = useRef({});
  const recorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const localStreamRef = useRef(null);
  const callStartTime = useRef(Date.now());
  const ytPlayerRef = useRef(null);
  const broadcastVideoRef = useRef(null);

  // ─── Get controlled media element ───
  const getControlledMedia = useCallback(() => {
    if (activeMedia?.type === "local_stream") {
      return localMediaRef.current || broadcastVideoRef.current;
    }
    return mediaRef.current;
  }, [activeMedia?.type]);

  // ─── Call Duration Timer ───
  useEffect(() => {
    callStartTime.current = Date.now();
    const timer = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Auto-hide controls on video ───
  useEffect(() => {
    if (!activeMedia) return;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(controlTimeout);
      const timeout = setTimeout(() => setShowControls(false), 3000);
      setControlTimeout(timeout);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('touchstart', handleMouseMove);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('touchstart', handleMouseMove);
      }
      clearTimeout(controlTimeout);
    };
  }, [activeMedia, controlTimeout]);

  // ─── Auto-focus active talker ───
  useEffect(() => {
    const activeTalker = Object.entries(speakingPeers).find(([id, isTalking]) => isTalking && id !== "local");
    if (activeTalker && layoutMode !== "stage") {
      setFocusedPeerId(activeTalker[0]);
    }
  }, [speakingPeers, layoutMode]);

  // ─── Adaptive Bitrate Control ───
  useEffect(() => {
    if (!localStream) return;

    const interval = setInterval(async () => {
      try {
        let totalPacketsLost = 0;
        let totalRTT = 0;
        let rttCount = 0;

        const promises = Object.values(peers.current).map(async (call) => {
          if (!call.peerConnection) return;
          try {
            const stats = await call.peerConnection.getStats();
            stats.forEach((report) => {
              if (report.type === "candidate-pair" && report.state === "succeeded") {
                if (report.currentRoundTripTime !== undefined) {
                  totalRTT += report.currentRoundTripTime;
                  rttCount++;
                }
              }
              if (report.type === "inbound-rtp" && report.kind === "video") {
                if (report.packetsLost !== undefined) {
                  totalPacketsLost += report.packetsLost;
                }
              }
            });
          } catch (e) { /* ignore */ }
        });

        await Promise.all(promises);
        const avgRTT = rttCount > 0 ? (totalRTT / rttCount) * 1000 : 0;

        let nextStatus = "good";
        if (avgRTT > 300 || totalPacketsLost > 50) nextStatus = "poor";
        if (avgRTT > 600 || totalPacketsLost > 150) nextStatus = "fallback";

        setNetworkStatus(nextStatus);

        Object.values(peers.current).forEach((call) => {
          if (!call.peerConnection) return;
          const senders = call.peerConnection.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === "video");
          if (videoSender) {
            try {
              const params = videoSender.getParameters();
              if (params && params.encodings && params.encodings[0]) {
                let maxBitrate = 1500000;
                if (nextStatus === "poor") maxBitrate = 300000;
                else if (nextStatus === "fallback") maxBitrate = 50000;
                params.encodings[0].maxBitrate = maxBitrate;
                videoSender.setParameters(params);
              }
            } catch (err) { /* ignore */ }
          }
        });
      } catch (e) {
        // Silent fail for ABR
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [localStream]);

  // ─── Main PeerJS Initialization ───
  useEffect(() => {
    const backendUrl = new URL(process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com");

    const cleanupPeer = (peerId) => {
      if (peers.current[peerId]) {
        try { peers.current[peerId].close(); } catch (e) {}
        delete peers.current[peerId];
      }
      setRemoteStreams(p => {
        const n = { ...p };
        delete n[peerId];
        return n;
      });
      setParticipantStates(p => {
        const n = { ...p };
        delete n[peerId];
        return n;
      });
    };

    const handleCallEvents = (call, remotePeerId) => {
      call.on("stream", (rem) => {
        setRemoteStreams(p => ({
          ...p,
          [remotePeerId]: {
            stream: rem,
            name: p[remotePeerId]?.name || "Participant"
          }
        }));
      });
      call.on("close", () => cleanupPeer(remotePeerId));
      call.on("error", (e) => {
        console.error(`Call error with peer ${remotePeerId}:`, e);
        cleanupPeer(remotePeerId);
      });
    };

    const init = async () => {
      try {
        setIsConnecting(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        const iceServers = [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" }
        ];

        if (process.env.REACT_APP_TURN_URL) {
          iceServers.push({
            urls: process.env.REACT_APP_TURN_URL,
            username: process.env.REACT_APP_TURN_USERNAME,
            credential: process.env.REACT_APP_TURN_PASSWORD
          });
        }

        const peer = new Peer(undefined, {
          path: "/peerjs",
          host: backendUrl.hostname,
          port: backendUrl.port || (backendUrl.protocol === "https:" ? 443 : 80),
          secure: backendUrl.protocol === "https:",
          config: { iceServers }
        });

        peer.on("open", (id) => {
          setMyPeerId(id);
          setIsConnecting(false);
          socket.emit("join-call", { roomId, peerId: id, userName, isMuted: false, isVideoOff: false });
        });

        peer.on("call", (call) => {
          call.answer(localStreamRef.current);
          handleCallEvents(call, call.peer);
          peers.current[call.peer] = call;
        });

        peer.on("error", (err) => {
          console.error("PeerJS error:", err);
          if (err.type === "disconnected") {
            toast.warning("Disconnected from meeting server. Reconnecting...");
            peer.reconnect();
          } else if (err.type === "network") {
            toast.error("Network error. Checking signaling path...");
          } else if (err.type === "peer-unavailable") {
            const peerIdStr = err.message.split(" ").pop();
            if (peerIdStr) cleanupPeer(peerIdStr);
          }
        });

        peer.on("disconnected", () => {
          console.log("PeerJS disconnected. Attempting reconnection...");
          peer.reconnect();
        });

        peerRef.current = peer;

        // ─── Socket Event Handlers ───
        socket.on("existing-callers", (callers) => {
          callers.forEach(({ peerId, name, isMuted: peerMuted, isVideoOff: peerVideoOff }) => {
            setRemoteStreams(p => ({ ...p, [peerId]: { stream: p[peerId]?.stream || null, name } }));
            setParticipantStates(p => ({
              ...p,
              [peerId]: { isMuted: peerMuted, isVideoOff: peerVideoOff }
            }));
          });

          setTimeout(() => {
            callers.forEach(({ peerId, name }) => {
              if (localStreamRef.current && peerRef.current && !peers.current[peerId]) {
                const call = peerRef.current.call(peerId, localStreamRef.current);
                if (call) {
                  handleCallEvents(call, peerId);
                  peers.current[peerId] = call;
                }
              }
            });
          }, 500);
        });

        socket.on("user-connected-call", ({ peerId, name, isMuted: peerMuted, isVideoOff: peerVideoOff }) => {
          setRemoteStreams(p => ({ ...p, [peerId]: { stream: p[peerId]?.stream || null, name } }));
          setParticipantStates(p => ({
            ...p,
            [peerId]: { isMuted: peerMuted, isVideoOff: peerVideoOff }
          }));

          setTimeout(() => {
            if (localStreamRef.current && peerRef.current && !peers.current[peerId]) {
              const call = peerRef.current.call(peerId, localStreamRef.current);
              if (call) {
                handleCallEvents(call, peerId);
                peers.current[peerId] = call;
                toast.info(`${name} joined the call`);
              }
            }
          }, 300);
        });

        // Audio Activity Detection
        if (localStreamRef.current) {
          try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(localStreamRef.current);
            const analyzer = audioContext.createAnalyser();
            analyzer.fftSize = 512;
            source.connect(analyzer);
            const data = new Uint8Array(analyzer.frequencyBinCount);

            const checkVolume = () => {
              if (!analyzer) return;
              try {
                analyzer.getByteFrequencyData(data);
                const volume = data.reduce((a, b) => a + b) / data.length;
                const isTalking = volume > 30;
                setSpeakingPeers(p => {
                  if (p.local === isTalking) return p;
                  const currentPeerId = peerRef.current?.id;
                  if (currentPeerId) {
                    socket.emit("talking-state-change", { peerId: currentPeerId, isTalking });
                  }
                  return { ...p, local: isTalking };
                });
                requestAnimationFrame(checkVolume);
              } catch (e) {
                // Silent fail for audio analysis
              }
            };
            checkVolume();
          } catch (e) {
            // Silent fail for audio context
          }
        }

        socket.on("user-disconnected-call", (id) => {
          cleanupPeer(id);
        });

        socket.on("user-media-change", ({ peerId, isMuted: peerMuted, isVideoOff: peerVideoOff }) => {
          setParticipantStates(p => ({
            ...p,
            [peerId]: { ...p[peerId], isMuted: peerMuted, isVideoOff: peerVideoOff }
          }));
        });

        socket.on("screenshare-started", ({ peerId }) => {
          setFocusedPeerId(peerId);
          setLayoutMode("stage");
          toast.info("Someone is sharing their screen");
        });

        socket.on("screenshare-stopped", ({ peerId }) => {
          setFocusedPeerId(null);
          setLayoutMode("grid");
        });

        socket.on("media-file-shared", (data) => {
          setRemoteFileBroadcast(data);
          setLayoutMode("stage");
        });

        socket.on("media-file-stopped", () => {
          setRemoteFileBroadcast(null);
        });

        socket.on("syncMedia", (data) => {
          isRemoteUpdate.current = true;
          setIsSyncing(true);
          setActiveMedia(data);
          setTimeout(() => { isRemoteUpdate.current = false; setIsSyncing(false); }, 1200);
        });

        socket.on("meeting-control-denied", ({ message }) => {
          toast.error(message || "Only the room admin can use this meeting control.");
        });

        socket.on("reaction", (emoji) => {
          const id = Date.now() + Math.random();
          setReactions(p => [...p, { id, emoji, x: Math.random() * 80 + 10 }]);
          setTimeout(() => setReactions(p => p.filter(r => r.id !== id)), 3000);
        });

        socket.on("user-talking-change", ({ peerId, isTalking }) => {
          setSpeakingPeers(p => {
            if (p[peerId] === isTalking) return p;
            return { ...p, [peerId]: isTalking };
          });
        });

        socket.emit("getMediaState", roomId);
      } catch (err) {
        console.error("Failed to initialize media devices:", err);
        setIsConnecting(false);
        toast.error("Could not access camera/microphone. Please check your permissions.");
      }
    };

    init();

    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      socket.emit("leave-call", { roomId });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      Object.values(peers.current).forEach(call => {
        try { call.close(); } catch (e) {}
      });
      peers.current = {};
      if (peerRef.current) {
        try { peerRef.current.destroy(); } catch (e) {}
      }
      socket.off("user-connected-call");
      socket.off("existing-callers");
      socket.off("user-disconnected-call");
      socket.off("user-media-change");
      socket.off("screenshare-started");
      socket.off("screenshare-stopped");
      socket.off("media-file-shared");
      socket.off("media-file-stopped");
      socket.off("syncMedia");
      socket.off("meeting-control-denied");
      socket.off("reaction");
      socket.off("user-talking-change");
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [roomId, socket, userName, isAdmin]);

  // ─── Prevent accidental tab close ───
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Meeting in progress. Leaving will disconnect you from the call. Continue?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ─── Media Sync ───
  useEffect(() => {
    const v = getControlledMedia();
    if (!v || !activeMedia) return;

    if (Math.abs(v.currentTime - activeMedia.time) > 2.5) {
      v.currentTime = activeMedia.time;
    }

    const handleSync = async () => {
      try {
        if (activeMedia.playing && v.paused) {
          await v.play().catch(async () => {
            v.muted = true;
            await v.play();
            toast.info("Click anywhere to enable audio");
            const unmute = () => { v.muted = false; document.removeEventListener("click", unmute); };
            document.addEventListener("click", unmute);
          });
        } else if (!activeMedia.playing && !v.paused) {
          v.pause();
        }
      } catch (e) { /* ignore autoplay errors */ }
    };

    if (isRemoteUpdate.current) {
      handleSync();
      const t = setTimeout(() => { isRemoteUpdate.current = false; }, 1200);
      return () => clearTimeout(t);
    }
  }, [activeMedia, getControlledMedia]);

  // ─── Local playback state tracking ───
  useEffect(() => {
    const v = getControlledMedia();
    if (!v) return;

    const updateState = () => {
      setLocalPlaybackState({
        playing: !v.paused,
        time: v.currentTime || 0,
        duration: v.duration || 0
      });
      setVideoDuration(v.duration || 0);
    };

    v.addEventListener("play", updateState);
    v.addEventListener("pause", updateState);
    v.addEventListener("timeupdate", updateState);
    v.addEventListener("loadedmetadata", updateState);

    return () => {
      v.removeEventListener("play", updateState);
      v.removeEventListener("pause", updateState);
      v.removeEventListener("timeupdate", updateState);
      v.removeEventListener("loadedmetadata", updateState);
    };
  }, [getControlledMedia, activeMedia]);

  // ─── Heartbeat Sync (admin only) ───
  useEffect(() => {
    if (!isAdmin || !activeMedia || !activeMedia.playing) return;
    
    const v = getControlledMedia();
    if (!v) return;

    const interval = setInterval(() => {
      if (!isRemoteUpdate.current && v.currentTime) {
        socket.emit("syncMedia", {
          ...activeMedia,
          time: v.currentTime,
          heartbeat: true
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isAdmin, activeMedia, socket, getControlledMedia]);

  // ─── YouTube Player Init ───
  useEffect(() => {
    if (!activeMedia || !activeMedia.url || !activeMedia.url.includes("youtu")) {
      ytPlayerRef.current = null;
      return;
    }

    const videoId = activeMedia.url.includes("youtu.be")
      ? activeMedia.url.split("/").pop()
      : activeMedia.url.split("v=")[1]?.split("&")[0];

    if (!videoId) return;

    let player;

    const initPlayer = () => {
      if (player || !window.YT) return;
      try {
        player = new window.YT.Player("youtube-sync-player", {
          videoId: videoId,
          playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              ytPlayerRef.current = player;
              if (activeMedia.playing) player.playVideo();
              else player.pauseVideo();
              player.seekTo(activeMedia.time || 0, true);
            },
            onStateChange: (event) => {
              if (!isAdmin || isRemoteUpdate.current) return;
              const state = event.data;
              if (state === 1) {
                socket.emit("syncMedia", { url: activeMedia.url, playing: true, time: player.getCurrentTime(), sender: userName });
              } else if (state === 2) {
                socket.emit("syncMedia", { url: activeMedia.url, playing: false, time: player.getCurrentTime(), sender: userName });
              }
            }
          }
        });
      } catch (e) {
        console.error("YouTube player error:", e);
      }
    };

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      window.onYouTubeIframeAPIReady = initPlayer;
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
    } else {
      const checkYT = setInterval(() => {
        if (window.YT && window.YT.Player) { clearInterval(checkYT); initPlayer(); }
      }, 100);
    }

    return () => {
      if (player && typeof player.destroy === "function") player.destroy();
      ytPlayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMedia?.url, isAdmin, socket, userName]);

  // ─── YouTube Sync on Remote Update ───
  useEffect(() => {
    const player = ytPlayerRef.current;
    if (!player || !activeMedia || !activeMedia.url || !activeMedia.url.includes("youtu") || !player.seekTo) return;

    if (isRemoteUpdate.current) {
      try {
        if (activeMedia.playing) {
          if (player.getPlayerState() !== 1) player.playVideo();
        } else {
          if (player.getPlayerState() !== 2) player.pauseVideo();
        }
        const playerTime = player.getCurrentTime();
        if (Math.abs(playerTime - activeMedia.time) > 2.5) {
          player.seekTo(activeMedia.time, true);
        }
      } catch (e) {
        console.error("YouTube sync error:", e);
      }
    }
  }, [activeMedia]);

  // ─── YouTube Heartbeat ───
  useEffect(() => {
    if (!isAdmin || !activeMedia || !activeMedia.url || !activeMedia.url.includes("youtu") || !activeMedia.playing) return;
    const interval = setInterval(() => {
      try {
        if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime && !isRemoteUpdate.current) {
          socket.emit("syncMedia", { ...activeMedia, time: ytPlayerRef.current.getCurrentTime(), heartbeat: true });
        }
      } catch (e) {
        // Silent fail
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isAdmin, activeMedia, socket]);

  // ─── Re-attach video ref when video is toggled back on ───
  useEffect(() => {
    if (!isVideoOff && myVideoRef.current && localStreamRef.current) {
      if (myVideoRef.current.srcObject !== localStreamRef.current) {
        myVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  }, [isVideoOff]);

  /* ═══════════════════════════════ ACTIONS ═══════════════════════════════ */

  const toggleMute = useCallback(() => {
    if (localStream) {
      const nextMuted = !isMuted;
      localStream.getAudioTracks()[0].enabled = !nextMuted;
      setIsMuted(nextMuted);
      socket.emit("media-state-change", { peerId: myPeerId, isMuted: nextMuted, isVideoOff });
    }
  }, [localStream, isMuted, isVideoOff, myPeerId, socket]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const nextVideoOff = !isVideoOff;
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !nextVideoOff;
        setIsVideoOff(nextVideoOff);
        socket.emit("media-state-change", { peerId: myPeerId, isMuted, isVideoOff: nextVideoOff });
        
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = localStream;
        }
      }
    }
  }, [localStream, isVideoOff, isMuted, myPeerId, socket]);

  const handleLeaveCall = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (streamMediaSource) {
      stopLocalFileBroadcast(streamMediaSource);
    }
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, streamMediaSource]);

  const startLocalFileBroadcast = async (file) => {
    try {
      const videoElement = document.createElement("video");
      broadcastVideoRef.current = videoElement;
      videoElement.src = URL.createObjectURL(file);
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.autoplay = true;

      await new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = resolve;
        videoElement.onerror = reject;
        setTimeout(reject, 10000);
      });
      await videoElement.play();

      let videoStream;
      if (videoElement.captureStream) {
        videoStream = videoElement.captureStream(24);
      } else if (videoElement.mozCaptureStream) {
        videoStream = videoElement.mozCaptureStream(24);
      } else {
        throw new Error("Video stream capture not supported in this browser.");
      }

      const videoTrack = videoStream.getVideoTracks()[0];
      const videoAudioTrack = videoStream.getAudioTracks()[0];

      if (!videoTrack) throw new Error("No video track found in the file.");

      let mixedAudioTrack = null;
      let audioCtx = null;

      if (videoAudioTrack && localStream) {
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const dest = audioCtx.createMediaStreamDestination();
          const micStream = new MediaStream(localStream.getAudioTracks());
          const micSource = audioCtx.createMediaStreamSource(micStream);
          micSource.connect(dest);
          const fileStream = new MediaStream([videoAudioTrack]);
          const fileSource = audioCtx.createMediaStreamSource(fileStream);
          fileSource.connect(dest);
          mixedAudioTrack = dest.stream.getAudioTracks()[0];
        } catch (e) {
          console.warn("Audio mixing failed:", e);
        }
      } else if (videoAudioTrack) {
        mixedAudioTrack = videoAudioTrack;
      }

      const mediaSourceObj = {
        videoElement,
        audioContext: audioCtx,
        localUrl: videoElement.src,
        originalVideoTrack: localStream.getVideoTracks()[0],
        originalAudioTrack: localStream.getAudioTracks()[0]
      };
      setStreamMediaSource(mediaSourceObj);

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = videoStream;
      }

      Object.values(peers.current).forEach(async (call) => {
        try {
          if (call.peerConnection) {
            const senders = call.peerConnection.getSenders();
            const videoSender = senders.find(s => s.track?.kind === "video");
            if (videoSender) await videoSender.replaceTrack(videoTrack);
            if (mixedAudioTrack) {
              const audioSender = senders.find(s => s.track?.kind === "audio");
              if (audioSender) await audioSender.replaceTrack(mixedAudioTrack);
            }
          }
        } catch (e) {
          console.warn("Track replacement error:", e);
        }
      });

      socket.emit("screenshare-started", { roomId, peerId: myPeerId });
      socket.emit("media-file-shared", { name: file.name, type: file.type, sharerName: userName });
      setFocusedPeerId("local");
      setActiveMedia({ url: null, playing: true, time: 0, type: "local_stream", name: file.name });

      videoElement.onended = () => stopLocalFileBroadcast(mediaSourceObj);
      
      toast.success(`Now broadcasting: ${file.name}`);
    } catch (e) {
      console.error("Broadcast error:", e);
      toast.error(`Local file streaming failed: ${e.message}`);
    }
  };

  const stopLocalFileBroadcast = async (overrideSourceObj = null) => {
    const sourceObj = overrideSourceObj || streamMediaSource;
    if (!sourceObj) return;

    try {
      const originalVid = sourceObj.originalVideoTrack;
      const originalAud = sourceObj.originalAudioTrack;

      Object.values(peers.current).forEach(async (call) => {
        try {
          if (call.peerConnection) {
            const senders = call.peerConnection.getSenders();
            const videoSender = senders.find(s => s.track?.kind === "video");
            if (videoSender && originalVid) await videoSender.replaceTrack(originalVid);
            const audioSender = senders.find(s => s.track?.kind === "audio");
            if (audioSender && originalAud) await audioSender.replaceTrack(originalAud);
          }
        } catch (e) {
          console.warn("Track restoration error:", e);
        }
      });

      if (myVideoRef.current && localStream) {
        myVideoRef.current.srcObject = localStream;
      }

      if (sourceObj.videoElement) {
        sourceObj.videoElement.pause();
        sourceObj.videoElement.removeAttribute("src");
        sourceObj.videoElement.load();
      }
      if (sourceObj.localUrl) URL.revokeObjectURL(sourceObj.localUrl);
      if (sourceObj.audioContext) sourceObj.audioContext.close();

      setStreamMediaSource(null);
      setActiveMedia(null);
      socket.emit("syncMedia", null);
      socket.emit("screenshare-stopped", { peerId: myPeerId });
      socket.emit("media-file-stopped");
      setFocusedPeerId(null);
      setLayoutMode("grid");
      
      toast.info("Broadcast stopped");
    } catch (err) {
      console.error("Error stopping broadcast:", err);
      toast.error("Error stopping broadcast");
    }
  };

  const handleLocalFile = (e) => {
    const file = e.target.files[0];
    if (file) startLocalFileBroadcast(file);
  };

  const handleUrlBroadcast = () => {
    if (!broadcastUrl) return;
    setActiveMedia({ url: broadcastUrl, playing: true, time: 0, type: "url", name: "Shared Media" });
    socket.emit("syncMedia", { url: broadcastUrl, playing: true, time: 0, type: "url", name: "Shared Media" });
    setShowUrlInput(false);
    setBroadcastUrl("");
    setLayoutMode("stage");
    toast.success("Media broadcast started");
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMediaAction = (action) => {
    const v = getControlledMedia();
    if (!v || isRemoteUpdate.current) return;

    const data = {
      url: activeMedia?.url,
      playing: action === "play" || (action === "seek" && !v.paused),
      time: v.currentTime || 0,
      sender: userName
    };
    setActiveMedia(data);
    socket.emit("syncMedia", data);
  };

  const handleSeek = (value) => {
    const v = getControlledMedia();
    if (!v || isRemoteUpdate.current) return;
    try {
      v.currentTime = parseFloat(value);
      handleMediaAction("seek");
    } catch (e) {
      // Silent fail
    }
  };

  const handleSpeedChange = (speed) => {
    const v = getControlledMedia();
    if (!v) return;
    try {
      v.playbackRate = parseFloat(speed);
      setPlaybackSpeed(parseFloat(speed));
    } catch (e) {
      // Silent fail
    }
  };

  const handleSkip = (seconds) => {
    const v = getControlledMedia();
    if (!v || isRemoteUpdate.current) return;
    try {
      v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seconds));
      handleMediaAction("seek");
    } catch (e) {
      // Silent fail
    }
  };

  const startScreenShare = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast.error("Screen sharing is unavailable in this browser.");
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always", width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 } },
        audio: true
      });

      const videoTrack = screenStream.getVideoTracks()[0];
      if ("contentHint" in videoTrack) videoTrack.contentHint = "detail";

      if (myVideoRef.current) myVideoRef.current.srcObject = screenStream;

      Object.values(peers.current).forEach(async (call) => {
        try {
          if (call.peerConnection) {
            const sender = call.peerConnection.getSenders().find(s => s.track?.kind === "video");
            if (sender) {
              await sender.replaceTrack(videoTrack);
              const params = sender.getParameters();
              if (!params.encodings) params.encodings = [{}];
              params.encodings[0].maxBitrate = 2500000;
              sender.setParameters(params).catch(() => {});
            }
          }
        } catch (e) {
          console.warn("Screen share track error:", e);
        }
      });

      setFocusedPeerId("local");
      socket.emit("screenshare-started", { roomId, peerId: myPeerId });
      setLayoutMode("stage");
      toast.info("Screen sharing started");

      videoTrack.onended = () => stopScreenShare();
    } catch (err) {
      toast.error(err.name === "NotAllowedError" ? "Screen sharing was cancelled." : "Unable to start screen sharing.");
    }
  };

  const stopScreenShare = () => {
    try {
      if (!localStream) return;
      const videoTrack = localStream.getVideoTracks()[0];
      if (myVideoRef.current && localStream) {
        myVideoRef.current.srcObject = localStream;
      }

      Object.values(peers.current).forEach(async (call) => {
        try {
          if (call.peerConnection) {
            const sender = call.peerConnection.getSenders().find(s => s.track?.kind === "video");
            if (sender && videoTrack) await sender.replaceTrack(videoTrack);
          }
        } catch (e) {
          console.warn("Screen share stop error:", e);
        }
      });

      socket.emit("screenshare-stopped", { peerId: myPeerId });
      setFocusedPeerId(null);
      setLayoutMode("grid");
      toast.info("Screen sharing stopped");
    } catch (err) {
      console.error("Error stopping screen share:", err);
    }
  };

  const flipCamera = async () => {
    try {
      const newFacing = isFrontCamera ? "environment" : "user";
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (myVideoRef.current) myVideoRef.current.srcObject = newStream;
      setLocalStream(newStream);
      localStreamRef.current = newStream;

      Object.values(peers.current).forEach(call => {
        try {
          if (call.peerConnection) {
            const sender = call.peerConnection.getSenders().find(s => s.track?.kind === "video");
            if (sender) sender.replaceTrack(newVideoTrack);
          }
        } catch (e) {
          console.warn("Camera flip track error:", e);
        }
      });

      setIsFrontCamera(!isFrontCamera);
      toast.success(`Switched to ${isFrontCamera ? 'back' : 'front'} camera`);
    } catch (err) {
      toast.error("Unable to switch camera.");
    }
  };

  const toggleRecording = async () => {
    if (!isAdmin) {
      toast.error("Only the room admin can record this meeting.");
      return;
    }
    if (isRecording) {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      setIsRecording(false);
      toast.info("Recording stopped");
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast.error("Screen recording is not supported on your browser.");
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: true });

      const tracks = [...displayStream.getVideoTracks()];
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();

      if (displayStream.getAudioTracks().length > 0) {
        const displayAudioSource = audioContext.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks()));
        displayAudioSource.connect(destination);
      }

      if (localStream && localStream.getAudioTracks().length > 0) {
        const micAudioSource = audioContext.createMediaStreamSource(new MediaStream(localStream.getAudioTracks()));
        micAudioSource.connect(destination);
      }

      const mixedStream = new MediaStream([...tracks, ...destination.stream.getTracks()]);

      let options = {};
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) options = { mimeType: "video/webm;codecs=vp9,opus" };
      else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) options = { mimeType: "video/webm;codecs=vp8,opus" };
      else if (MediaRecorder.isTypeSupported("video/webm")) options = { mimeType: "video/webm" };
      else if (MediaRecorder.isTypeSupported("video/mp4")) options = { mimeType: "video/mp4" };

      const rec = new MediaRecorder(mixedStream, options);
      recordedChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunks.current.push(e.data); };
      rec.onstop = () => {
        try {
          const ext = options.mimeType && options.mimeType.includes("mp4") ? "mp4" : "webm";
          const blob = new Blob(recordedChunks.current, { type: options.mimeType || "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `Meeting_Recording_${Date.now()}.${ext}`; a.click();
          displayStream.getTracks().forEach(track => track.stop());
          if (audioContext.state !== "closed") audioContext.close();
          setIsRecording(false);
          toast.success("Recording saved");
        } catch (e) {
          toast.error("Error saving recording");
        }
      };

      displayStream.getVideoTracks()[0].onended = () => {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      };

      rec.start(1000);
      recorderRef.current = rec;
      setIsRecording(true);
      toast.info("⏺ Recording Started");
    } catch (err) {
      toast.error("Recording canceled or unsupported.");
    }
  };

  const sendReaction = (emoji) => {
    socket.emit("reaction", emoji);
    const id = Date.now() + Math.random();
    setReactions(p => [...p, { id, emoji, x: Math.random() * 80 + 10 }]);
    setTimeout(() => setReactions(p => p.filter(r => r.id !== id)), 3000);
  };

  const togglePlayPause = () => {
    const v = getControlledMedia();
    if (!v || isRemoteUpdate.current) return;
    
    try {
      if (v.paused) {
        v.play();
        handleMediaAction("play");
      } else {
        v.pause();
        handleMediaAction("pause");
      }
    } catch (e) {
      // Silent fail
    }
  };

  /* ═══════════════════════════════ COMPUTED ═══════════════════════════════ */
  const remoteEntries = Object.entries(remoteStreams);
  const isStageMode = layoutMode === "stage" || !!activeMedia || focusedPeerId !== null || !!remoteFileBroadcast;
  const totalParticipantsCount = 1 + remoteEntries.length;

  const allParticipants = [
    { id: "local", name: userName, isMuted, isVideoOff },
    ...remoteEntries.map(([id, info]) => ({
      id,
      name: info.name || "Participant",
      isMuted: participantStates[id]?.isMuted || false,
      isVideoOff: participantStates[id]?.isVideoOff || false
    }))
  ];

  const handleTileClick = (peerId) => {
    setFocusedPeerId(peerId);
    setLayoutMode("stage");
  };

  const isLocalBroadcasting = !!streamMediaSource || activeMedia?.type === "local_stream";

  /* ═══════════════════════════════ RENDER HELPERS ═══════════════════════════════ */

  const renderParticipantTiles = () => {
    const tiles = [];

    // Local user tile
    const isLocalActive = focusedPeerId === "local" || (!focusedPeerId && !activeMedia);
    tiles.push(
      <ParticipantTile
        key="local"
        $isTalking={speakingPeers.local}
        $isActive={isLocalActive}
        onClick={() => handleTileClick("local")}
      >
        {isVideoOff || isLocalBroadcasting ? (
          <div style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'rgba(74, 158, 255, 0.05)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 'clamp(40px, 6vw, 60px)', 
                height: 'clamp(40px, 6vw, 60px)',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4a9eff, #6c5ce7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'clamp(1rem, 2vw, 1.5rem)',
                fontWeight: 700,
                color: 'white',
                margin: '0 auto'
              }}>
                {getInitials(userName)}
              </div>
              {isLocalBroadcasting && (
                <div style={{ 
                  marginTop: '4px', 
                  fontSize: 'clamp(0.4rem, 0.6vw, 0.6rem)',
                  color: '#4a9eff',
                  fontWeight: 600
                }}>
                  📡 Broadcasting
                </div>
              )}
            </div>
          </div>
        ) : (
          <video ref={myVideoRef} autoPlay muted playsInline />
        )}
        <NameTag>
          {userName} (You)
          {isMuted && <span style={{ color: '#ff4757' }}>🔇</span>}
          {isLocalBroadcasting && <span style={{ color: '#4a9eff' }}>📡</span>}
        </NameTag>
        {isMuted && <StatusBadge $type="muted"><FaMicrophoneSlash /></StatusBadge>}
        {isVideoOff && <StatusBadge $type="video"><FaVideoSlash /></StatusBadge>}
        {isLocalBroadcasting && <StatusBadge $type="broadcast" style={{ background: '#4a9eff' }}><FaDesktop /></StatusBadge>}
      </ParticipantTile>
    );

    // Remote user tiles
    Object.entries(remoteStreams).forEach(([id, info]) => {
      const peerState = participantStates[id] || {};
      const peerVideoOff = peerState.isVideoOff;
      const peerMuted = peerState.isMuted;
      const isActive = focusedPeerId === id;

      tiles.push(
        <ParticipantTile
          key={id}
          $isTalking={speakingPeers[id]}
          $isActive={isActive}
          onClick={() => handleTileClick(id)}
        >
          {peerVideoOff ? (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ 
                width: 'clamp(40px, 6vw, 60px)', 
                height: 'clamp(40px, 6vw, 60px)',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'clamp(1rem, 2vw, 1.5rem)',
                fontWeight: 700,
                color: 'white'
              }}>
                {getInitials(info.name)}
              </div>
            </div>
          ) : (
            <video
              autoPlay
              playsInline
              ref={el => {
                if (el && info.stream && el.srcObject !== info.stream) {
                  el.srcObject = info.stream;
                }
              }}
            />
          )}
          <NameTag>
            {info.name}
            {peerMuted && <span style={{ color: '#ff4757' }}>🔇</span>}
          </NameTag>
          {peerMuted && <StatusBadge $type="muted"><FaMicrophoneSlash /></StatusBadge>}
          {peerVideoOff && <StatusBadge $type="video"><FaVideoSlash /></StatusBadge>}
        </ParticipantTile>
      );
    });

    return tiles;
  };

  const renderMainContent = () => {
    // Show connecting state
    if (isConnecting) {
      return (
        <Overlay>
          <ConnectingSpinner />
          <h3>Connecting to meeting...</h3>
          <p>Setting up your camera and microphone</p>
        </Overlay>
      );
    }

    // Show focused peer
    if (focusedPeerId) {
      const isLocal = focusedPeerId === "local";
      const focusedIsVideoOff = isLocal ? isVideoOff : (participantStates[focusedPeerId]?.isVideoOff);
      const focusedName = isLocal ? userName : (remoteStreams[focusedPeerId]?.name || "Participant");
      const focusedIsMuted = isLocal ? isMuted : (participantStates[focusedPeerId]?.isMuted);
      const focusedIsTalking = speakingPeers[focusedPeerId];
      const targetStream = isLocal ? localStream : remoteStreams[focusedPeerId]?.stream;

      return (
        <>
          {focusedIsVideoOff ? (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ 
                width: 'clamp(80px, 15vw, 150px)', 
                height: 'clamp(80px, 15vw, 150px)',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4a9eff, #6c5ce7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'clamp(2rem, 5vw, 4rem)',
                fontWeight: 700,
                color: 'white'
              }}>
                {getInitials(focusedName)}
              </div>
              <div style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.2rem)', fontWeight: 600 }}>
                {focusedName} {isLocal && '(You)'}
              </div>
              {focusedIsMuted && <div style={{ color: '#ff4757', fontSize: '0.9rem' }}>🔇 Muted</div>}
            </div>
          ) : (
            <video
              autoPlay
              playsInline
              muted={isLocal}
              ref={el => {
                if (el && targetStream && el.srcObject !== targetStream) {
                  el.srcObject = targetStream;
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
          <div style={{ 
            position: 'absolute', 
            top: 16, 
            left: 16, 
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            padding: '6px 16px',
            borderRadius: '12px',
            fontSize: 'clamp(0.6rem, 1vw, 0.8rem)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 10
          }}>
            <span>Viewing: {focusedName}</span>
            <button 
              onClick={() => { setFocusedPeerId(null); setLayoutMode("grid"); }}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'white', 
                cursor: 'pointer',
                fontSize: '1rem',
                opacity: 0.6,
                padding: '0 4px'
              }}
            >
              ✕
            </button>
          </div>
          {focusedIsTalking && (
            <div style={{ 
              position: 'absolute', 
              bottom: 20, 
              left: '50%', 
              transform: 'translateX(-50%)',
              background: 'rgba(46, 213, 115, 0.2)',
              border: '1px solid rgba(46, 213, 115, 0.3)',
              padding: '4px 16px',
              borderRadius: '20px',
              fontSize: 'clamp(0.6rem, 0.9vw, 0.75rem)',
              color: '#2ed573',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              animation: `${breathe} 1.5s ease-in-out infinite`
            }}>
              <span style={{ width: 8, height: 8, background: '#2ed573', borderRadius: '50%', display: 'inline-block' }} />
              Speaking
            </div>
          )}
        </>
      );
    }

    // Show active media (broadcast)
    if (activeMedia) {
      return (
        <>
          {activeMedia.url?.includes("youtu") ? (
            <div id="youtube-sync-player" style={{ width: '100%', height: '100%' }} />
          ) : activeMedia.type === "local_stream" && !isAdmin ? (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '20px',
              gap: '12px'
            }}>
              <FaDesktop size={48} style={{ opacity: 0.3 }} />
              <div style={{ 
                fontSize: 'clamp(0.8rem, 1.5vw, 1rem)',
                fontWeight: 600,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.3), #ffffff, rgba(255,255,255,0.3))',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: `${shimmer} 2s linear infinite`,
                textAlign: 'center'
              }}>
                {remoteFileBroadcast?.sharerName || "Admin"} is streaming: {remoteFileBroadcast?.name || activeMedia.name || "Media"}
              </div>
              <span style={{ fontSize: 'clamp(0.6rem, 1vw, 0.8rem)', opacity: 0.4, textAlign: 'center' }}>
                Audio and video are streamed live via the call
              </span>
            </div>
          ) : (
            <>
              <video
                ref={mediaRef}
                src={activeMedia.url}
                playsInline
                style={{ width: '100%', height: '100%' }}
                onPlay={() => handleMediaAction("play")}
                onPause={() => handleMediaAction("pause")}
                onSeeked={() => handleMediaAction("seek")}
                onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
              />
              <MediaControlsOverlay $visible={showControls}>
                <MediaControlsRow>
                  <MediaButton onClick={() => handleSkip(-30)}>
                    <FaStepBackward /> -30s
                  </MediaButton>
                  <MediaButton onClick={() => handleSkip(-10)}>
                    <FaStepBackward style={{ fontSize: '0.7rem' }} /> -10s
                  </MediaButton>
                  <MediaButton onClick={togglePlayPause} style={{ fontSize: 'clamp(1rem, 1.5vw, 1.2rem)', minWidth: '40px' }}>
                    {localPlaybackState.playing ? <FaPause /> : <FaPlay />}
                  </MediaButton>
                  <MediaButton onClick={() => handleSkip(10)}>
                    +10s <FaStepForward style={{ fontSize: '0.7rem' }} />
                  </MediaButton>
                  <MediaButton onClick={() => handleSkip(30)}>
                    +30s <FaStepForward />
                  </MediaButton>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '100px' }}>
                    <span style={{ fontSize: 'clamp(0.5rem, 0.7vw, 0.65rem)', opacity: 0.7, whiteSpace: 'nowrap' }}>
                      {formatDuration(localPlaybackState.time)} / {formatDuration(videoDuration)}
                    </span>
                    <SeekBar
                      type="range"
                      min="0"
                      max={videoDuration || 1}
                      step="0.1"
                      value={localPlaybackState.time || 0}
                      onChange={(e) => handleSeek(e.target.value)}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FaTachometerAlt style={{ fontSize: '0.7rem', opacity: 0.5 }} />
                    <SpeedSelect
                      value={playbackSpeed}
                      onChange={(e) => handleSpeedChange(e.target.value)}
                    >
                      <option value="0.5">0.5x</option>
                      <option value="0.75">0.75x</option>
                      <option value="1">1x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2x</option>
                    </SpeedSelect>
                  </div>
                  
                  {isAdmin && (
                    <MediaButton
                      onClick={() => {
                        if (activeMedia.type === "local_stream") stopLocalFileBroadcast();
                        else { setActiveMedia(null); socket.emit("syncMedia", null); }
                      }}
                      style={{ background: 'rgba(255, 71, 87, 0.2)', borderColor: 'rgba(255, 71, 87, 0.3)', color: '#ff4757' }}
                    >
                      <FaStop /> Stop
                    </MediaButton>
                  )}
                </MediaControlsRow>
              </MediaControlsOverlay>
            </>
          )}
          <div style={{ 
            position: 'absolute', 
            top: 16, 
            left: 16, 
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            padding: '6px 16px',
            borderRadius: '12px',
            fontSize: 'clamp(0.6rem, 0.9vw, 0.75rem)',
            zIndex: 10
          }}>
            📺 {activeMedia.name || "Shared Media"}
          </div>
        </>
      );
    }

    // Show remote file broadcast overlay
    if (remoteFileBroadcast && !isAdmin) {
      return (
        <div style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px',
          gap: '12px'
        }}>
          <FaDesktop size={48} style={{ opacity: 0.3 }} />
          <div style={{ 
            fontSize: 'clamp(0.8rem, 1.5vw, 1rem)',
            fontWeight: 600,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.3), #ffffff, rgba(255,255,255,0.3))',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: `${shimmer} 2s linear infinite`,
            textAlign: 'center'
          }}>
            {remoteFileBroadcast.sharerName || "Admin"} is streaming: {remoteFileBroadcast.name || "Media"}
          </div>
          <span style={{ fontSize: 'clamp(0.6rem, 1vw, 0.8rem)', opacity: 0.4, textAlign: 'center' }}>
            Audio and video are streamed live via the call
          </span>
        </div>
      );
    }

    // Empty state - show all participants in grid
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(totalParticipantsCount, 4)}, 1fr)`,
        gap: '12px',
        padding: '12px',
        alignContent: 'center'
      }}>
        {renderParticipantTiles()}
      </div>
    );
  };

  /* ═══════════════════════════════ MAIN RENDER ═══════════════════════════════ */
  return (
    <StyleSheetManager shouldForwardProp={(prop) => !prop.startsWith('$')}>
      <MeetingContainer ref={containerRef}>
        <GradientBackground />
        
        {/* Header */}
        <MeetingHeader>
          <HeaderLeft>
            <Logo>
              <span className="logo-dot" />
              <span>Meet</span>
            </Logo>
            <StatusIndicator $status={networkStatus}>
              {networkStatus === 'good' && <FaWifi size={12} />}
              {networkStatus === 'poor' && <FaSignal size={12} />}
              {networkStatus === 'fallback' && <FaSignal size={12} />}
              {networkStatus === 'good' ? 'Excellent' : networkStatus === 'poor' ? 'Weak' : 'Low BW'}
            </StatusIndicator>
            <span style={{ fontSize: 'clamp(0.6rem, 0.9vw, 0.75rem)', opacity: 0.5 }}>
              {formatDuration(callDuration)}
            </span>
          </HeaderLeft>
          <HeaderRight>
            <ControlButton
              style={{ width: 'clamp(32px, 4vw, 38px)', height: 'clamp(32px, 4vw, 38px)', fontSize: '0.8rem' }}
              onClick={() => setShowParticipants(!showParticipants)}
              title="Participants"
            >
              <FaUsers />
              {totalParticipantsCount > 1 && <span className="badge">{totalParticipantsCount}</span>}
            </ControlButton>
            <ControlButton
              style={{ width: 'clamp(32px, 4vw, 38px)', height: 'clamp(32px, 4vw, 38px)', fontSize: '0.8rem' }}
              onClick={() => {
                if (layoutMode === "grid") {
                  setLayoutMode("stage");
                  setFocusedPeerId(remoteEntries.length > 0 ? remoteEntries[0][0] : "local");
                } else {
                  setLayoutMode("grid");
                  setFocusedPeerId(null);
                }
              }}
              title={layoutMode === "grid" ? "Stage View" : "Grid View"}
            >
              {layoutMode === "grid" ? <FaThLarge /> : <FaDesktop />}
            </ControlButton>
            <ControlButton
              style={{ width: 'clamp(32px, 4vw, 38px)', height: 'clamp(32px, 4vw, 38px)', fontSize: '0.8rem' }}
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <FaCompress /> : <FaExpand />}
            </ControlButton>
            <ControlButton
              $primary
              style={{ width: 'clamp(32px, 4vw, 38px)', height: 'clamp(32px, 4vw, 38px)', fontSize: '0.8rem' }}
              onClick={handleLeaveCall}
              title="Leave Meeting"
            >
              <FaPhoneSlash />
            </ControlButton>
          </HeaderRight>
        </MeetingHeader>

        {/* Content Area */}
        <ContentArea>
          <MainVideoArea>
            {renderMainContent()}
            
            {/* Reactions */}
            {reactions.map(r => (
              <ReactionFloat key={r.id} $x={r.x}>
                {r.emoji}
              </ReactionFloat>
            ))}
            
            {/* Sync Indicator */}
            {isSyncing && !isConnecting && (
              <SyncIndicator>
                <FaSync /> Syncing...
              </SyncIndicator>
            )}
          </MainVideoArea>

          {/* Participant Sidebar */}
          {!isStageMode && (
            <ParticipantSidebar>
              {renderParticipantTiles()}
            </ParticipantSidebar>
          )}
        </ContentArea>

        {/* Controls Bar */}
        <ControlsBar>
          <ControlButton
            $active={isMuted}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </ControlButton>
          
          <ControlButton
            $active={isVideoOff}
            onClick={toggleVideo}
            title={isVideoOff ? "Start Video" : "Stop Video"}
          >
            {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
          </ControlButton>
          
          <ControlButton
            onClick={flipCamera}
            title="Flip Camera"
          >
            <FaExchangeAlt />
          </ControlButton>
          
          <ControlButton
            onClick={startScreenShare}
            title="Share Screen"
          >
            <FaDesktop />
          </ControlButton>

          <ControlDivider />

          {isAdmin && (
            <>
              {streamMediaSource ? (
                <ControlButton
                  onClick={() => stopLocalFileBroadcast()}
                  style={{ background: 'rgba(255, 71, 87, 0.2)', borderColor: 'rgba(255, 71, 87, 0.3)', color: '#ff4757' }}
                  title="Stop Broadcast"
                >
                  <FaStop />
                </ControlButton>
              ) : (
                <label>
                  <ControlButton as="span" title="Share File">
                    <FaFolderOpen />
                    <input type="file" hidden accept="video/*,audio/*" onChange={handleLocalFile} />
                  </ControlButton>
                </label>
              )}

              <ControlButton
                onClick={() => setShowUrlInput(!showUrlInput)}
                title="Share URL"
                style={showUrlInput ? { background: 'rgba(74, 158, 255, 0.2)', borderColor: 'rgba(74, 158, 255, 0.3)' } : {}}
              >
                <FaLink />
              </ControlButton>

              <ControlButton
                $active={isRecording}
                onClick={toggleRecording}
                title={isRecording ? "Stop Recording" : "Record"}
                style={isRecording ? { background: 'rgba(255, 71, 87, 0.2)', borderColor: 'rgba(255, 71, 87, 0.3)', color: '#ff4757' } : {}}
              >
                <FaRecordVinyl />
              </ControlButton>

              <ControlDivider />
            </>
          )}

          <ControlButton
            onClick={() => sendReaction("👋")}
            title="Raise Hand"
          >
            <FaHandPaper />
          </ControlButton>
          
          {["❤️", "👏", "😂"].map(emoji => (
            <ControlButton
              key={emoji}
              onClick={() => sendReaction(emoji)}
              title={`Send ${emoji}`}
              style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1.1rem)' }}
            >
              {emoji}
            </ControlButton>
          ))}
        </ControlsBar>

        {/* URL Input Overlay */}
        {showUrlInput && (
          <UrlInputOverlay>
            <input
              type="text"
              placeholder="Paste YouTube or direct MP4 URL..."
              value={broadcastUrl}
              onChange={(e) => setBroadcastUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrlBroadcast()}
            />
            <button onClick={handleUrlBroadcast}>
              Broadcast
            </button>
          </UrlInputOverlay>
        )}

        {/* Participant Popover */}
        {showParticipants && (
          <div style={{
            position: 'absolute',
            top: '70px',
            right: '24px',
            background: 'rgba(20, 20, 35, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            minWidth: '220px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 100,
            animation: `${slideUp} 0.2s ease-out`,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>Participants ({totalParticipantsCount})</span>
              <button onClick={() => setShowParticipants(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}>✕</button>
            </div>
            {allParticipants.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', borderRadius: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4a9eff, #6c5ce7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {getInitials(p.name)}
                </div>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                  {p.name}{p.id === 'local' ? ' (You)' : ''}
                </span>
                {p.isMuted && <FaMicrophoneSlash size={12} style={{ color: '#ff4757', flexShrink: 0 }} />}
                {p.isVideoOff && <FaVideoSlash size={12} style={{ color: '#ff4757', flexShrink: 0 }} />}
                {speakingPeers[p.id] && <span style={{ color: '#2ed573', fontSize: '0.6rem', fontWeight: 600 }}>🔊</span>}
              </div>
            ))}
          </div>
        )}
      </MeetingContainer>
    </StyleSheetManager>
  );
}