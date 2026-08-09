import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash, FaSync, FaDesktop, FaFolderOpen, FaRecordVinyl, FaCompress, FaExpand, FaWindowMinimize, FaExchangeAlt, FaLink, FaThLarge, FaStop, FaUsers, FaTimes, FaHandPaper } from "react-icons/fa";
import { Peer } from "peerjs";
import { toast } from "react-toastify";

/* ═══════════════════════════════ ANIMATIONS ═══════════════════════════════ */
const fadeIn = keyframes`from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); }`;
const slideUp = keyframes`from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); }`;
// eslint-disable-next-line no-unused-vars
const floatUp = keyframes`0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-700px) scale(2.5); opacity: 0; }`;
const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
// eslint-disable-next-line no-unused-vars
const pulse = keyframes`0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(255, 71, 87, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }`;
const shimmer = keyframes`0% { background-position: -200% 0; } 100% { background-position: 200% 0; }`;
const tileEnter = keyframes`from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); }`;

const MeetingOverlay = styled.div`
  position: fixed;
  inset: 40px;
  z-index: 10005;
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  display: flex;
  flex-direction: column;
  color: var(--chakra-colors-textPrimary);
  padding: 24px;
  overflow: hidden;
  border-radius: 32px;
  border: 1px solid var(--chakra-colors-border);
  box-shadow:
    0 50px 100px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 var(--chakra-colors-borderSubtle);
  animation: ${fadeIn} 0.35s ease-out;

  ${p => p.$minimized && `
    inset: auto 18px 18px auto;
    width: min(336px, calc(100vw - 32px));
    height: 218px;
    min-height: 0;
    padding: 10px;
    border-radius: 20px;
    cursor: pointer;
    background: var(--chakra-colors-surface);
  `}

  @media (max-width: 768px) {
    ${p => p.$minimized ? `
      inset: auto 12px calc(12px + env(safe-area-inset-bottom)) auto;
      width: min(300px, calc(100vw - 24px));
      height: 176px;
      padding: 8px;
      border-radius: 18px;
      background: var(--chakra-colors-surface);
    ` : `
      inset: 0;
      border-radius: 0;
      padding: 12px 10px;
      background: var(--chakra-colors-bg);
    `}
  }
`;

const MeetingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  width: 100%;
  height: 54px;
  flex-shrink: 0;
  padding: 0 12px;
  ${p => p.$minimized && `height: 38px; margin-bottom: 8px; padding: 0 4px;`}
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

const HeaderRight = styled.div`
  display: flex;
  gap: 4px;
  background: var(--chakra-colors-badgeBg);
  padding: 4px;
  border-radius: 14px;
  border: 1px solid var(--chakra-colors-badgeBorder);
  align-items: center;
`;

const ContentLayout = styled.div`
  display: flex;
  flex: 1;
  gap: 20px;
  min-height: 0;
  ${props => !props.$isAdmin && `
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  `}
  ${p => p.$minimized && `
    gap: 0;
    & > :not(:first-child) { display: none; }
  `}
  @media (max-width: 1024px) {
    flex-direction: column;
  }
  ${p => p.$minimized && `
    flex-direction: column;
    .participant-strip { display: none; }
  `}
`;

const MainStage = styled.div`
  flex: 3;
  background: var(--chakra-colors-bg);
  border-radius: 28px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--chakra-colors-border);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 30px 60px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 var(--chakra-colors-borderSubtle);

  @media (max-width: 768px) {
    border-radius: 20px;
    min-height: 0;
  }

  ${p => p.$minimized && `
    flex: 1;
    min-height: 0;
    border-radius: 13px;
    video { object-fit: cover !important; }
  `}
`;

const ParticipantGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  overflow-y: auto;
  padding-right: 8px;

  @media (max-width: 1024px) {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 12px 4px;
    max-height: 150px;
    gap: 12px;
    &::-webkit-scrollbar { display: none; }
  }

  @media (max-width: 768px) {
    max-height: 106px;
    padding: 8px 4px 78px;
  }
`;

const VideoTile = styled.div`
  background: var(--chakra-colors-cardBg);
  backdrop-filter: blur(16px);
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 16/9;
  border: 2px solid ${props => props.$isTalking ? "#2ed573" : "var(--chakra-colors-border)"};
  box-shadow: ${props => props.$isTalking
    ? "0 0 25px rgba(46, 213, 115, 0.3), inset 0 1px 0 var(--chakra-colors-borderSubtle)"
    : "0 12px 36px rgba(0, 0, 0, 0.1)"};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  flex-shrink: 0;
  width: 100%;
  height: 100%;
  animation: ${tileEnter} 0.4s ease-out;

  ${props => props.$isStrip && `
    width: auto;
    height: 100%;
    @media (max-width: 1024px) {
      width: clamp(140px, 30vw, 180px);
      height: auto;
    }
  `}

  &:hover {
    transform: translateY(-4px) scale(1.02);
    border-color: ${props => props.$isTalking ? "#2ed573" : "var(--chakra-colors-brandPrimary)"};
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.15),
      0 0 20px ${props => props.$isTalking ? "rgba(46, 213, 115, 0.4)" : "var(--chakra-colors-brandGlow)"};
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const NameTag = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: var(--chakra-colors-glassBg);
  color: var(--chakra-colors-textPrimary);
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid var(--chakra-colors-borderSubtle);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 6px;

  @media (max-width: 768px) {
    font-size: 0.65rem;
    padding: 3px 8px;
    bottom: 6px;
    left: 6px;
  }
`;

const ControlBar = styled.div`
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  border-radius: 24px;
  border: 1px solid var(--chakra-colors-border);
  padding: 8px 16px;
  z-index: 500;
  box-shadow:
    0 20px 45px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 var(--chakra-colors-borderSubtle);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: ${slideUp} 0.4s ease-out;
  ${p => p.$minimized && `display: none;`}

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    bottom: 32px;
  }

  @media (max-width: 768px) {
    bottom: 12px;
    padding: 6px 10px;
    gap: 6px;
    width: 96%;
    max-width: 96%;
    overflow-x: auto;
    justify-content: safe center;
    border-radius: 16px;
    &::-webkit-scrollbar { display: none; }
    -ms-overflow-style: none;
    scrollbar-width: none;
    white-space: nowrap;
    scroll-snap-type: x mandatory;
  }
`;

const CircleButton = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 1px solid ${props => props.$active ? "rgba(255, 71, 87, 0.5)" : "var(--chakra-colors-badgeBorder)"};
  background: ${props => props.$active ? "#ff4757" : "var(--chakra-colors-badgeBg)"};
  color: var(--chakra-colors-textPrimary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  position: relative;
  scroll-snap-align: center;

  @media (max-width: 768px) {
    width: 42px;
    height: 42px;
    font-size: 0.95rem;
    border-radius: 10px;
  }

  &:hover {
    transform: translateY(-2px);
    background: ${props => props.$active ? "#ff6b81" : "var(--chakra-colors-surfaceHover)"};
    border-color: ${props => props.$active ? "rgba(255, 71, 87, 0.8)" : "var(--chakra-colors-brandPrimary)"};
    box-shadow: ${props => props.$active ? "none" : "0 0 10px var(--chakra-colors-brandGlow)"};
  }

  &:active {
    transform: translateY(0);
  }
`;

const ControlLabel = styled.span`
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.55rem;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0.5;
  pointer-events: none;
  color: var(--chakra-colors-textSecondary);

  @media (max-width: 768px) {
    display: none;
  }
`;

const Divider = styled.div`
  width: 1px;
  height: 24px;
  background: var(--chakra-colors-border);
  margin: 0 4px;
  flex-shrink: 0;
`;

const FloatingPiP = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  width: 120px;
  height: 170px;
  border-radius: 18px;
  overflow: hidden;
  border: 2px solid var(--chakra-colors-border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  z-index: 100;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.05);
    border-color: var(--chakra-colors-brandPrimary);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 0 0 15px var(--chakra-colors-brandGlow);
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: 768px) {
    width: 100px;
    height: 140px;
    top: 12px;
    right: 12px;
    border-radius: 14px;
  }
`;

const PrivacyGuard = styled.div`
  position: absolute;
  inset: 0;
  z-index: 200;
  background: var(--chakra-colors-bg);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--chakra-colors-textPrimary);
  opacity: ${props => props.$minimized ? 0 : props.show ? 1 : 0};
  pointer-events: ${props => props.$minimized ? "none" : props.show ? "all" : "none"};
  transition: opacity 0.3s ease;
  user-select: none;

  h3 { font-size: 1.5rem; margin-bottom: 10px; }
  p { font-size: 1rem; opacity: 0.7; }

  @media (max-width: 768px) {
    h3 { font-size: 1.1rem; }
    p { font-size: 0.8rem; }
  }

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(45deg, var(--chakra-colors-bg), var(--chakra-colors-bg) 10px, var(--chakra-colors-surface) 10px, var(--chakra-colors-surface) 20px);
    opacity: 0.9;
  }
`;

const Watermark = styled.div`
  position: absolute;
  top: ${props => props.y}%;
  left: ${props => props.x}%;
  opacity: 0.1;
  font-size: 0.8rem;
  color: var(--chakra-colors-textPrimary);
  pointer-events: none;
  z-index: 50;
  white-space: nowrap;
  transition: all 8s linear;
`;

const MeetingGrid = styled.div`
  display: grid;
  width: 100%;
  height: 100%;
  gap: 16px;
  padding: 10px;
  box-sizing: border-box;
  align-content: center;
  justify-content: center;
  overflow-y: auto;

  grid-template-columns: ${props => {
    const count = props.$count;
    if (count === 1) return "1fr";
    if (count === 2) return "1fr 1fr";
    if (count <= 4) return "1fr 1fr";
    return "repeat(auto-fit, minmax(280px, 1fr))";
  }};
  grid-template-rows: ${props => {
    const count = props.$count;
    if (count <= 2) return "1fr";
    if (count <= 4) return "1fr 1fr";
    return "repeat(auto-fit, minmax(200px, 1fr))";
  }};

  @media (max-width: 768px) {
    grid-template-columns: ${props => {
      const count = props.$count;
      if (count === 1) return "1fr";
      return "1fr 1fr";
    }};
    grid-template-rows: auto;
  }
`;

const PlaceholderAvatar = styled.div`
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, var(--chakra-colors-surface) 0%, var(--chakra-colors-bg) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const AvatarCircle = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary) 0%, var(--chakra-colors-brandSecondary) 100%);
  color: white;
  font-size: 2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  border: 3px solid var(--chakra-colors-border);
  position: relative;
  transition: all 0.3s ease;

  ${props => props.$isTalking && `
    border-color: #2ed573;
    box-shadow: 0 0 25px rgba(46, 213, 115, 0.6);
    transform: scale(1.05);
  `}

  @media (max-width: 768px) {
    width: 50px;
    height: 50px;
    font-size: 1.2rem;
  }
`;

const MutedBadge = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 71, 87, 0.85);
  color: white;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  backdrop-filter: blur(5px);
  border: 1px solid var(--chakra-colors-border);
  box-shadow: 0 4px 10px rgba(0,0,0,0.15);
`;

const ParticipantBadge = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-badgeBorder);
  padding: 5px 10px;
  border-radius: 10px;
  color: var(--chakra-colors-textPrimary);
  font-size: 0.72rem;
  font-weight: 650;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    border-color: var(--chakra-colors-brandPrimary);
  }
`;

const ParticipantPopover = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: var(--chakra-colors-surface);
  backdrop-filter: blur(24px);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 16px;
  padding: 12px;
  min-width: 200px;
  max-height: 280px;
  overflow-y: auto;
  z-index: 600;
  box-shadow: 0 20px 50px rgba(0,0,0,0.15);
  color: var(--chakra-colors-textPrimary);
  animation: ${slideUp} 0.2s ease-out;
`;

const ParticipantRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;

  &:hover { background: var(--chakra-colors-surfaceHover); }
`;

const ParticipantDot = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
  color: #white;
`;

const ConnectingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 300;
  background: var(--chakra-colors-bg);
  color: var(--chakra-colors-textPrimary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  animation: ${fadeIn} 0.3s ease-out;
`;

const SpinnerRing = styled.div`
  width: 48px;
  height: 48px;
  border: 3px solid var(--chakra-colors-border);
  border-top-color: var(--chakra-colors-brandPrimary);
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const StatusChip = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--chakra-colors-badgeBg);
  color: var(--chakra-colors-textPrimary);
  padding: 4px 8px;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 650;
`;

const TimerDisplay = styled.span`
  font-size: 0.72rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
  padding: 4px 8px;
  background: var(--chakra-colors-badgeBg);
  color: var(--chakra-colors-textPrimary);
  border-radius: 10px;
`;

const UrlInputOverlay = styled.div`
  position: absolute;
  bottom: 90px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-border);
  color: var(--chakra-colors-textPrimary);
  padding: 16px;
  border-radius: 20px;
  z-index: 1000;
  display: flex;
  gap: 10px;
  width: min(400px, 90%);
  box-shadow: 0 20px 50px rgba(0,0,0,0.15);
  animation: ${slideUp} 0.25s ease-out;
`;

const FileBroadcastOverlay = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: radial-gradient(circle at center, var(--chakra-colors-badgeBg), transparent 70%);

  .shimmer-text {
    font-size: 1rem;
    font-weight: 600;
    background: linear-gradient(90deg, var(--chakra-colors-textMuted), var(--chakra-colors-textPrimary), var(--chakra-colors-textMuted));
    background-size: 200% 100%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: ${shimmer} 2s linear infinite;
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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/* ═══════════════════════════════ COMPONENT ═══════════════════════════════ */
export default function LiveMeeting({ socket, roomId, userName, onClose, isAdmin }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeMedia, setActiveMedia] = useState(null);
  const [speakingPeers, setSpeakingPeers] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [isFocused, setIsFocused] = useState(true);
  const [watermarkPos, setWatermarkPos] = useState({ x: 10, y: 10 });
  const [focusedPeerId, setFocusedPeerId] = useState(null);
  const [networkStatus, setNetworkStatus] = useState("good");
  const [layoutMode, setLayoutMode] = useState("grid");
  const [participantStates, setParticipantStates] = useState({});
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [broadcastUrl, setBroadcastUrl] = useState("");
  const [streamMediaSource, setStreamMediaSource] = useState(null);
  const [myPeerId, setMyPeerId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);
  const [remoteFileBroadcast, setRemoteFileBroadcast] = useState(null);

  const containerRef = useRef();
  const peerRef = useRef(null);
  const myVideoRef = useRef();
  const mediaRef = useRef();
  const isRemoteUpdate = useRef(false);
  const peers = useRef({});
  const recorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const localStreamRef = useRef(null);
  const callStartTime = useRef(Date.now());

  // ─── Call Duration Timer ───
  useEffect(() => {
    callStartTime.current = Date.now();
    const timer = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Auto-focus active talker ───
  useEffect(() => {
    const activeTalker = Object.entries(speakingPeers).find(([id, isTalking]) => isTalking && id !== "local");
    if (activeTalker) {
      setFocusedPeerId(activeTalker[0]);
    }
  }, [speakingPeers]);

  // ─── Auto-focus single remote peer (PiP mode) ───
  useEffect(() => {
    const entries = Object.entries(remoteStreams);
    if (entries.length === 1 && !activeMedia) {
      setFocusedPeerId(entries[0][0]);
    }
  }, [remoteStreams, activeMedia]);

  // ─── Adaptive Bitrate Control (ABR) ───
  useEffect(() => {
    if (!localStream) return;

    const interval = setInterval(async () => {
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
        } catch (e) { /* ignore stats retrieval errors */ }
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

      if (nextStatus === "fallback") {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.enabled) {
          videoTrack.enabled = false;
          setIsVideoOff(true);
          toast.warning("Low bandwidth detected. Automatic audio-only fallback enabled.");
        }
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
          video: true,
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

          // Delay calling peers by 500ms to let PeerJS finish initializing on both sides
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

          // Delay the outgoing call slightly for reliability
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
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(localStreamRef.current);
          const analyzer = audioContext.createAnalyser();
          analyzer.fftSize = 512;
          source.connect(analyzer);
          const data = new Uint8Array(analyzer.frequencyBinCount);

          const checkVolume = () => {
            if (!analyzer) return;
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
          };
          checkVolume();
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

    const handleBlur = () => !isAdmin && setIsFocused(false);
    const handleFocus = () => setIsFocused(true);
    const handleContextMenu = (e) => e.preventDefault();
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("contextmenu", handleContextMenu);
    const wmInterval = setInterval(() => setWatermarkPos({ x: Math.random() * 80, y: Math.random() * 80 }), 8000);

    return () => {
      // Emit leave-call before cleaning up
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
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("contextmenu", handleContextMenu);
      clearInterval(wmInterval);
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
    if (!mediaRef.current || !activeMedia) return;

    const v = mediaRef.current;

    // Increased drift threshold to 2.5s for smoother experience
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
            // Add a one-time click handler to unmute
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
  }, [activeMedia]);

  // ─── Heartbeat Sync (admin only) ───
  useEffect(() => {
    if (!isAdmin || !activeMedia || !activeMedia.playing || !mediaRef.current) return;
    const interval = setInterval(() => {
      if (mediaRef.current && !isRemoteUpdate.current) {
        socket.emit("syncMedia", {
          ...activeMedia,
          time: mediaRef.current.currentTime,
          heartbeat: true
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isAdmin, activeMedia, socket]);

  const ytPlayerRef = useRef(null);

  // ─── YouTube Player Init ───
  useEffect(() => {
    if (!activeMedia || !activeMedia.url || !activeMedia.url.includes("youtu")) {
      ytPlayerRef.current = null;
      return;
    }

    const videoId = activeMedia.url.includes("youtu.be")
      ? activeMedia.url.split("/").pop()
      : activeMedia.url.split("v=")[1]?.split("&")[0];

    let player;

    const initPlayer = () => {
      if (player) return;
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
    };

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      window.onYouTubeIframeAPIReady = initPlayer;
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
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
      if (activeMedia.playing) {
        if (player.getPlayerState() !== 1) player.playVideo();
      } else {
        if (player.getPlayerState() !== 2) player.pauseVideo();
      }
      const playerTime = player.getCurrentTime();
      if (Math.abs(playerTime - activeMedia.time) > 2.5) {
        player.seekTo(activeMedia.time, true);
      }
    }
  }, [activeMedia]);

  // ─── YouTube Heartbeat ───
  useEffect(() => {
    if (!isAdmin || !activeMedia || !activeMedia.url || !activeMedia.url.includes("youtu") || !activeMedia.playing) return;
    const interval = setInterval(() => {
      if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime && !isRemoteUpdate.current) {
        socket.emit("syncMedia", { ...activeMedia, time: ytPlayerRef.current.getCurrentTime(), heartbeat: true });
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
      localStream.getVideoTracks()[0].enabled = !nextVideoOff;
      setIsVideoOff(nextVideoOff);
      socket.emit("media-state-change", { peerId: myPeerId, isMuted, isVideoOff: nextVideoOff });
    }
  }, [localStream, isVideoOff, isMuted, myPeerId, socket]);

  const handleLeaveCall = useCallback(() => {
    // Stop recording if active
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    // Stop local file broadcast if active
    if (streamMediaSource) {
      stopLocalFileBroadcast(streamMediaSource);
    }
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, streamMediaSource]);

  const startLocalFileBroadcast = async (file) => {
    try {
      const videoElement = document.createElement("video");
      videoElement.src = URL.createObjectURL(file);
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.autoplay = true;

      await new Promise(r => { videoElement.onloadedmetadata = r; });
      videoElement.play();

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
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const micStream = new MediaStream(localStream.getAudioTracks());
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(dest);
        const fileStream = new MediaStream([videoAudioTrack]);
        const fileSource = audioCtx.createMediaStreamSource(fileStream);
        fileSource.connect(dest);
        mixedAudioTrack = dest.stream.getAudioTracks()[0];
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

      if (myVideoRef.current) myVideoRef.current.srcObject = videoStream;

      Object.values(peers.current).forEach(async (call) => {
        if (call.peerConnection) {
          const senders = call.peerConnection.getSenders();
          const videoSender = senders.find(s => s.track?.kind === "video");
          if (videoSender) await videoSender.replaceTrack(videoTrack);
          if (mixedAudioTrack) {
            const audioSender = senders.find(s => s.track?.kind === "audio");
            if (audioSender) await audioSender.replaceTrack(mixedAudioTrack);
          }
        }
      });

      socket.emit("screenshare-started", { roomId, peerId: myPeerId });
      socket.emit("media-file-shared", { name: file.name, type: file.type, sharerName: userName });
      setFocusedPeerId("local");
      setActiveMedia({ url: null, playing: true, time: 0, type: "local_stream", name: file.name });

      videoElement.onended = () => stopLocalFileBroadcast(mediaSourceObj);
    } catch (e) {
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
        if (call.peerConnection) {
          const senders = call.peerConnection.getSenders();
          const videoSender = senders.find(s => s.track?.kind === "video");
          if (videoSender && originalVid) await videoSender.replaceTrack(originalVid);
          const audioSender = senders.find(s => s.track?.kind === "audio");
          if (audioSender && originalAud) await audioSender.replaceTrack(originalAud);
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
    } catch (err) {
      console.error("Error stopping video broadcast:", err);
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
    if (!mediaRef.current || isRemoteUpdate.current) return;
    const data = {
      url: activeMedia?.url,
      playing: action === "play" || (action === "seek" && !mediaRef.current.paused),
      time: mediaRef.current.currentTime,
      sender: userName
    };
    setActiveMedia(data);
    socket.emit("syncMedia", data);
  };

  const startScreenShare = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast.error("Screen sharing is unavailable in this browser.");
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always", width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 24, max: 30 } },
        audio: true
      });

      const videoTrack = screenStream.getVideoTracks()[0];
      if ("contentHint" in videoTrack) videoTrack.contentHint = "detail";

      if (myVideoRef.current) myVideoRef.current.srcObject = screenStream;

      Object.values(peers.current).forEach(async (call) => {
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
      });

      setFocusedPeerId("local");
      socket.emit("screenshare-started", { roomId, peerId: myPeerId });
      setLayoutMode("stage");

      videoTrack.onended = () => stopScreenShare();
    } catch (err) {
      toast.error(err.name === "NotAllowedError" ? "Screen sharing was cancelled." : "Unable to start screen sharing on this device.");
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
        if (call.peerConnection) {
          const sender = call.peerConnection.getSenders().find(s => s.track?.kind === "video");
          if (sender && videoTrack) await sender.replaceTrack(videoTrack);
        }
      });

      socket.emit("screenshare-stopped", { peerId: myPeerId });
      setFocusedPeerId(null);
      setLayoutMode("grid");
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
        if (call.peerConnection) {
          const sender = call.peerConnection.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(newVideoTrack);
        }
      });

      setIsFrontCamera(!isFrontCamera);
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
        const ext = options.mimeType && options.mimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(recordedChunks.current, { type: options.mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `Meeting_Recording_${Date.now()}.${ext}`; a.click();
        displayStream.getTracks().forEach(track => track.stop());
        if (audioContext.state !== "closed") audioContext.close();
        setIsRecording(false);
      };

      displayStream.getVideoTracks()[0].onended = () => {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      };

      rec.start(1000);
      recorderRef.current = rec;
      setIsRecording(true);
      toast.info("⏺ Recording Started. Your screen is being captured.");
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

  /* ═══════════════════════════════ COMPUTED ═══════════════════════════════ */
  const remoteEntries = Object.entries(remoteStreams);
  const isStageMode = layoutMode === "stage" || !!activeMedia || focusedPeerId !== null || !!remoteFileBroadcast;
  const isPiPMode = isStageMode && remoteEntries.length === 1 && !activeMedia && !isMinimized && !remoteFileBroadcast;
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

  /* ═══════════════════════════════ RENDER HELPERS ═══════════════════════════════ */
  const renderParticipantTiles = (isStrip = false) => {
    const tiles = [];

    // Local user
    tiles.push(
      <VideoTile
        key="local"
        $isTalking={speakingPeers.local}
        $isStrip={isStrip}
        onClick={() => handleTileClick("local")}
      >
        {isVideoOff ? (
          <PlaceholderAvatar>
            <AvatarCircle $isTalking={speakingPeers.local}>
              {getInitials(userName)}
            </AvatarCircle>
            {isMuted && <MutedBadge title="Muted"><FaMicrophoneSlash /></MutedBadge>}
          </PlaceholderAvatar>
        ) : (
          <video ref={myVideoRef} autoPlay muted playsInline />
        )}
        <NameTag>
          {userName} (You) {isMuted && <span style={{ color: "#ff4757" }}>🎤 Muted</span>}
        </NameTag>
      </VideoTile>
    );

    // Remote users
    Object.entries(remoteStreams).forEach(([id, info]) => {
      const peerState = participantStates[id] || {};
      const peerVideoOff = peerState.isVideoOff;
      const peerMuted = peerState.isMuted;

      tiles.push(
        <VideoTile
          key={id}
          $isTalking={speakingPeers[id]}
          $isStrip={isStrip}
          onClick={() => handleTileClick(id)}
        >
          {peerVideoOff ? (
            <PlaceholderAvatar>
              <AvatarCircle $isTalking={speakingPeers[id]}>
                {getInitials(info.name)}
              </AvatarCircle>
              {peerMuted && <MutedBadge title="Muted"><FaMicrophoneSlash /></MutedBadge>}
            </PlaceholderAvatar>
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
            {info.name} {peerMuted && <span style={{ color: "#ff4757" }}>🎤 Muted</span>}
          </NameTag>
        </VideoTile>
      );
    });

    return tiles;
  };

  const renderMainStageContent = () => {
    // Focused peer view
    if (focusedPeerId) {
      const focusedIsVideoOff = focusedPeerId === "local" ? isVideoOff : (participantStates[focusedPeerId]?.isVideoOff);
      const focusedName = focusedPeerId === "local" ? userName : (remoteStreams[focusedPeerId]?.name || "Participant");
      const focusedIsMuted = focusedPeerId === "local" ? isMuted : (participantStates[focusedPeerId]?.isMuted);
      const focusedIsTalking = speakingPeers[focusedPeerId];
      const targetStream = focusedPeerId === "local" ? localStream : remoteStreams[focusedPeerId]?.stream;

      return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          {focusedIsVideoOff ? (
            <PlaceholderAvatar style={{ borderRadius: 28 }}>
              <AvatarCircle $isTalking={focusedIsTalking} style={{ width: 120, height: 120, fontSize: "3rem" }}>
                {getInitials(focusedName)}
              </AvatarCircle>
              {focusedIsMuted && <MutedBadge style={{ width: 36, height: 36, fontSize: "1.2rem", top: 20, right: 20 }} title="Muted"><FaMicrophoneSlash /></MutedBadge>}
            </PlaceholderAvatar>
          ) : (
            <video
              autoPlay
              playsInline
              muted={focusedPeerId === "local"}
              ref={el => {
                if (el && targetStream && el.srcObject !== targetStream) el.srcObject = targetStream;
              }}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )}
          <div style={{ position: "absolute", top: 20, left: 20, background: "rgba(0,0,0,0.6)", padding: "5px 15px", borderRadius: 20, display: "flex", alignItems: "center", gap: 10, zIndex: 100 }}>
            <span>Viewing: {focusedPeerId === "local" ? "You" : remoteStreams[focusedPeerId]?.name}</span>
            <button onClick={() => { setFocusedPeerId(null); setLayoutMode("grid"); }} style={{ background: "none", border: "none", color: "var(--chakra-colors-textPrimary)", cursor: "pointer", fontSize: "1rem" }}>✕</button>
          </div>
        </div>
      );
    }

    // Active media (URL broadcast or local stream)
    if (activeMedia) {
      return (
        <div key={activeMedia.url} style={{ width: "100%", height: "100%", position: "relative" }}>
          {activeMedia.url?.includes("youtu") ? (
            <div id="youtube-sync-player" style={{ width: "100%", height: "100%" }} />
          ) : activeMedia.type === "local_stream" && !isAdmin ? (
            // Non-admin sees "streaming in progress" overlay (the video comes via WebRTC peer track)
            <FileBroadcastOverlay>
              <FaDesktop size={48} style={{ opacity: 0.3 }} />
              <div className="shimmer-text">{remoteFileBroadcast?.sharerName || "Admin"} is streaming: {remoteFileBroadcast?.name || activeMedia.name || "Media"}</div>
              <span style={{ fontSize: "0.8rem", opacity: 0.4 }}>Audio and video are streamed live via the call</span>
            </FileBroadcastOverlay>
          ) : (
            <video
              ref={mediaRef}
              src={activeMedia.url}
              controls
              playsInline
              style={{ width: "100%", height: "100%" }}
              onPlay={() => handleMediaAction("play")}
              onPause={() => handleMediaAction("pause")}
              onSeeked={() => handleMediaAction("seek")}
            />
          )}
          <div style={{ position: "absolute", top: 20, left: 20, background: "rgba(0,0,0,0.6)", padding: "5px 15px", borderRadius: 20, display: "flex", alignItems: "center", gap: 10, zIndex: 100 }}>
            <span>Shared Media: {activeMedia.name || "Broadcast"}</span>
            {isAdmin && (
              <button
                onClick={() => {
                  if (activeMedia.type === "local_stream") stopLocalFileBroadcast();
                  else { setActiveMedia(null); socket.emit("syncMedia", null); }
                }}
                style={{ background: "rgba(255,71,87,0.8)", border: "none", color: "white", padding: "2px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}
              >
                Stop
              </button>
            )}
          </div>
        </div>
      );
    }

    // Remote file broadcast overlay for non-admin when no activeMedia
    if (remoteFileBroadcast && !isAdmin) {
      return (
        <FileBroadcastOverlay>
          <FaDesktop size={48} style={{ opacity: 0.3 }} />
          <div className="shimmer-text">{remoteFileBroadcast.sharerName || "Admin"} is streaming: {remoteFileBroadcast.name || "Media"}</div>
          <span style={{ fontSize: "0.8rem", opacity: 0.4 }}>Audio and video are streamed live via the call</span>
        </FileBroadcastOverlay>
      );
    }

    // Empty stage
    return <div style={{ opacity: 0.2 }}><FaDesktop size={100} /></div>;
  };

  /* ═══════════════════════════════ RENDER ═══════════════════════════════ */
  return (
    <MeetingOverlay ref={containerRef} $minimized={isMinimized} onClick={isMinimized ? () => setIsMinimized(false) : undefined}>
      {/* ─── HEADER ─── */}
      <MeetingHeader $minimized={isMinimized}>
        <HeaderLeft>
          <div className="live-pulse" style={{ width: 8, height: 8, background: "#ff4757", borderRadius: "50%", flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Video Call
          </h2>
          {!isMinimized && (
            <>
              <StatusChip>
                {networkStatus === "good" && <span style={{ color: "#2ed573" }}>● Good</span>}
                {networkStatus === "poor" && <span style={{ color: "#ffa502" }}>● Weak</span>}
                {networkStatus === "fallback" && <span style={{ color: "#ff4757" }}>● Low BW</span>}
              </StatusChip>
              <TimerDisplay>{formatDuration(callDuration)}</TimerDisplay>
              <div style={{ position: "relative" }}>
                <ParticipantBadge onClick={(e) => { e.stopPropagation(); setShowParticipants(p => !p); }}>
                  <FaUsers size={12} />
                  {totalParticipantsCount}
                </ParticipantBadge>
                {showParticipants && (
                  <ParticipantPopover onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, opacity: 0.6 }}>IN THIS CALL</span>
                      <button onClick={() => setShowParticipants(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", opacity: 0.5, fontSize: "0.8rem" }}><FaTimes /></button>
                    </div>
                    {allParticipants.map(p => (
                      <ParticipantRow key={p.id}>
                        <ParticipantDot>{getInitials(p.name)}</ParticipantDot>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{p.id === "local" ? " (You)" : ""}</span>
                        {p.isMuted && <FaMicrophoneSlash size={10} style={{ color: "#ff4757", flexShrink: 0 }} />}
                        {p.isVideoOff && <FaVideoSlash size={10} style={{ color: "#ff4757", flexShrink: 0 }} />}
                      </ParticipantRow>
                    ))}
                  </ParticipantPopover>
                )}
              </div>
            </>
          )}
        </HeaderLeft>
        <HeaderRight onClick={(e) => e.stopPropagation()}>
          {isMinimized ? (
            <CircleButton style={{ width: 32, height: 32, fontSize: ".8rem" }} onClick={() => setIsMinimized(false)} title="Return to call"><FaExpand /></CircleButton>
          ) : (
            <>
              <CircleButton
                style={{ width: 32, height: 32, fontSize: "0.8rem" }}
                onClick={() => {
                  if (layoutMode === "grid") {
                    setLayoutMode("stage");
                    setFocusedPeerId(remoteEntries.length > 0 ? remoteEntries[0][0] : "local");
                  } else {
                    setLayoutMode("grid");
                    setFocusedPeerId(null);
                  }
                }}
                title={layoutMode === "grid" ? "Switch to Stage View" : "Switch to Grid View"}
              >
                {layoutMode === "grid" ? <FaDesktop /> : <FaThLarge />}
              </CircleButton>
              <CircleButton
                style={{ width: 32, height: 32, fontSize: "0.8rem" }}
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <FaCompress /> : <FaExpand />}
              </CircleButton>
              <CircleButton
                style={{ width: 32, height: 32, fontSize: "0.8rem" }}
                onClick={(event) => { event.stopPropagation(); setIsMinimized(true); }}
                title="Minimize"
              >
                <FaWindowMinimize />
              </CircleButton>
            </>
          )}
          <Divider style={{ height: 16, margin: "0 4px" }} />
          <CircleButton
            $active={true}
            style={isMinimized ? { width: 32, height: 32, fontSize: ".8rem" } : undefined}
            onClick={handleLeaveCall}
            title="Leave Meeting"
          >
            <FaPhoneSlash />
          </CircleButton>
        </HeaderRight>
      </MeetingHeader>

      {/* ─── CONTENT ─── */}
      <ContentLayout $isAdmin={isAdmin} $minimized={isMinimized}>
        {isStageMode ? (
          <>
            <MainStage $minimized={isMinimized}>
              {isConnecting && (
                <ConnectingOverlay>
                  <SpinnerRing />
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Connecting to meeting...</span>
                  <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Setting up your camera and microphone</span>
                </ConnectingOverlay>
              )}
              {!isAdmin && <PrivacyGuard $minimized={isMinimized} show={!isFocused}><h3>Privacy watermark active</h3><p>Your name and a live timestamp remain visible during this call.</p></PrivacyGuard>}
              {!isMinimized && <div style={{ position: "absolute", top: 10, left: 10, zIndex: 60, fontSize: "0.6rem", opacity: 0.3, color: "var(--chakra-colors-textPrimary)" }}>ID: {myPeerId || "Connecting..."}</div>}
              {!isMinimized && <Watermark x={watermarkPos.x} y={watermarkPos.y}>{userName} | {new Date().toLocaleTimeString()} | CONFIDENTIAL</Watermark>}
              {isPiPMode && (
                <FloatingPiP onClick={flipCamera} title="Tap to flip camera">
                  <video ref={el => { if (el && localStream && el.srcObject !== localStream) el.srcObject = localStream; }} autoPlay muted playsInline />
                  <div style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.5)", borderRadius: 8, padding: "2px 6px", fontSize: "0.6rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                    <FaExchangeAlt size={8} /> Flip
                  </div>
                </FloatingPiP>
              )}
              {reactions.map(r => (
                <div key={r.id} style={{ position: "absolute", bottom: 0, left: `${r.x}%`, fontSize: "2.5rem", animation: "floatUp 3s ease-out forwards", zIndex: 100 }}>{r.emoji}</div>
              ))}
              {!isMinimized && isSyncing && (
                <div style={{ position: "absolute", top: 20, right: 20, color: "#4CAF50", display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.6)", padding: "8px 15px", borderRadius: "10px", backdropFilter: "blur(5px)" }}>
                  <FaSync style={{ animation: "spin 1s linear infinite" }} /> Real-time Syncing...
                </div>
              )}
              {renderMainStageContent()}
            </MainStage>

            {!isPiPMode && (
              <ParticipantGrid className="participant-strip">
                {renderParticipantTiles(true)}
              </ParticipantGrid>
            )}
          </>
        ) : (
          <>
            {isConnecting && (
              <ConnectingOverlay style={{ borderRadius: 28 }}>
                <SpinnerRing />
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Connecting to meeting...</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>Setting up your camera and microphone</span>
              </ConnectingOverlay>
            )}
            <MeetingGrid $count={totalParticipantsCount} className="meeting-grid">
              {renderParticipantTiles(false)}
            </MeetingGrid>
          </>
        )}
      </ContentLayout>

      {/* ─── CONTROL BAR ─── */}
      <ControlBar $minimized={isMinimized}>
        <CircleButton $active={isMuted} onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          <ControlLabel>{isMuted ? "Unmute" : "Mute"}</ControlLabel>
        </CircleButton>
        <CircleButton $active={isVideoOff} onClick={toggleVideo} title={isVideoOff ? "Camera On" : "Camera Off"}>
          {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
          <ControlLabel>{isVideoOff ? "Start" : "Stop"}</ControlLabel>
        </CircleButton>
        <CircleButton onClick={flipCamera} title="Flip Camera">
          <FaExchangeAlt />
          <ControlLabel>Flip</ControlLabel>
        </CircleButton>
        <CircleButton onClick={startScreenShare} title="Share Screen">
          <FaDesktop />
          <ControlLabel>Share</ControlLabel>
        </CircleButton>

        {isAdmin && (
          <>
            <Divider />
            {streamMediaSource ? (
              <CircleButton
                onClick={() => stopLocalFileBroadcast()}
                title="Stop Local Video Broadcast"
                style={{ background: "#ff4757", borderColor: "#ff4757" }}
              >
                <FaStop />
                <ControlLabel>Stop File</ControlLabel>
              </CircleButton>
            ) : (
              <label>
                <CircleButton as="span" title="Share a media file from your device">
                  <FaFolderOpen />
                  <ControlLabel>File</ControlLabel>
                  <input type="file" hidden accept="video/*,audio/*" onChange={handleLocalFile} />
                </CircleButton>
              </label>
            )}

            <CircleButton
              onClick={() => setShowUrlInput(prev => !prev)}
              title="Share a URL (YouTube, MP4)"
              style={{ background: showUrlInput ? "rgba(0,191,165,0.2)" : "transparent", borderColor: showUrlInput ? "var(--chakra-colors-brandPrimary)" : "rgba(255,255,255,0.06)" }}
            >
              <FaLink />
              <ControlLabel>URL</ControlLabel>
            </CircleButton>

            <CircleButton
              $active={isRecording}
              onClick={toggleRecording}
              title={isRecording ? "Stop Recording" : "Record Meeting"}
              style={{ background: isRecording ? "#ff4757" : "transparent", borderColor: isRecording ? "#ff4757" : "rgba(255,71,87,0.3)" }}
            >
              <FaRecordVinyl color={isRecording ? "white" : "#ff4757"} />
              <ControlLabel>{isRecording ? "Stop Rec" : "Record"}</ControlLabel>
            </CircleButton>
          </>
        )}

        <Divider />
        <CircleButton onClick={() => sendReaction("👋")} title="Raise Hand" style={{ background: "transparent", border: "none" }}>
          <FaHandPaper />
          <ControlLabel>Hand</ControlLabel>
        </CircleButton>
        {["❤️", "👏", "😂"].map(e => (
          <CircleButton key={e} onClick={() => sendReaction(e)} title={`Send ${e}`} style={{ background: "transparent", border: "none" }}>
            {e}
          </CircleButton>
        ))}
      </ControlBar>

      {/* ─── URL INPUT OVERLAY ─── */}
      {showUrlInput && (
        <UrlInputOverlay>
          <input
            type="text"
            placeholder="Paste YouTube or direct MP4 URL..."
            value={broadcastUrl}
            onChange={(e) => setBroadcastUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlBroadcast()}
            style={{
              flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px", padding: "8px 12px", color: "white", fontSize: "0.9rem", outline: "none"
            }}
          />
          <button
            onClick={handleUrlBroadcast}
            style={{
              background: "var(--chakra-colors-brandPrimary)", border: "none", borderRadius: "10px",
              padding: "8px 16px", color: "white", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer"
            }}
          >
            Broadcast
          </button>
        </UrlInputOverlay>
      )}

      {/* ─── KEYFRAME STYLES ─── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes floatUp { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-700px) scale(2.5); opacity: 0; } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(255, 71, 87, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); } }
        .live-pulse { animation: pulse 2s infinite; }
        video { -webkit-user-select: none; -webkit-touch-callout: none; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </MeetingOverlay>
  );
}
