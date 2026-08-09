import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash, FaSync, FaDesktop, FaFolderOpen, FaRecordVinyl, FaCompress, FaExpand, FaWindowMinimize, FaExchangeAlt, FaLink, FaThLarge, FaStop, FaUsers, FaTimes, FaHandPaper, FaPlay, FaPause, FaStepBackward, FaStepForward, FaTachometerAlt } from "react-icons/fa";
import { Peer } from "peerjs";
import { toast } from "react-toastify";

/* ═══════════════════════════════ ANIMATIONS ═══════════════════════════════ */
const fadeIn = keyframes`from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); }`;
const slideUp = keyframes`from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); }`;
const floatUp = keyframes`0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-700px) scale(2.5); opacity: 0; }`;
const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
const pulse = keyframes`0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(255, 71, 87, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }`;
const shimmer = keyframes`0% { background-position: -200% 0; } 100% { background-position: 200% 0; }`;
const tileEnter = keyframes`from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); }`;

/* ═══════════════════════════════ STYLED COMPONENTS ═══════════════════════════════ */
const MeetingOverlay = styled.div`
  position: fixed;
  inset: 20px;
  z-index: 10005;
  background: var(--chakra-colors-glassBg, rgba(20, 20, 30, 0.92));
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  display: flex;
  flex-direction: column;
  color: var(--chakra-colors-textPrimary, #ffffff);
  padding: 20px;
  overflow: hidden;
  border-radius: 32px;
  border: 1px solid var(--chakra-colors-border, rgba(255,255,255,0.08));
  box-shadow: 0 50px 100px rgba(0, 0, 0, 0.25);
  animation: ${fadeIn} 0.35s ease-out;
  transition: all 0.3s ease;

  ${p => p.$minimized && `
    inset: auto 16px 16px auto;
    width: min(340px, calc(100vw - 32px));
    height: 200px;
    min-height: 0;
    padding: 10px;
    border-radius: 20px;
    cursor: pointer;
    background: var(--chakra-colors-surface, rgba(30, 30, 45, 0.95));
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  `}

  @media (max-width: 768px) {
    inset: 0;
    border-radius: 0;
    padding: 12px 10px;
    background: var(--chakra-colors-bg, #0a0a12);
    
    ${p => p.$minimized && `
      inset: auto 8px calc(8px + env(safe-area-inset-bottom)) auto;
      width: min(300px, calc(100vw - 16px));
      height: 160px;
      padding: 8px;
      border-radius: 16px;
      background: var(--chakra-colors-surface, rgba(30, 30, 45, 0.95));
    `}
  }

  @media (max-width: 480px) {
    padding: 8px 6px;
    
    ${p => p.$minimized && `
      width: min(280px, calc(100vw - 12px));
      height: 140px;
      padding: 6px;
      border-radius: 14px;
    `}
  }
`;

const MeetingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  width: 100%;
  height: 50px;
  flex-shrink: 0;
  padding: 0 8px;
  gap: 8px;
  
  ${p => p.$minimized && `
    height: 32px;
    margin-bottom: 6px;
    padding: 0 4px;
  `}

  @media (max-width: 768px) {
    height: 40px;
    margin-bottom: 8px;
    padding: 0 4px;
    gap: 4px;
  }

  @media (max-width: 480px) {
    height: 36px;
    margin-bottom: 6px;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;

  @media (max-width: 768px) {
    gap: 6px;
  }

  @media (max-width: 480px) {
    gap: 4px;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  gap: 4px;
  background: var(--chakra-colors-badgeBg, rgba(255,255,255,0.05));
  padding: 4px;
  border-radius: 14px;
  border: 1px solid var(--chakra-colors-badgeBorder, rgba(255,255,255,0.06));
  align-items: center;
  flex-shrink: 0;

  @media (max-width: 768px) {
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
  }

  @media (max-width: 480px) {
    gap: 1px;
    padding: 2px;
    border-radius: 8px;
  }
`;

const ContentLayout = styled.div`
  display: flex;
  flex: 1;
  gap: 16px;
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
    gap: 12px;
  }

  @media (max-width: 768px) {
    gap: 8px;
  }

  @media (max-width: 480px) {
    gap: 6px;
  }
`;

const MainStage = styled.div`
  flex: 3;
  background: var(--chakra-colors-bg, #0a0a12);
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--chakra-colors-border, rgba(255,255,255,0.06));
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);

  @media (max-width: 768px) {
    border-radius: 16px;
    min-height: 150px;
  }

  @media (max-width: 480px) {
    border-radius: 12px;
    min-height: 120px;
  }

  ${p => p.$minimized && `
    flex: 1;
    min-height: 0;
    border-radius: 12px;
    video { object-fit: cover !important; }
  `}
`;

const ParticipantGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;

  @media (max-width: 1024px) {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px 4px;
    max-height: 140px;
    gap: 10px;
    &::-webkit-scrollbar { display: none; }
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  @media (max-width: 768px) {
    max-height: 110px;
    padding: 6px 4px 60px;
    gap: 8px;
  }

  @media (max-width: 480px) {
    max-height: 90px;
    padding: 4px 2px 50px;
    gap: 6px;
  }
`;

const VideoTile = styled.div`
  background: var(--chakra-colors-cardBg, rgba(255,255,255,0.03));
  backdrop-filter: blur(16px);
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 16/9;
  border: 2px solid ${props => props.$isTalking ? "#2ed573" : "var(--chakra-colors-border, rgba(255,255,255,0.06))"};
  box-shadow: ${props => props.$isTalking
    ? "0 0 25px rgba(46, 213, 115, 0.3)"
    : "0 8px 24px rgba(0, 0, 0, 0.1)"};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  flex-shrink: 0;
  width: 100%;
  height: 100%;
  animation: ${tileEnter} 0.4s ease-out;

  ${props => props.$isStrip && `
    width: auto;
    height: 100%;
    min-width: 160px;
    
    @media (max-width: 1024px) {
      min-width: 140px;
      width: clamp(120px, 25vw, 160px);
      height: auto;
    }
    
    @media (max-width: 768px) {
      min-width: 100px;
      width: clamp(80px, 20vw, 120px);
    }
    
    @media (max-width: 480px) {
      min-width: 70px;
      width: clamp(60px, 18vw, 90px);
    }
  `}

  &:hover {
    transform: translateY(-2px) scale(1.02);
    border-color: ${props => props.$isTalking ? "#2ed573" : "var(--chakra-colors-brandPrimary, #4a9eff)"};
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: 768px) {
    border-radius: 14px;
  }

  @media (max-width: 480px) {
    border-radius: 10px;
    border-width: 1.5px;
  }
`;

const NameTag = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: var(--chakra-colors-glassBg, rgba(0,0,0,0.6));
  color: var(--chakra-colors-textPrimary, #ffffff);
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid var(--chakra-colors-borderSubtle, rgba(255,255,255,0.06));
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 90%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 768px) {
    font-size: 0.6rem;
    padding: 3px 8px;
    bottom: 6px;
    left: 6px;
    border-radius: 8px;
    gap: 4px;
  }

  @media (max-width: 480px) {
    font-size: 0.5rem;
    padding: 2px 6px;
    bottom: 4px;
    left: 4px;
    border-radius: 6px;
    gap: 3px;
  }
`;

const ControlBar = styled.div`
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--chakra-colors-glassBg, rgba(0,0,0,0.7));
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  border-radius: 20px;
  border: 1px solid var(--chakra-colors-border, rgba(255,255,255,0.08));
  padding: 6px 14px;
  z-index: 500;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: ${slideUp} 0.4s ease-out;
  max-width: 92%;
  
  ${p => p.$minimized && `display: none;`}

  &:hover {
    background: var(--chakra-colors-surfaceHover, rgba(30,30,50,0.85));
  }

  @media (max-width: 768px) {
    bottom: 12px;
    padding: 5px 10px;
    gap: 4px;
    width: 96%;
    max-width: 96%;
    overflow-x: auto;
    justify-content: safe center;
    border-radius: 14px;
    flex-wrap: nowrap;
    &::-webkit-scrollbar { display: none; }
    -ms-overflow-style: none;
    scrollbar-width: none;
    white-space: nowrap;
  }

  @media (max-width: 480px) {
    bottom: 8px;
    padding: 4px 8px;
    gap: 3px;
    border-radius: 12px;
    width: 98%;
  }
`;

const CircleButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid ${props => props.$active ? "rgba(255, 71, 87, 0.5)" : "var(--chakra-colors-badgeBorder, rgba(255,255,255,0.06))"};
  background: ${props => props.$active ? "#ff4757" : "var(--chakra-colors-badgeBg, rgba(255,255,255,0.05))"};
  color: var(--chakra-colors-textPrimary, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  position: relative;

  @media (max-width: 768px) {
    width: 38px;
    height: 38px;
    font-size: 0.85rem;
    border-radius: 10px;
  }

  @media (max-width: 480px) {
    width: 32px;
    height: 32px;
    font-size: 0.7rem;
    border-radius: 8px;
  }

  &:hover {
    transform: translateY(-1px);
    background: ${props => props.$active ? "#ff6b81" : "var(--chakra-colors-surfaceHover, rgba(255,255,255,0.08))"};
    border-color: ${props => props.$active ? "rgba(255, 71, 87, 0.8)" : "var(--chakra-colors-brandPrimary, #4a9eff)"};
  }

  &:active {
    transform: translateY(0);
  }
`;

const ControlLabel = styled.span`
  position: absolute;
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.5rem;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0.5;
  pointer-events: none;
  color: var(--chakra-colors-textSecondary, rgba(255,255,255,0.5));

  @media (max-width: 768px) {
    display: none;
  }
`;

const Divider = styled.div`
  width: 1px;
  height: 24px;
  background: var(--chakra-colors-border, rgba(255,255,255,0.08));
  margin: 0 2px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    height: 20px;
  }

  @media (max-width: 480px) {
    height: 16px;
  }
`;

const FloatingPiP = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  width: 120px;
  height: 160px;
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid var(--chakra-colors-border, rgba(255,255,255,0.1));
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  z-index: 100;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.05);
    border-color: var(--chakra-colors-brandPrimary, #4a9eff);
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: 768px) {
    width: 90px;
    height: 120px;
    top: 12px;
    right: 12px;
    border-radius: 12px;
  }

  @media (max-width: 480px) {
    width: 70px;
    height: 93px;
    top: 8px;
    right: 8px;
    border-radius: 10px;
  }
`;

const PrivacyGuard = styled.div`
  position: absolute;
  inset: 0;
  z-index: 200;
  background: var(--chakra-colors-bg, #0a0a12);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--chakra-colors-textPrimary, #ffffff);
  opacity: ${props => props.$minimized ? 0 : props.show ? 1 : 0};
  pointer-events: ${props => props.$minimized ? "none" : props.show ? "all" : "none"};
  transition: opacity 0.3s ease;

  h3 { font-size: 1.3rem; margin-bottom: 8px; }
  p { font-size: 0.9rem; opacity: 0.7; }

  @media (max-width: 768px) {
    h3 { font-size: 1rem; }
    p { font-size: 0.75rem; }
  }

  @media (max-width: 480px) {
    h3 { font-size: 0.85rem; }
    p { font-size: 0.65rem; }
  }

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(45deg, var(--chakra-colors-bg, #0a0a12), var(--chakra-colors-bg, #0a0a12) 10px, var(--chakra-colors-surface, rgba(30,30,45,0.5)) 10px, var(--chakra-colors-surface, rgba(30,30,45,0.5)) 20px);
    opacity: 0.9;
  }
`;

const Watermark = styled.div`
  position: absolute;
  top: ${props => props.y}%;
  left: ${props => props.x}%;
  opacity: 0.08;
  font-size: 0.7rem;
  color: var(--chakra-colors-textPrimary, #ffffff);
  pointer-events: none;
  z-index: 50;
  white-space: nowrap;
  transition: all 8s linear;

  @media (max-width: 768px) {
    font-size: 0.5rem;
  }
`;

const MeetingGrid = styled.div`
  display: grid;
  width: 100%;
  height: 100%;
  gap: 12px;
  padding: 8px;
  box-sizing: border-box;
  align-content: center;
  justify-content: center;
  overflow-y: auto;

  grid-template-columns: ${props => {
    const count = props.$count;
    if (count === 1) return "1fr";
    if (count === 2) return "1fr 1fr";
    if (count <= 4) return "1fr 1fr";
    return "repeat(auto-fit, minmax(240px, 1fr))";
  }};
  grid-template-rows: ${props => {
    const count = props.$count;
    if (count <= 2) return "1fr";
    if (count <= 4) return "1fr 1fr";
    return "repeat(auto-fit, minmax(180px, 1fr))";
  }};

  @media (max-width: 768px) {
    gap: 8px;
    padding: 6px;
    grid-template-columns: ${props => {
      const count = props.$count;
      if (count === 1) return "1fr";
      return "1fr 1fr";
    }};
    grid-template-rows: auto;
  }

  @media (max-width: 480px) {
    gap: 6px;
    padding: 4px;
  }
`;

const PlaceholderAvatar = styled.div`
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, var(--chakra-colors-surface, rgba(30,30,45,0.5)) 0%, var(--chakra-colors-bg, #0a0a12) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const AvatarCircle = styled.div`
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary, #4a9eff) 0%, var(--chakra-colors-brandSecondary, #6c5ce7) 100%);
  color: white;
  font-size: 1.8rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  border: 3px solid var(--chakra-colors-border, rgba(255,255,255,0.08));
  position: relative;
  transition: all 0.3s ease;

  ${props => props.$isTalking && `
    border-color: #2ed573;
    box-shadow: 0 0 30px rgba(46, 213, 115, 0.4);
    transform: scale(1.05);
  `}

  @media (max-width: 768px) {
    width: 50px;
    height: 50px;
    font-size: 1.2rem;
    border-width: 2px;
  }

  @media (max-width: 480px) {
    width: 40px;
    height: 40px;
    font-size: 1rem;
    border-width: 2px;
  }
`;

const MutedBadge = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 71, 87, 0.85);
  color: white;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  backdrop-filter: blur(5px);
  border: 1px solid var(--chakra-colors-border, rgba(255,255,255,0.06));

  @media (max-width: 768px) {
    width: 18px;
    height: 18px;
    font-size: 0.6rem;
    top: 6px;
    right: 6px;
  }
`;

const ParticipantBadge = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--chakra-colors-badgeBg, rgba(255,255,255,0.05));
  border: 1px solid var(--chakra-colors-badgeBorder, rgba(255,255,255,0.06));
  padding: 4px 8px;
  border-radius: 10px;
  color: var(--chakra-colors-textPrimary, #ffffff);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  white-space: nowrap;

  &:hover {
    background: var(--chakra-colors-surfaceHover, rgba(255,255,255,0.08));
    border-color: var(--chakra-colors-brandPrimary, #4a9eff);
  }

  @media (max-width: 768px) {
    padding: 3px 6px;
    font-size: 0.6rem;
    border-radius: 8px;
  }
`;

const ParticipantPopover = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: var(--chakra-colors-surface, rgba(20,20,35,0.95));
  backdrop-filter: blur(24px);
  border: 1px solid var(--chakra-colors-border, rgba(255,255,255,0.06));
  border-radius: 14px;
  padding: 10px;
  min-width: 180px;
  max-height: 260px;
  overflow-y: auto;
  z-index: 600;
  box-shadow: 0 20px 50px rgba(0,0,0,0.3);
  color: var(--chakra-colors-textPrimary, #ffffff);
  animation: ${slideUp} 0.2s ease-out;

  @media (max-width: 768px) {
    min-width: 150px;
    padding: 8px;
    border-radius: 12px;
  }
`;

const ParticipantRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;

  &:hover { background: var(--chakra-colors-surfaceHover, rgba(255,255,255,0.05)); }

  @media (max-width: 768px) {
    font-size: 0.65rem;
    padding: 3px 4px;
  }
`;

const ParticipantDot = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary, #4a9eff), var(--chakra-colors-brandSecondary, #6c5ce7));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
  color: white;

  @media (max-width: 768px) {
    width: 20px;
    height: 20px;
    font-size: 0.5rem;
  }
`;

const ConnectingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 300;
  background: var(--chakra-colors-bg, #0a0a12);
  color: var(--chakra-colors-textPrimary, #ffffff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  animation: ${fadeIn} 0.3s ease-out;

  @media (max-width: 768px) {
    gap: 8px;
  }
`;

const SpinnerRing = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid var(--chakra-colors-border, rgba(255,255,255,0.06));
  border-top-color: var(--chakra-colors-brandPrimary, #4a9eff);
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;

  @media (max-width: 768px) {
    width: 30px;
    height: 30px;
    border-width: 2px;
  }
`;

const StatusChip = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--chakra-colors-badgeBg, rgba(255,255,255,0.05));
  color: var(--chakra-colors-textPrimary, #ffffff);
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 0.65rem;
  font-weight: 600;

  @media (max-width: 768px) {
    font-size: 0.55rem;
    padding: 2px 6px;
    border-radius: 8px;
  }
`;

const TimerDisplay = styled.span`
  font-size: 0.65rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
  padding: 3px 8px;
  background: var(--chakra-colors-badgeBg, rgba(255,255,255,0.05));
  color: var(--chakra-colors-textPrimary, #ffffff);
  border-radius: 10px;

  @media (max-width: 768px) {
    font-size: 0.55rem;
    padding: 2px 6px;
    border-radius: 8px;
  }
`;

const UrlInputOverlay = styled.div`
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--chakra-colors-surface, rgba(20,20,35,0.95));
  border: 1px solid var(--chakra-colors-border, rgba(255,255,255,0.06));
  color: var(--chakra-colors-textPrimary, #ffffff);
  padding: 14px;
  border-radius: 18px;
  z-index: 1000;
  display: flex;
  gap: 8px;
  width: min(400px, 90%);
  box-shadow: 0 20px 50px rgba(0,0,0,0.3);
  animation: ${slideUp} 0.25s ease-out;

  @media (max-width: 768px) {
    bottom: 70px;
    padding: 12px;
    border-radius: 14px;
    gap: 6px;
    width: 92%;
  }

  @media (max-width: 480px) {
    bottom: 60px;
    padding: 10px;
    border-radius: 12px;
    gap: 4px;
    width: 94%;
  }
`;

const FileBroadcastOverlay = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: radial-gradient(circle at center, var(--chakra-colors-badgeBg, rgba(255,255,255,0.03)), transparent 70%);
  padding: 20px;

  .shimmer-text {
    font-size: 0.95rem;
    font-weight: 600;
    background: linear-gradient(90deg, var(--chakra-colors-textMuted, rgba(255,255,255,0.3)), var(--chakra-colors-textPrimary, #ffffff), var(--chakra-colors-textMuted, rgba(255,255,255,0.3)));
    background-size: 200% 100%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: ${shimmer} 2s linear infinite;
    text-align: center;
  }

  @media (max-width: 768px) {
    gap: 8px;
    padding: 16px;
    
    .shimmer-text {
      font-size: 0.8rem;
    }
  }

  @media (max-width: 480px) {
    gap: 6px;
    padding: 12px;
    
    .shimmer-text {
      font-size: 0.7rem;
    }
  }
`;

const MediaControls = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--chakra-colors-badgeBg, rgba(0,0,0,0.3));
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid var(--chakra-colors-border, rgba(255,255,255,0.06));

  @media (max-width: 768px) {
    padding: 3px 6px;
    gap: 3px;
    border-radius: 10px;
  }

  @media (max-width: 480px) {
    padding: 2px 4px;
    gap: 2px;
    border-radius: 8px;
  }
`;

const MediaControlButton = styled.button`
  background: transparent;
  border: none;
  color: var(--chakra-colors-textPrimary, #ffffff);
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    background: var(--chakra-colors-surfaceHover, rgba(255,255,255,0.08));
  }

  @media (max-width: 768px) {
    padding: 2px 4px;
    font-size: 0.75rem;
    border-radius: 4px;
  }

  @media (max-width: 480px) {
    padding: 2px 3px;
    font-size: 0.65rem;
  }
`;

const SpeedControl = styled.select`
  background: var(--chakra-colors-badgeBg, rgba(255,255,255,0.05));
  border: 1px solid var(--chakra-colors-border, rgba(255,255,255,0.06));
  color: var(--chakra-colors-textPrimary, #ffffff);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 0.7rem;
  cursor: pointer;

  @media (max-width: 768px) {
    font-size: 0.6rem;
    padding: 2px 4px;
  }
`;

const SeekBar = styled.input`
  width: 100px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--chakra-colors-border, rgba(255,255,255,0.1));
  border-radius: 2px;
  outline: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--chakra-colors-brandPrimary, #4a9eff);
    cursor: pointer;
    border: 2px solid var(--chakra-colors-bg, #0a0a12);
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--chakra-colors-brandPrimary, #4a9eff);
    cursor: pointer;
    border: 2px solid var(--chakra-colors-bg, #0a0a12);
  }

  @media (max-width: 768px) {
    width: 60px;
    
    &::-webkit-slider-thumb {
      width: 12px;
      height: 12px;
    }
  }

  @media (max-width: 480px) {
    width: 40px;
    
    &::-webkit-slider-thumb {
      width: 10px;
      height: 10px;
    }
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
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [localPlaybackState, setLocalPlaybackState] = useState({ playing: false, time: 0, duration: 0 });
  const [videoDuration, setVideoDuration] = useState(0);

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

  // ─── Get controlled media element ───
  const getControlledMedia = useCallback(() => {
    if (activeMedia?.type === "local_stream") {
      return localMediaRef.current;
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

  // ─── Auto-focus active talker ───
  useEffect(() => {
    const activeTalker = Object.entries(speakingPeers).find(([id, isTalking]) => isTalking && id !== "local");
    if (activeTalker && layoutMode !== "stage") {
      setFocusedPeerId(activeTalker[0]);
    }
  }, [speakingPeers, layoutMode]);

  // ─── Auto-focus single remote peer ───
  useEffect(() => {
    const entries = Object.entries(remoteStreams);
    if (entries.length === 1 && !activeMedia && layoutMode !== "stage") {
      setFocusedPeerId(entries[0][0]);
    }
  }, [remoteStreams, activeMedia, layoutMode]);

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
        time: v.currentTime,
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
      if (!isRemoteUpdate.current) {
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
  const ytPlayerRef = useRef(null);

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
      localMediaRef.current = videoElement;
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
    const v = getControlledMedia();
    if (!v || isRemoteUpdate.current) return;

    const data = {
      url: activeMedia?.url,
      playing: action === "play" || (action === "seek" && !v.paused),
      time: v.currentTime,
      sender: userName
    };
    setActiveMedia(data);
    socket.emit("syncMedia", data);
  };

  const handleSeek = (value) => {
    const v = getControlledMedia();
    if (!v || isRemoteUpdate.current) return;
    v.currentTime = parseFloat(value);
    handleMediaAction("seek");
  };

  const handleSpeedChange = (speed) => {
    const v = getControlledMedia();
    if (!v) return;
    v.playbackRate = parseFloat(speed);
    setPlaybackSpeed(parseFloat(speed));
  };

  const handleSkip = (seconds) => {
    const v = getControlledMedia();
    if (!v || isRemoteUpdate.current) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seconds));
    handleMediaAction("seek");
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

  const togglePlayPause = () => {
    const v = getControlledMedia();
    if (!v || isRemoteUpdate.current) return;
    
    if (v.paused) {
      v.play();
      handleMediaAction("play");
    } else {
      v.pause();
      handleMediaAction("pause");
    }
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
          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", padding: "4px 12px", borderRadius: 16, display: "flex", alignItems: "center", gap: 8, zIndex: 100, fontSize: "clamp(0.6rem, 1vw, 0.8rem)" }}>
            <span>Viewing: {focusedPeerId === "local" ? "You" : remoteStreams[focusedPeerId]?.name}</span>
            <button onClick={() => { setFocusedPeerId(null); setLayoutMode("grid"); }} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
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
            <FileBroadcastOverlay>
              <FaDesktop size={48} style={{ opacity: 0.3 }} />
              <div className="shimmer-text">{remoteFileBroadcast?.sharerName || "Admin"} is streaming: {remoteFileBroadcast?.name || activeMedia.name || "Media"}</div>
              <span style={{ fontSize: "0.8rem", opacity: 0.4 }}>Audio and video are streamed live via the call</span>
            </FileBroadcastOverlay>
          ) : (
            <>
              <video
                ref={mediaRef}
                src={activeMedia.url}
                playsInline
                style={{ width: "100%", height: "100%" }}
                onPlay={() => handleMediaAction("play")}
                onPause={() => handleMediaAction("pause")}
                onSeeked={() => handleMediaAction("seek")}
                onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
              />
              {/* Media Controls Overlay */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.8))", padding: "clamp(12px, 2vw, 20px) clamp(10px, 1.5vw, 16px) clamp(8px, 1vw, 12px)", zIndex: 50 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "clamp(4px, 1vw, 8px)", flexWrap: "wrap" }}>
                  <MediaControls>
                    <MediaControlButton onClick={() => handleSkip(-30)} title="-30s">
                      <FaStepBackward />
                    </MediaControlButton>
                    <MediaControlButton onClick={() => handleSkip(-10)} title="-10s">
                      <FaStepBackward style={{ fontSize: "0.7rem" }} />
                    </MediaControlButton>
                    <MediaControlButton onClick={togglePlayPause} style={{ fontSize: "clamp(1rem, 1.5vw, 1.2rem)" }}>
                      {localPlaybackState.playing ? <FaPause /> : <FaPlay />}
                    </MediaControlButton>
                    <MediaControlButton onClick={() => handleSkip(10)} title="+10s">
                      <FaStepForward style={{ fontSize: "0.7rem" }} />
                    </MediaControlButton>
                    <MediaControlButton onClick={() => handleSkip(30)} title="+30s">
                      <FaStepForward />
                    </MediaControlButton>
                  </MediaControls>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "clamp(4px, 1vw, 8px)", flex: 1, minWidth: "clamp(80px, 20vw, 120px)" }}>
                    <span style={{ fontSize: "clamp(0.5rem, 0.8vw, 0.65rem)", opacity: 0.7, whiteSpace: "nowrap" }}>
                      {formatDuration(localPlaybackState.time)} / {formatDuration(videoDuration)}
                    </span>
                    <SeekBar
                      type="range"
                      min="0"
                      max={videoDuration || 0}
                      step="0.1"
                      value={localPlaybackState.time || 0}
                      onChange={(e) => handleSeek(e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <FaTachometerAlt style={{ fontSize: "0.7rem", opacity: 0.5 }} />
                    <SpeedControl
                      value={playbackSpeed}
                      onChange={(e) => handleSpeedChange(e.target.value)}
                    >
                      <option value="0.5">0.5x</option>
                      <option value="0.75">0.75x</option>
                      <option value="1">1x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2x</option>
                    </SpeedControl>
                  </div>
                  
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (activeMedia.type === "local_stream") stopLocalFileBroadcast();
                        else { setActiveMedia(null); socket.emit("syncMedia", null); }
                      }}
                      style={{ background: "rgba(255,71,87,0.8)", border: "none", color: "white", padding: "clamp(2px, 0.5vw, 4px) clamp(8px, 1.5vw, 12px)", borderRadius: "clamp(6px, 1vw, 8px)", cursor: "pointer", fontSize: "clamp(0.6rem, 0.9vw, 0.7rem)", fontWeight: "bold", whiteSpace: "nowrap" }}
                    >
                      <FaStop /> Stop
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", padding: "4px 12px", borderRadius: 16, display: "flex", alignItems: "center", gap: 8, zIndex: 100, fontSize: "clamp(0.6rem, 1vw, 0.8rem)" }}>
            <span>Shared Media: {activeMedia.name || "Broadcast"}</span>
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
          <h2 style={{ margin: 0, fontSize: "clamp(0.8rem, 1.5vw, 1rem)", fontWeight: 700, letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, opacity: 0.6 }}>IN THIS CALL</span>
                      <button onClick={() => setShowParticipants(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", opacity: 0.5, fontSize: "0.8rem" }}><FaTimes /></button>
                    </div>
                    {allParticipants.map(p => (
                      <ParticipantRow key={p.id}>
                        <ParticipantDot>{getInitials(p.name)}</ParticipantDot>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "clamp(0.65rem, 1vw, 0.75rem)" }}>{p.name}{p.id === "local" ? " (You)" : ""}</span>
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
            <CircleButton style={{ width: "clamp(28px, 4vw, 32px)", height: "clamp(28px, 4vw, 32px)", fontSize: ".8rem" }} onClick={() => setIsMinimized(false)} title="Return to call"><FaExpand /></CircleButton>
          ) : (
            <>
              <CircleButton
                style={{ width: "clamp(28px, 4vw, 32px)", height: "clamp(28px, 4vw, 32px)", fontSize: "0.8rem" }}
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
                style={{ width: "clamp(28px, 4vw, 32px)", height: "clamp(28px, 4vw, 32px)", fontSize: "0.8rem" }}
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <FaCompress /> : <FaExpand />}
              </CircleButton>
              <CircleButton
                style={{ width: "clamp(28px, 4vw, 32px)", height: "clamp(28px, 4vw, 32px)", fontSize: "0.8rem" }}
                onClick={(event) => { event.stopPropagation(); setIsMinimized(true); }}
                title="Minimize"
              >
                <FaWindowMinimize />
              </CircleButton>
            </>
          )}
          <Divider style={{ height: "clamp(14px, 2vw, 20px)", margin: "0 2px" }} />
          <CircleButton
            $active={true}
            style={isMinimized ? { width: "clamp(28px, 4vw, 32px)", height: "clamp(28px, 4vw, 32px)", fontSize: ".8rem" } : undefined}
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
                  <span style={{ fontSize: "clamp(0.8rem, 1.5vw, 0.9rem)", fontWeight: 600 }}>Connecting to meeting...</span>
                  <span style={{ fontSize: "clamp(0.65rem, 1.2vw, 0.75rem)", opacity: 0.5 }}>Setting up your camera and microphone</span>
                </ConnectingOverlay>
              )}
              {!isAdmin && <PrivacyGuard $minimized={isMinimized} show={!isFocused}><h3>Privacy watermark active</h3><p>Your name and a live timestamp remain visible during this call.</p></PrivacyGuard>}
              {!isMinimized && <div style={{ position: "absolute", top: 8, left: 8, zIndex: 60, fontSize: "clamp(0.5rem, 0.8vw, 0.6rem)", opacity: 0.3, color: "var(--chakra-colors-textPrimary, #ffffff)" }}>ID: {myPeerId || "Connecting..."}</div>}
              {!isMinimized && <Watermark x={watermarkPos.x} y={watermarkPos.y}>{userName} | {new Date().toLocaleTimeString()} | CONFIDENTIAL</Watermark>}
              {isPiPMode && (
                <FloatingPiP onClick={flipCamera} title="Tap to flip camera">
                  <video ref={el => { if (el && localStream && el.srcObject !== localStream) el.srcObject = localStream; }} autoPlay muted playsInline />
                  <div style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "2px 4px", fontSize: "clamp(0.4rem, 0.7vw, 0.6rem)", fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}>
                    <FaExchangeAlt size={8} /> Flip
                  </div>
                </FloatingPiP>
              )}
              {reactions.map(r => (
                <div key={r.id} style={{ position: "absolute", bottom: 0, left: `${r.x}%`, fontSize: "clamp(2rem, 4vw, 2.5rem)", animation: "floatUp 3s ease-out forwards", zIndex: 100 }}>{r.emoji}</div>
              ))}
              {!isMinimized && isSyncing && (
                <div style={{ position: "absolute", top: 12, right: 12, color: "#4CAF50", display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.6)", padding: "6px 12px", borderRadius: "8px", backdropFilter: "blur(5px)", fontSize: "clamp(0.6rem, 1vw, 0.75rem)" }}>
                  <FaSync style={{ animation: "spin 1s linear infinite" }} /> Syncing...
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
                <span style={{ fontSize: "clamp(0.8rem, 1.5vw, 0.9rem)", fontWeight: 600 }}>Connecting to meeting...</span>
                <span style={{ fontSize: "clamp(0.65rem, 1.2vw, 0.75rem)", opacity: 0.5 }}>Setting up your camera and microphone</span>
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
              style={{ background: showUrlInput ? "rgba(0,191,165,0.2)" : "transparent", borderColor: showUrlInput ? "var(--chakra-colors-brandPrimary, #4a9eff)" : "rgba(255,255,255,0.06)" }}
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
              borderRadius: "10px", padding: "clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)", 
              color: "white", fontSize: "clamp(0.7rem, 1.2vw, 0.9rem)", outline: "none",
              minWidth: "100px"
            }}
          />
          <button
            onClick={handleUrlBroadcast}
            style={{
              background: "var(--chakra-colors-brandPrimary, #4a9eff)", border: "none", borderRadius: "10px",
              padding: "clamp(6px, 1vw, 8px) clamp(12px, 2vw, 16px)", color: "white", 
              fontSize: "clamp(0.7rem, 1.2vw, 0.9rem)", fontWeight: "600", cursor: "pointer",
              whiteSpace: "nowrap"
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
        
        @media (max-width: 480px) {
          .meeting-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </MeetingOverlay>
  );
}