import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes, StyleSheetManager, css } from "styled-components";
import { 
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, 
  FaPhoneSlash, FaSync, FaDesktop, FaFolderOpen, FaRecordVinyl, 
  FaCompress, FaExpand, FaExchangeAlt, FaLink, 
  FaThLarge, FaStop, FaUsers, FaHandPaper, FaPlay, 
  FaPause, FaStepBackward, FaStepForward, FaTachometerAlt,
  FaWifi, FaSignal, FaWindowMinimize, FaTimes, FaCheckCircle, FaTimesCircle, FaThumbtack
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

  ${props => props.$minimized && `
    inset: auto;
    bottom: 20px;
    right: 20px;
    width: 320px;
    height: 200px;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.08);
    cursor: pointer;
    
    .meeting-header {
      padding: 8px 12px;
    }
    
    .content-area {
      padding: 4px 8px;
    }
    
    .controls-bar {
      display: none;
    }
    
    .participant-sidebar {
      display: none;
    }
    
    .main-video-area {
      border-radius: 8px;
      min-height: 100px;
    }
  `}

  @media (max-width: 768px) {
    ${props => props.$minimized && `
      width: 280px;
      height: 180px;
      bottom: 10px;
      right: 10px;
      border-radius: 12px;
    `}
  }

  @media (max-width: 480px) {
    ${props => props.$minimized && `
      width: 240px;
      height: 160px;
      bottom: 8px;
      right: 8px;
      border-radius: 10px;
    `}
  }
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
  transition: all 0.3s ease;

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
  background: var(--chakra-colors-surface, rgba(255, 255, 255, 0.03));
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 16/9;
  border: 2px solid ${props => 
    props.$isPinned ? 'rgba(255, 193, 7, 0.7)' :
    props.$isTalking ? 'rgba(46, 213, 115, 0.6)' : 
    props.$isActive ? 'rgba(74, 158, 255, 0.4)' : 
    'var(--chakra-colors-border, rgba(255, 255, 255, 0.06))'
  };
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: ${tileEnter} 0.4s ease-out;

  ${props => props.$isPinned && css`
    box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.25), 0 4px 16px rgba(255, 193, 7, 0.12);
  `}

  &:hover {
    transform: scale(1.02);
    border-color: ${props => 
      props.$isPinned ? 'rgba(255, 193, 7, 0.9)' :
      props.$isTalking ? 'rgba(46, 213, 115, 0.8)' : 'rgba(74, 158, 255, 0.6)'};
  }

  ${props => props.$isActive && !props.$isPinned && css`
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

const BadgeContainer = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  z-index: 5;

  @media (max-width: 768px) {
    top: 4px;
    right: 4px;
    gap: 4px;
  }
`;

const InfoIndicatorContainer = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 6px;
  z-index: 5;

  @media (max-width: 768px) {
    top: 4px;
    left: 4px;
    gap: 4px;
  }
`;

const IndicatorBadge = styled.div`
  background: rgba(10, 10, 18, 0.75);
  backdrop-filter: blur(10px);
  color: ${props => props.$color || 'white'};
  padding: 4px 8px;
  border-radius: 8px;
  font-size: clamp(0.55rem, 0.8vw, 0.7rem);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  height: clamp(20px, 3vw, 26px);

  @media (max-width: 768px) {
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 0.5rem;
    height: 18px;
  }

  @media (max-width: 480px) {
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 0.45rem;
    height: 14px;
  }
`;

const PipContainer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: hidden;
  border-radius: 16px;

  @media (max-width: 768px) {
    border-radius: 12px;
  }
  @media (max-width: 480px) {
    border-radius: 10px;
  }
  
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const PipAvatarWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e1e30, #0f0f1b);
`;

const PipAvatar = styled.div`
  width: clamp(50px, 8vw, 70px);
  height: clamp(50px, 8vw, 70px);
  border-radius: 50%;
  background: linear-gradient(135deg, #4a9eff, #6c5ce7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  box-shadow: 0 8px 24px rgba(108, 92, 231, 0.3);
`;

const PipControlsOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  transition: opacity 0.2s ease-in-out;

  &:hover {
    opacity: 1;
  }
`;

const PipBubbleButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${props => props.$active ? 'rgba(255, 71, 87, 0.9)' : 'rgba(255, 255, 255, 0.2)'};
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.1);
    background: ${props => props.$active ? 'rgba(255, 71, 87, 1)' : 'rgba(255, 255, 255, 0.35)'};
  }

  svg {
    font-size: 14px;
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

const SpeakingIndicator = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(46, 213, 115, 0.2);
  border: 1px solid rgba(46, 213, 115, 0.3);
  padding: 4px 16px;
  border-radius: 20px;
  font-size: clamp(0.6rem, 0.9vw, 0.75rem);
  color: #2ed573;
  display: flex;
  align-items: center;
  gap: 6px;
  animation: ${breathe} 1.5s ease-in-out infinite;
  z-index: 10;
`;

const ShimmerText = styled.div`
  font-size: clamp(0.8rem, 1.5vw, 1rem);
  font-weight: 600;
  background: linear-gradient(90deg, rgba(255,255,255,0.3), #ffffff, rgba(255,255,255,0.3));
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shimmer} 2s linear infinite;
  text-align: center;
`;

const FocusedPeerOverlay = styled.div`
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(10px);
  padding: 6px 16px;
  border-radius: 12px;
  font-size: clamp(0.6rem, 1vw, 0.8rem);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
`;

const FocusedPeerCloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.6;
  padding: 0 4px;
  
  &:hover {
    opacity: 1;
  }
`;

const BroadcastOverlay = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 12px;
  background: radial-gradient(circle at center, var(--chakra-colors-badgeBg, rgba(255,255,255,0.03)), transparent 70%);

  @media (max-width: 768px) {
    gap: 8px;
    padding: 16px;
  }

  @media (max-width: 480px) {
    gap: 6px;
    padding: 12px;
  }
`;

const ParticipantPopover = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: rgba(20, 20, 35, 0.95);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 16px;
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  animation: ${slideUp} 0.2s ease-out;

  @media (max-width: 768px) {
    min-width: 180px;
    padding: 12px;
    right: -10px;
  }
`;

const ParticipantRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 8px;
  font-size: 0.8rem;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`;

const ParticipantAvatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a9eff, #6c5ce7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  color: white;
  flex-shrink: 0;
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
  const [socketStatus, setSocketStatus] = useState(socket?.connected ? "connected" : "connecting");
  const [layoutMode, setLayoutMode] = useState("grid");
  const [participantStates, setParticipantStates] = useState({});
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [broadcastUrl, setBroadcastUrl] = useState("");
  const [streamMediaSource, setStreamMediaSource] = useState(null);
  const [myPeerId, setMyPeerId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
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
  const [pinnedPeerId, setPinnedPeerId] = useState(null);
  const [peerNetworkStatus, setPeerNetworkStatus] = useState({});
  const [volumes, setVolumes] = useState({});
  const [screenLocked, setScreenLocked] = useState(false);

  // Refs
  const audioAnalyzersRef = useRef({});
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
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const connectionTimer = useRef(null);
  const isConnectingRef = useRef(true);
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  const myPeerIdRef = useRef(null);

  useEffect(() => {
    isConnectingRef.current = isConnecting;
  }, [isConnecting]);

  // ── Screenshot & Recording Protection ──
  useEffect(() => {
    if (isAdmin) { setScreenLocked(false); return; }
    const onBlur = () => setScreenLocked(true);
    const onFocus = () => setScreenLocked(false);
    const onVis = () => setScreenLocked(document.hidden);
    const onKey = (e) => {
      if (
        e.key === "PrintScreen" ||
        (e.metaKey && e.shiftKey && ["3","4","5"].includes(e.key)) ||
        (e.ctrlKey && e.shiftKey && ["3","4","5"].includes(e.key))
      ) {
        setScreenLocked(true);
        toast.warning("🔒 Screenshot blocked — content is protected.");
        navigator.clipboard?.writeText?.("");
        e.preventDefault();
      }
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
    };
  }, [isAdmin]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  useEffect(() => {
    myPeerIdRef.current = myPeerId;
  }, [myPeerId]);

  // Play dynamic synthetic sound effects (join/leave) using Web Audio API
  const playChime = useCallback((type) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (freq, startTime, duration, typeNode = "sine") => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = typeNode;
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      if (type === "join") {
        playTone(523.25, now, 0.12, "triangle"); // C5
        playTone(659.25, now + 0.08, 0.12, "triangle"); // E5
        playTone(783.99, now + 0.16, 0.25, "triangle"); // G5
      } else if (type === "leave") {
        playTone(783.99, now, 0.12, "triangle"); // G5
        playTone(659.25, now + 0.08, 0.12, "triangle"); // E5
        playTone(523.25, now + 0.16, 0.25, "triangle"); // C5
      }
    } catch (e) {
      console.warn("Chime failed:", e);
    }
  }, []);

  // Setup dynamic audio analyzers for remote streams
  const setupStreamAudioAnalysis = useCallback((peerId, stream) => {
    if (!stream || !stream.getAudioTracks().length) return;
    if (audioAnalyzersRef.current[peerId]) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      
      if (!window.__globalMeetingAudioCtx) {
        window.__globalMeetingAudioCtx = new AudioContextClass();
      }
      const ctx = window.__globalMeetingAudioCtx;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      
      audioAnalyzersRef.current[peerId] = {
        analyzer,
        dataArray: new Uint8Array(analyzer.frequencyBinCount)
      };
      console.log(`🎙 Audio analyzer setup for remote peer: ${peerId}`);
    } catch (e) {
      console.warn(`Failed to setup audio analysis for ${peerId}:`, e);
    }
  }, []);

  // Volume level checking loop
  useEffect(() => {
    let active = true;
    const updateVolumes = () => {
      if (!active) return;
      
      const newVolumes = {};
      let changed = false;
      
      Object.entries(audioAnalyzersRef.current).forEach(([peerId, item]) => {
        try {
          item.analyzer.getByteFrequencyData(item.dataArray);
          const sum = item.dataArray.reduce((a, b) => a + b, 0);
          const volume = Math.min(100, Math.round((sum / item.dataArray.length) * 1.5));
          newVolumes[peerId] = volume;
          changed = true;
        } catch (e) {
          // Ignore
        }
      });
      
      if (changed) {
        setVolumes(prev => {
          const isDifferent = Object.keys(newVolumes).some(k => Math.abs((prev[k] || 0) - newVolumes[k]) > 4);
          if (isDifferent) return { ...prev, ...newVolumes };
          return prev;
        });
      }
      
      requestAnimationFrame(updateVolumes);
    };
    
    requestAnimationFrame(updateVolumes);
    
    return () => {
      active = false;
    };
  }, []);

  // ─── Get controlled media element ───
  const getControlledMedia = useCallback(() => {
    if (activeMedia?.type === "local_stream") {
      return broadcastVideoRef.current || localMediaRef.current;
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

  // ─── Auto-focus active talker (skipped when user has manually pinned) ───
  useEffect(() => {
    if (pinnedPeerId) return; // Don't auto-focus when manually pinned
    const activeTalker = Object.entries(speakingPeers).find(([id, isTalking]) => isTalking && id !== "local");
    if (activeTalker && layoutMode !== "stage") {
      setFocusedPeerId(activeTalker[0]);
    }
  }, [speakingPeers, layoutMode, pinnedPeerId]);

  // ─── Adaptive Bitrate Control ───
  useEffect(() => {
    if (!localStream) return;

    const interval = setInterval(async () => {
      try {
        let totalPacketsLost = 0;
        let totalRTT = 0;
        let rttCount = 0;
        const newPeerStatus = {};

        const promises = Object.entries(peers.current).map(async ([peerId, call]) => {
          if (!call.peerConnection) return;
          try {
            let peerRTT = 0;
            let peerPacketsLost = 0;
            const stats = await call.peerConnection.getStats();
            stats.forEach((report) => {
              if (report.type === "candidate-pair" && report.state === "succeeded") {
                if (report.currentRoundTripTime !== undefined) {
                  peerRTT = report.currentRoundTripTime * 1000;
                  totalRTT += report.currentRoundTripTime;
                  rttCount++;
                }
              }
              if (report.type === "inbound-rtp" && report.kind === "video") {
                if (report.packetsLost !== undefined) {
                  peerPacketsLost = report.packetsLost;
                  totalPacketsLost += report.packetsLost;
                }
              }
            });
            let status = "good";
            if (peerRTT > 300 || peerPacketsLost > 50) status = "poor";
            if (peerRTT > 600 || peerPacketsLost > 150) status = "fallback";
            newPeerStatus[peerId] = status;
          } catch (e) { /* ignore */ }
        });

        await Promise.all(promises);
        setPeerNetworkStatus(newPeerStatus);

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
    if (!socket || typeof socket.on !== "function") {
      console.error("LiveMeeting: invalid socket instance");
      toast.error("Meeting socket is unavailable. Refresh the page and try again.");
      setSocketStatus("disconnected");
      setIsConnecting(false);
      return;
    }
    const backendUrl = new URL(process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com");

    const cleanupPeer = (peerId) => {
      if (peers.current[peerId]) {
        try { peers.current[peerId].close(); } catch (e) {}
        delete peers.current[peerId];
      }
      // Clean up audio analyzer for this peer
      if (audioAnalyzersRef.current[peerId]) {
        delete audioAnalyzersRef.current[peerId];
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
      setVolumes(v => {
        const n = { ...v };
        delete n[peerId];
        return n;
      });
    };

    const handleCallEvents = (call, remotePeerId) => {
      call.on("stream", (rem) => {
        console.log(`✅ Received stream from ${remotePeerId}`);
        setRemoteStreams(p => ({
          ...p,
          [remotePeerId]: {
            stream: rem,
            name: p[remotePeerId]?.name || "Participant"
          }
        }));
        // Setup audio analyzer for remote stream
        setupStreamAudioAnalysis(remotePeerId, rem);
      });
      call.on("close", () => {
        console.log(`🔴 Call closed with ${remotePeerId}`);
        cleanupPeer(remotePeerId);
      });
      call.on("error", (e) => {
        console.error(`❌ Call error with peer ${remotePeerId}:`, e);
        cleanupPeer(remotePeerId);
      });
    };

    const callPeer = (peerId) => {
      if (!localStreamRef.current || !peerRef.current) return;
      if (peers.current[peerId]) return;
      if (peerId === myPeerIdRef.current) return;

      console.log(`📞 Attempting to call peer: ${peerId}`);
      try {
        const call = peerRef.current.call(peerId, localStreamRef.current);
        if (call) {
          handleCallEvents(call, peerId);
          peers.current[peerId] = call;
          console.log(`✅ Successfully called peer: ${peerId}`);
          return true;
        }
      } catch (e) {
        console.error(`❌ Error calling peer ${peerId}:`, e);
        return false;
      }
    };

    const init = async () => {
      try {
        setIsConnecting(true);
        if (socket && !socket.connected && typeof socket.connect === 'function') {
          socket.connect();
        }
        if (connectionTimer.current) clearTimeout(connectionTimer.current);
        connectionTimer.current = window.setTimeout(() => {
          if (isConnectingRef.current) {
            toast.error("Meeting connection timed out. Please check your network and refresh the page.");
            setIsConnecting(false);
          }
        }, 20000);

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

        // ✅ Updated ICE servers with TURN for better NAT traversal
        const iceServers = [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          // ✅ Public TURN servers for NAT traversal
          {
            urls: [
              'turn:turn.anyfirewall.com:443?transport=tcp',
              'turn:turn.anyfirewall.com:3478?transport=udp'
            ],
            username: 'anyfirewall',
            credential: 'anyfirewall'
          },
          // ✅ Google's TURN server as fallback
          {
            urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            username: 'anyfirewall',
            credential: 'anyfirewall'
          }
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
          if (connectionTimer.current) {
            clearTimeout(connectionTimer.current);
            connectionTimer.current = null;
          }
          myPeerIdRef.current = id;
          setMyPeerId(id);
          setIsConnecting(false);
          reconnectAttempts.current = 0;
          console.log(`✅ PeerJS opened with ID: ${id}`);
          socket.emit("join-call", { roomId, peerId: id, userName, isMuted: false, isVideoOff: false });
        });

        peer.on("call", (call) => {
          console.log(`📞 Incoming call from: ${call.peer}`);
          if (localStreamRef.current) {
            call.answer(localStreamRef.current);
            handleCallEvents(call, call.peer);
            peers.current[call.peer] = call;
          }
        });

        // ✅ Enhanced error handling with reconnection
        peer.on("error", (err) => {
          console.error("❌ PeerJS error:", err);
          if (connectionTimer.current) {
            clearTimeout(connectionTimer.current);
            connectionTimer.current = null;
          }
          if (isConnectingRef.current) {
            setIsConnecting(false);
          }
          if (err.type === "disconnected") {
            if (reconnectAttempts.current < maxReconnectAttempts) {
              reconnectAttempts.current++;
              toast.warning(`Disconnected. Reconnecting (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
              setTimeout(() => {
                try {
                  peer.reconnect();
                } catch (e) {
                  console.error("Reconnection attempt failed:", e);
                }
              }, 2000 * reconnectAttempts.current);
            } else {
              toast.error("Failed to reconnect after multiple attempts. Please refresh the page.");
            }
          } else if (err.type === "network") {
            toast.error("Network error. Please check your connection.");
          } else if (err.type === "peer-unavailable") {
            const peerIdStr = err.message.split(" ").pop();
            if (peerIdStr) cleanupPeer(peerIdStr);
          }
        });

        // ✅ Peer reconnection handling
        peer.on("disconnected", () => {
          console.log("⚠️ PeerJS disconnected. Attempting reconnection...");
          toast.warning("Connection lost. Reconnecting...");
          setTimeout(() => {
            try {
              peer.reconnect();
            } catch (e) {
              console.error("Reconnection failed:", e);
              toast.error("Failed to reconnect. Please refresh the page.");
            }
          }, 2000);
        });

        peer.on("connecting", () => {
          console.log("🔄 PeerJS connecting...");
        });

        peer.on("connected", () => {
          console.log("✅ PeerJS connected successfully!");
          reconnectAttempts.current = 0;
          toast.success("Reconnected to meeting!");
        });

        peerRef.current = peer;

        // ─── Socket Event Handlers ───
        socket.on("existing-callers", (callers) => {
          console.log("📋 Existing callers:", callers);
          callers.forEach(({ peerId, name, isMuted: peerMuted, isVideoOff: peerVideoOff }) => {
            setRemoteStreams(p => ({ ...p, [peerId]: { stream: p[peerId]?.stream || null, name } }));
            setParticipantStates(p => ({
              ...p,
              [peerId]: { isMuted: peerMuted, isVideoOff: peerVideoOff }
            }));
          });

          setTimeout(() => {
            callers.forEach(({ peerId, name }) => {
              if (peerId !== myPeerIdRef.current) {
                callPeer(peerId);
              }
            });
          }, 500);
        });

        socket.on("user-connected-call", ({ peerId, name, isMuted: peerMuted, isVideoOff: peerVideoOff }) => {
          console.log(`👤 User connected: ${name} (${peerId})`);
          playChime("join");
          setRemoteStreams(p => ({ ...p, [peerId]: { stream: p[peerId]?.stream || null, name } }));
          setParticipantStates(p => ({
            ...p,
            [peerId]: { isMuted: peerMuted, isVideoOff: peerVideoOff }
          }));

          setTimeout(() => {
            if (peerId !== myPeerIdRef.current) {
              const success = callPeer(peerId);
              if (!success) {
                // Retry after delay
                setTimeout(() => {
                  if (!peers.current[peerId]) {
                    callPeer(peerId);
                  }
                }, 2000);
              }
            }
          }, 300);
        });

        // ✅ Connection verification listener
        socket.on("connection-verified", ({ message }) => {
          console.log("✅ Connection verified:", message);
          toast.success("Connected to call successfully!");
        });

        // ✅ Peer connection status listener
        socket.on("peer-connection-status", ({ peerIds, connected }) => {
          console.log("📊 Peer connection status:", { peerIds, connected });
          if (!connected) {
            console.warn("⚠️ Not connected to all peers, attempting reconnection...");
            peerIds.forEach(peerId => {
              if (peerId !== myPeerIdRef.current && !peers.current[peerId]) {
                callPeer(peerId);
              }
            });
          }
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
                const rawVolume = data.reduce((a, b) => a + b) / data.length;
                const volume = rawVolume;
                const isTalking = volume > 30;
                // Update local volume in volumes state
                setVolumes(v => {
                  const diff = Math.abs((v.local || 0) - Math.min(100, Math.round(volume * 1.5)));
                  if (diff > 4) return { ...v, local: Math.min(100, Math.round(volume * 1.5)) };
                  return v;
                });
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
          console.log(`👋 User disconnected: ${id}`);
          playChime("leave");
          cleanupPeer(id);
          // Unpin if pinned peer left
          setPinnedPeerId(prev => prev === id ? null : prev);
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

        // ✅ Socket reconnection handling
        socket.on("connect", () => {
          console.log("🔌 Socket reconnected");
          setSocketStatus("connected");
          const currentPeerId = myPeerIdRef.current;
          if (currentPeerId) {
            socket.emit("join-call", { roomId, peerId: currentPeerId, userName, isMuted: isMutedRef.current, isVideoOff: isVideoOffRef.current });
          }
        });

        socket.on("disconnect", (reason) => {
          console.log("🔌 Socket disconnected:", reason);
          setSocketStatus("disconnected");
          if (reason === "io server disconnect") {
            socket.connect();
          }
        });

        socket.on("connect_error", (error) => {
          console.error("❌ Socket connection error:", error);
          setSocketStatus("error");
          if (connectionTimer.current) {
            clearTimeout(connectionTimer.current);
            connectionTimer.current = null;
          }
          if (isConnectingRef.current) {
            setIsConnecting(false);
          }
          toast.error("Connection error. Attempting to reconnect...");
        });

        socket.on("reconnect_attempt", (attemptNumber) => {
          console.log(`🔄 Reconnection attempt ${attemptNumber}`);
          setSocketStatus("connecting");
        });

        socket.on("reconnect_failed", () => {
          setSocketStatus("error");
          toast.error("Failed to reconnect to server. Please refresh the page.");
        });

        socket.emit("getMediaState", roomId);
      } catch (err) {
        if (connectionTimer.current) {
          clearTimeout(connectionTimer.current);
          connectionTimer.current = null;
        }
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
      socket.off("connection-verified");
      socket.off("peer-connection-status");
      socket.off("connect");
      socket.off("disconnect");
      if (connectionTimer.current) {
        clearTimeout(connectionTimer.current);
        connectionTimer.current = null;
      }
      socket.off("connect_error");
      socket.off("reconnect_attempt");
      socket.off("reconnect_failed");
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [roomId, socket, userName, isAdmin, playChime, setupStreamAudioAnalysis]);

  // ─── Reconnect when remote streams change ───
  useEffect(() => {
    const remotePeerIds = Object.keys(remoteStreams);
    remotePeerIds.forEach(peerId => {
      if (!peers.current[peerId] && peerId !== myPeerId && localStreamRef.current) {
        console.log(`🔄 Auto-reconnecting to ${peerId}`);
        setTimeout(() => {
          try {
            if (peerRef.current && localStreamRef.current) {
              const call = peerRef.current.call(peerId, localStreamRef.current);
              if (call) {
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
                  call.on("close", () => {
                    if (peers.current[remotePeerId]) {
                      try { peers.current[remotePeerId].close(); } catch (e) {}
                      delete peers.current[remotePeerId];
                    }
                  });
                  call.on("error", (e) => {
                    console.error(`Call error with peer ${remotePeerId}:`, e);
                  });
                };
                handleCallEvents(call, peerId);
                peers.current[peerId] = call;
              }
            }
          } catch (e) {
            console.error(`Error auto-reconnecting to ${peerId}:`, e);
          }
        }, 1000);
      }
    });
  }, [remoteStreams, myPeerId]);

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

  // ✅ FIXED: Properly handle local file broadcast with video/audio
  const startLocalFileBroadcast = async (file) => {
    try {
      const videoElement = document.createElement("video");
      broadcastVideoRef.current = videoElement;

      videoElement.src = URL.createObjectURL(file);
      videoElement.playsInline = true;
      videoElement.muted = false;
      videoElement.autoplay = true;
      videoElement.controls = true;
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';

      await new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = resolve;
        videoElement.onerror = reject;
        setTimeout(reject, 10000);
      });

      await videoElement.play();

      let videoStream;
      if (videoElement.captureStream) {
        videoStream = videoElement.captureStream(30);
      } else if (videoElement.mozCaptureStream) {
        videoStream = videoElement.mozCaptureStream(30);
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
        originalVideoTrack: localStream?.getVideoTracks()[0] || null,
        originalAudioTrack: localStream?.getAudioTracks()[0] || null
      };
      setStreamMediaSource(mediaSourceObj);

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = videoStream;
        myVideoRef.current.style.display = 'block';
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

      localMediaRef.current = videoElement;

      socket.emit("screenshare-started", { roomId, peerId: myPeerId });
      socket.emit("media-file-shared", { name: file.name, type: file.type, sharerName: userName });
      setFocusedPeerId("local");
      setActiveMedia({ 
        url: null, 
        playing: true, 
        time: 0, 
        type: "local_stream", 
        name: file.name 
      });

      videoElement.onended = () => {
        toast.info("Video playback ended");
        stopLocalFileBroadcast(mediaSourceObj);
      };

      videoElement.onerror = () => {
        toast.error("Error playing video");
        stopLocalFileBroadcast(mediaSourceObj);
      };

      toast.success(`Now broadcasting: ${file.name}`);
    } catch (e) {
      console.error("Broadcast error:", e);
      toast.error(`Local file streaming failed: ${e.message}`);
      if (broadcastVideoRef.current) {
        broadcastVideoRef.current.pause();
        broadcastVideoRef.current.removeAttribute("src");
        broadcastVideoRef.current.load();
      }
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
        myVideoRef.current.style.display = 'block';
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
      localMediaRef.current = null;
      broadcastVideoRef.current = null;

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
    if (file) {
      if (file.type.startsWith('video/')) {
        startLocalFileBroadcast(file);
      } else {
        toast.error("Please select a video file");
      }
    }
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

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
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
        v.play().catch(e => console.warn("Play error:", e));
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

  const handleTileDoubleClick = (peerId) => {
    setPinnedPeerId(prev => {
      const next = prev === peerId ? null : peerId;
      if (next) {
        setFocusedPeerId(next);
        setLayoutMode("stage");
      } else {
        setFocusedPeerId(null);
        setLayoutMode("grid");
      }
      return next;
    });
  };

  const isLocalBroadcasting = !!streamMediaSource || activeMedia?.type === "local_stream";

  /* ═══════════════════════════════ RENDER HELPERS ═══════════════════════════════ */

  const renderParticipantTiles = () => {
    const tiles = [];

    const isLocalActive = focusedPeerId === "local" || (!focusedPeerId && !activeMedia);
    const localPinned = pinnedPeerId === "local";
    
    const localNetwork = networkStatus;
    const localNetworkColor = localNetwork === "good" ? "#2ed573" : localNetwork === "poor" ? "#ffa502" : "#ff4757";

    const localVolume = volumes.local || 0;

    tiles.push(
      <ParticipantTile
        key="local"
        $isTalking={speakingPeers.local}
        $isActive={isLocalActive}
        $isPinned={localPinned}
        onClick={() => handleTileClick("local")}
        onDoubleClick={() => handleTileDoubleClick("local")}
      >
        {/* Info indicators top-left */}
        <InfoIndicatorContainer>
          {localPinned && (
            <IndicatorBadge $color="#ffc107">
              <FaThumbtack size={10} />
            </IndicatorBadge>
          )}
          <IndicatorBadge $color={localNetworkColor}>
            <FaSignal size={10} />
          </IndicatorBadge>
        </InfoIndicatorContainer>

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
          {/* Dynamic volume meter */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'flex-end',
            gap: '2px',
            marginLeft: '6px',
            height: '8px'
          }}>
            <div style={{ width: '2px', height: `${Math.max(2, localVolume * 0.08)}px`, backgroundColor: '#2ed573', borderRadius: '1px', transition: 'height 0.1s ease' }} />
            <div style={{ width: '2px', height: `${Math.max(2, localVolume * 0.12)}px`, backgroundColor: '#2ed573', borderRadius: '1px', transition: 'height 0.1s ease' }} />
            <div style={{ width: '2px', height: `${Math.max(2, localVolume * 0.06)}px`, backgroundColor: '#2ed573', borderRadius: '1px', transition: 'height 0.1s ease' }} />
          </div>
        </NameTag>
        
        {/* Badge container top-right */}
        <BadgeContainer>
          {isMuted && <StatusBadge $type="muted"><FaMicrophoneSlash /></StatusBadge>}
          {isVideoOff && <StatusBadge $type="video"><FaVideoSlash /></StatusBadge>}
          {isLocalBroadcasting && <StatusBadge $type="broadcast" style={{ background: '#4a9eff' }}><FaDesktop /></StatusBadge>}
        </BadgeContainer>
      </ParticipantTile>
    );

    Object.entries(remoteStreams).forEach(([id, info]) => {
      const peerState = participantStates[id] || {};
      const peerVideoOff = peerState.isVideoOff;
      const peerMuted = peerState.isMuted;
      const isActive = focusedPeerId === id;
      const isPinned = pinnedPeerId === id;

      const peerNetwork = peerNetworkStatus[id] || "good";
      const peerNetworkColor = peerNetwork === "good" ? "#2ed573" : peerNetwork === "poor" ? "#ffa502" : "#ff4757";

      const peerVolume = volumes[id] || 0;

      tiles.push(
        <ParticipantTile
          key={id}
          $isTalking={speakingPeers[id]}
          $isActive={isActive}
          $isPinned={isPinned}
          onClick={() => handleTileClick(id)}
          onDoubleClick={() => handleTileDoubleClick(id)}
        >
          {/* Info indicators top-left */}
          <InfoIndicatorContainer>
            {isPinned && (
              <IndicatorBadge $color="#ffc107">
                <FaThumbtack size={10} />
              </IndicatorBadge>
            )}
            <IndicatorBadge $color={peerNetworkColor}>
              <FaSignal size={10} />
            </IndicatorBadge>
          </InfoIndicatorContainer>

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
            {/* Dynamic volume meter */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'flex-end',
              gap: '2px',
              marginLeft: '6px',
              height: '8px'
            }}>
              <div style={{ width: '2px', height: `${Math.max(2, peerVolume * 0.08)}px`, backgroundColor: '#2ed573', borderRadius: '1px', transition: 'height 0.1s ease' }} />
              <div style={{ width: '2px', height: `${Math.max(2, peerVolume * 0.12)}px`, backgroundColor: '#2ed573', borderRadius: '1px', transition: 'height 0.1s ease' }} />
              <div style={{ width: '2px', height: `${Math.max(2, peerVolume * 0.06)}px`, backgroundColor: '#2ed573', borderRadius: '1px', transition: 'height 0.1s ease' }} />
            </div>
          </NameTag>
          
          {/* Badge container top-right */}
          <BadgeContainer>
            {peerMuted && <StatusBadge $type="muted"><FaMicrophoneSlash /></StatusBadge>}
            {peerVideoOff && <StatusBadge $type="video"><FaVideoSlash /></StatusBadge>}
          </BadgeContainer>
        </ParticipantTile>
      );
    });

    return tiles;
  };

  const renderMainContent = () => {
    if (isConnecting) {
      return (
        <Overlay>
          <ConnectingSpinner />
          <h3>Connecting to meeting...</h3>
          <p>Setting up your camera and microphone</p>
        </Overlay>
      );
    }

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
          <FocusedPeerOverlay>
            <span>Viewing: {focusedName}</span>
            <FocusedPeerCloseButton 
              onClick={() => { setFocusedPeerId(null); setLayoutMode("grid"); }}
            >
              ✕
            </FocusedPeerCloseButton>
          </FocusedPeerOverlay>
          {focusedIsTalking && (
            <SpeakingIndicator>
              <span style={{ width: 8, height: 8, background: '#2ed573', borderRadius: '50%', display: 'inline-block' }} />
              Speaking
            </SpeakingIndicator>
          )}
        </>
      );
    }

    if (activeMedia) {
      return (
        <>
          {activeMedia.url?.includes("youtu") ? (
            <div id="youtube-sync-player" style={{ width: '100%', height: '100%' }} />
          ) : activeMedia.type === "local_stream" ? (
            <video
              ref={broadcastVideoRef}
              playsInline
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onPlay={() => handleMediaAction("play")}
              onPause={() => handleMediaAction("pause")}
              onSeeked={() => handleMediaAction("seek")}
              onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
            />
          ) : (
            <video
              ref={mediaRef}
              src={activeMedia.url}
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onPlay={() => handleMediaAction("play")}
              onPause={() => handleMediaAction("pause")}
              onSeeked={() => handleMediaAction("seek")}
              onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
            />
          )}
          
          {(isAdmin || activeMedia.type !== "local_stream") && (
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

    if (remoteFileBroadcast && !isAdmin) {
      return (
        <BroadcastOverlay>
          <FaDesktop size={48} style={{ opacity: 0.3 }} />
          <ShimmerText>
            {remoteFileBroadcast.sharerName || "Admin"} is streaming: {remoteFileBroadcast.name || "Media"}
          </ShimmerText>
          <span style={{ fontSize: 'clamp(0.6rem, 1vw, 0.8rem)', opacity: 0.4, textAlign: 'center' }}>
            Audio and video are streamed live via the call
          </span>
        </BroadcastOverlay>
      );
    }

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

  const getActiveMiniStream = () => {
    if (focusedPeerId) {
      if (focusedPeerId === "local") return { type: "local", stream: localStream, name: userName, isVideoOff, isMuted };
      const info = remoteStreams[focusedPeerId];
      const peerState = participantStates[focusedPeerId] || {};
      return { type: "remote", stream: info?.stream, name: info?.name || "Participant", isVideoOff: peerState.isVideoOff, isMuted: peerState.isMuted, id: focusedPeerId };
    }
    const remKeys = Object.keys(remoteStreams);
    if (remKeys.length > 0) {
      const id = remKeys[0];
      const info = remoteStreams[id];
      const peerState = participantStates[id] || {};
      return { type: "remote", stream: info?.stream, name: info?.name || "Participant", isVideoOff: peerState.isVideoOff, isMuted: peerState.isMuted, id };
    }
    return { type: "local", stream: localStream, name: userName, isVideoOff, isMuted };
  };

  /* ═══════════════════════════════ MAIN RENDER ═══════════════════════════════ */
  return (
    <StyleSheetManager shouldForwardProp={(prop) => !prop.startsWith('$')}>
      {!isAdmin && (
        <style>{`@media print { body { display: none !important; } }`}</style>
      )}
      {screenLocked && (
        <div style={{
          position: "fixed", inset: 0, background: "#000", zIndex: 999999,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          color: "#fff", fontFamily: "sans-serif", textAlign: "center", padding: 20
        }}>
          <div style={{ fontSize: "3rem", marginBottom: 15 }}>🔒</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Protected Content</h2>
          <p style={{ opacity: .7, maxWidth: 340, fontSize: "0.85rem", lineHeight: 1.5 }}>
            Screenshots, recordings, and background viewing are disabled during this call.
          </p>
        </div>
      )}
      <MeetingContainer ref={containerRef} $minimized={isMinimized} onClick={isMinimized ? () => setIsMinimized(false) : undefined}>
        <GradientBackground />

        {isMinimized && (() => {
          const mini = getActiveMiniStream();
          return (
            <PipContainer onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}>
              {mini.isVideoOff || !mini.stream ? (
                <PipAvatarWrapper>
                  <PipAvatar>{getInitials(mini.name)}</PipAvatar>
                </PipAvatarWrapper>
              ) : (
                <video
                  autoPlay
                  playsInline
                  muted={mini.type === "local"}
                  ref={el => {
                    if (el && mini.stream && el.srcObject !== mini.stream) {
                      el.srcObject = mini.stream;
                    }
                  }}
                />
              )}
              {/* Floating controls overlays */}
              <PipControlsOverlay>
                <PipBubbleButton 
                  title={isMuted ? "Unmute" : "Mute"} 
                  $active={isMuted} 
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                >
                  {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                </PipBubbleButton>
                <PipBubbleButton 
                  title={isVideoOff ? "Start Video" : "Stop Video"} 
                  $active={isVideoOff} 
                  onClick={(e) => { e.stopPropagation(); toggleVideo(); }}
                >
                  {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
                </PipBubbleButton>
                <PipBubbleButton 
                  title="Expand" 
                  onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                >
                  <FaExpand />
                </PipBubbleButton>
              </PipControlsOverlay>
            </PipContainer>
          );
        })()}
        
        <MeetingHeader className="meeting-header">
          <HeaderLeft>
            <Logo>
              <span className="logo-dot" />
              <span>Meet</span>
            </Logo>
            {!isMinimized && (
              <>
                <StatusIndicator $status={networkStatus}>
                  {networkStatus === 'good' && <FaWifi size={12} />}
                  {networkStatus === 'poor' && <FaSignal size={12} />}
                  {networkStatus === 'fallback' && <FaSignal size={12} />}
                  {networkStatus === 'good' ? 'Excellent' : networkStatus === 'poor' ? 'Weak' : 'Low BW'}
                </StatusIndicator>
                <StatusIndicator $status={socketStatus === 'connected' ? 'good' : socketStatus === 'connecting' ? 'poor' : 'fallback'}>
                  {socketStatus === 'connected' && <FaCheckCircle size={12} />}
                  {socketStatus === 'connecting' && <FaSync size={12} style={{ animation: `${spin} 1s linear infinite` }} />}
                  {socketStatus !== 'connected' && socketStatus !== 'connecting' && <FaTimesCircle size={12} />}
                  {socketStatus === 'connected' ? 'Socket Connected' : socketStatus === 'connecting' ? 'Socket Connecting' : 'Socket Disconnected'}
                </StatusIndicator>
                <span style={{ fontSize: 'clamp(0.6rem, 0.9vw, 0.75rem)', opacity: 0.5 }}>
                  {formatDuration(callDuration)}
                </span>
              </>
            )}
          </HeaderLeft>
          <HeaderRight>
            {!isMinimized && (
              <>
                <ControlButton
                  style={{ width: 'clamp(32px, 4vw, 38px)', height: 'clamp(32px, 4vw, 38px)', fontSize: '0.8rem', position: 'relative' }}
                  onClick={() => setShowParticipants(!showParticipants)}
                  title="Participants"
                >
                  <FaUsers />
                  {totalParticipantsCount > 1 && <span className="badge">{totalParticipantsCount}</span>}
                </ControlButton>
                {showParticipants && (
                  <ParticipantPopover>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>Participants ({totalParticipantsCount})</span>
                      <button 
                        onClick={() => setShowParticipants(false)} 
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}
                      >
                        <FaTimes />
                      </button>
                    </div>
                    {allParticipants.map(p => (
                      <ParticipantRow key={p.id}>
                        <ParticipantAvatar>{getInitials(p.name)}</ParticipantAvatar>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}{p.id === 'local' ? ' (You)' : ''}
                        </span>
                        {p.isMuted && <FaMicrophoneSlash size={12} style={{ color: '#ff4757', flexShrink: 0 }} />}
                        {p.isVideoOff && <FaVideoSlash size={12} style={{ color: '#ff4757', flexShrink: 0 }} />}
                        {speakingPeers[p.id] && <span style={{ color: '#2ed573', fontSize: '0.6rem', fontWeight: 600 }}>🔊</span>}
                      </ParticipantRow>
                    ))}
                  </ParticipantPopover>
                )}
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
              </>
            )}
            <ControlButton
              style={{ width: 'clamp(32px, 4vw, 38px)', height: 'clamp(32px, 4vw, 38px)', fontSize: '0.8rem' }}
              onClick={toggleMinimize}
              title={isMinimized ? "Expand" : "Minimize"}
            >
              <FaWindowMinimize />
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

        {!isMinimized && (
          <ContentArea className="content-area">
            <MainVideoArea className="main-video-area">
              {renderMainContent()}
              
              {reactions.map(r => (
                <ReactionFloat key={r.id} $x={r.x}>
                  {r.emoji}
                </ReactionFloat>
              ))}
              
              {isSyncing && !isConnecting && (
                <SyncIndicator>
                  <FaSync /> Syncing...
                </SyncIndicator>
              )}
            </MainVideoArea>

            <ParticipantSidebar className="participant-sidebar">
              {renderParticipantTiles()}
            </ParticipantSidebar>
          </ContentArea>
        )}

        {!isMinimized && (
          <ControlsBar className="controls-bar">
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
        )}

        {showUrlInput && !isMinimized && (
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
      </MeetingContainer>
    </StyleSheetManager>
  );
}