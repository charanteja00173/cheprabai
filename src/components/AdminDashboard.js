import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import styled from "styled-components";
import {
  FaTrash,
  FaSearch,
  FaEye,
  FaEyeSlash,
  FaDownload,
  FaSignOutAlt,
  FaFolder,
  FaDatabase,
  FaLock,
  FaUsers,
  FaCog,
  FaList,
  FaThLarge,
  FaDoorOpen,
  FaFileAlt,
  FaFileImage,
  FaFileVideo,
  FaFileAudio,
  FaCalendarAlt,
  FaShieldAlt,
} from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { generateKeyFromSecret, decryptBinary } from "../utils/crypto";
import AdminControlCenter from "./AdminControlCenter";
import ThemeSwitcher from "./ThemeSwitcher";

const AdminWrapper = styled.div`
  min-height: 100dvh;
  position: relative;
  &::before,
  &::after {
    content: "";
    position: fixed;
    border-radius: 50%;
    filter: blur(90px);
    opacity: 0.16;
    pointer-events: none;
    z-index: 0;
  }
  &::before {
    width: 560px;
    height: 560px;
    top: -180px;
    right: -140px;
    background: radial-gradient(circle, var(--chakra-colors-brandPrimary), transparent 70%);
  }
  &::after {
    width: 480px;
    height: 480px;
    bottom: -160px;
    left: -120px;
    background: radial-gradient(circle, var(--chakra-colors-brandSecondary), transparent 70%);
  }
  background: var(--chakra-colors-bg);
  color: var(--chakra-colors-textPrimary);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  font-family: 'Inter', sans-serif;
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 18px 32px;
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(22px) saturate(1.4);
  -webkit-backdrop-filter: blur(22px) saturate(1.4);
  border-bottom: 1px solid var(--chakra-colors-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 14px 16px;
  }
`;

const Brand = styled.h1`
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const ContentContainer = styled.main`
  flex: 1;
  padding: 32px;
  max-width: 1400px;
  width: 100%;
  overflow:auto;
  max-height: 100vh;
  margin: 0 auto;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;

  @media (max-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }
`;

const StatCard = styled.div`
  position: relative;
  overflow: hidden;
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 18px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--chakra-shadows-cardShadow), inset 0 1px 0 var(--chakra-colors-borderSubtle);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, box-shadow 0.25s ease;

  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--chakra-colors-brandPrimary), transparent);
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  &:hover {
    transform: translateY(-3px);
    border-color: var(--chakra-colors-brandPrimary);

    &::before { opacity: 1; }
  }

  @media (max-width: 480px) {
    padding: 12px;
    gap: 8px;
    border-radius: 12px;
  }
`;

const StatIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(255, 63, 94, 0.08);
  border: 1px solid rgba(255, 63, 94, 0.15);
  color: var(--chakra-colors-brandPrimary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;

  @media (max-width: 480px) {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    font-size: 0.9rem;
    svg {
      width: 14px;
      height: 14px;
    }
  }
`;

const StatInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  span:first-child {
    font-size: 0.8rem;
    color: var(--chakra-colors-textSecondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    @media (max-width: 480px) {
      font-size: 0.62rem;
      letter-spacing: 0.1px;
    }
  }

  span:last-child {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--chakra-colors-textPrimary);

    @media (max-width: 480px) {
      font-size: 1.1rem;
    }
  }
`;

const FilterSection = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: center;
  width: 100%;
  flex-wrap: wrap;

  @media (max-width: 480px) {
    gap: 10px;
    > select { flex: 1 1 calc(50% - 5px); min-width: 0; }
    > button { flex: 1 1 auto; justify-content: center; }
  }
`;

const FilterSelect = styled.select`
  padding: 12px 36px 12px 16px;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 12px;
  color: var(--chakra-colors-textPrimary);
  font-size: 0.95rem;
  outline: none;
  cursor: pointer;
  min-width: 180px;
  max-width: 100%;
  transition: all 0.25s ease;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;

  option {
    background: var(--chakra-colors-surface);
    color: var(--chakra-colors-textPrimary);
  }

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: var(--chakra-colors-surface);
    box-shadow: 0 0 0 1px var(--chakra-colors-brandPrimary), 0 0 15px var(--chakra-colors-brandGlow);
  }
`;

const SearchInputWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 280px;

  @media (max-width: 480px) {
    min-width: 0;
    width: 100%;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 20px 12px 48px;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 12px;
  color: var(--chakra-colors-textPrimary);
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.25s ease;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: var(--chakra-colors-surface);
    box-shadow: 0 0 0 1px var(--chakra-colors-brandPrimary), 0 0 15px var(--chakra-colors-brandGlow);
  }
`;

const TableCard = styled.div`
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(16px) saturate(1.25);
  -webkit-backdrop-filter: blur(16px) saturate(1.25);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--chakra-shadows-cardShadow), inset 0 1px 0 var(--chakra-colors-borderSubtle);

  @media (max-width: 768px) {
    border: none;
    background: transparent;
    box-shadow: none;
  }
`;

const GridTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  // max-height: 60vh;
  // overflow-y: auto;

  th, td {
    padding: 16px 24px;
    border-bottom: 1px solid var(--chakra-colors-border);
  }

  th {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--chakra-colors-textSecondary);
    background: var(--chakra-colors-badgeBg);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  tbody tr {
    transition: background 0.2s ease;
    
    &:hover {
      background: var(--chakra-colors-surfaceHover);
    }
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileCardList = styled.div`
  display: none;
  flex-direction: column;
  gap: 16px;

  // height: 60vh;
  // overflow-y: auto;
  overflow-x: hidden;

  @media (max-width: 768px) {
    display: flex;
  }
`;

const MobileCard = styled.div`
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--chakra-shadows-cardShadow);
`;

const UploadGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
`;

const UploadGridCard = styled.article`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  position: relative;
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.25);

  &:hover {
    border-color: rgba(255, 63, 94, 0.25);
    transform: translateY(-3px);
    box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.35), 0 0 1px 1px rgba(255, 63, 94, 0.12);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
  }
`;

const FileCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

const FileTypeIconWrapper = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${(p) => p.$color || "rgba(255,255,255,0.06)"};
  display: grid;
  place-items: center;
  color: #fff;
  flex-shrink: 0;
`;

const FileNameText = styled.h4`
  margin: 0;
  font-size: 0.88rem;
  font-weight: 750;
  color: #fff;
  line-height: 1.35;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
`;

const FileMetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 12px;
  font-size: 0.74rem;
`;

const FileMetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;

  span:first-child {
    font-size: 0.64rem;
    text-transform: uppercase;
    color: var(--chakra-colors-textSecondary);
    font-weight: 600;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  strong {
    font-weight: 750;
    color: #fff;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }
`;

const FileCardActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  padding-top: 12px;
`;

const RoundActionBtn = styled.button`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid ${(p) => (p.$danger ? "rgba(255,71,87,0.25)" : "rgba(255,255,255,0.06)")};
  background: ${(p) => (p.$danger ? "rgba(255,71,87,0.06)" : "rgba(255,255,255,0.02)")};
  color: ${(p) => (p.$danger ? "#ff4757" : "var(--chakra-colors-textSecondary)")};
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${(p) => (p.$danger ? "#ff4757" : "rgba(255,255,255,0.08)")};
    color: #fff;
    border-color: ${(p) => (p.$danger ? "#ff4757" : "rgba(255,255,255,0.15)")};
    transform: scale(1.05);
  }
`;

const getFileTypeDetails = (type) => {
  const mime = type || "";
  if (mime.startsWith("image/")) {
    return { color: "rgba(9, 132, 227, 0.15)", icon: <FaFileImage size={16} color="#0984e3" /> };
  }
  if (mime.startsWith("video/")) {
    return { color: "rgba(108, 92, 231, 0.15)", icon: <FaFileVideo size={16} color="#6c5ce7" /> };
  }
  if (mime.startsWith("audio/")) {
    return { color: "rgba(253, 150, 68, 0.15)", icon: <FaFileAudio size={16} color="#fd9644" /> };
  }
  return { color: "rgba(255, 71, 87, 0.15)", icon: <FaFileAlt size={16} color="#ff4757" /> };
};

const MobileCardRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  span:first-child {
    font-size: 0.75rem;
    color: var(--chakra-colors-textSecondary);
    text-transform: uppercase;
    font-weight: 700;
  }

  span:last-child {
    font-size: 0.9rem;
    font-weight: 500;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const ActionButton = styled.button`
  background: ${props => props.$danger ? "rgba(255, 71, 87, 0.1)" : "var(--chakra-colors-badgeBg)"};
  color: ${props => props.$danger ? "#ff4757" : "var(--chakra-colors-textPrimary)"};
  border: 1px solid ${props => props.$danger ? "rgba(255, 71, 87, 0.2)" : "var(--chakra-colors-badgeBorder)"};
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$danger ? "#ff4757" : "var(--chakra-colors-surfaceHover)"};
    color: #fff;
    transform: translateY(-1px);
  }
`;

const Badge = styled.span`
  background: ${props => props.$brand ? "var(--chakra-colors-badgeBg)" : "var(--chakra-colors-surfaceHover)"};
  color: ${props => props.$brand ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-textSecondary)"};
  border: 1px solid ${props => props.$brand ? "var(--chakra-colors-badgeBorder)" : "var(--chakra-colors-border)"};
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-block;
`;

const FileLink = styled.a`
  color: var(--chakra-colors-textPrimary);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--chakra-colors-brandPrimary);
  }
`;

const FloatingBlob = styled.div`
  position: absolute;
  width: clamp(250px, 50vw, 500px);
  height: clamp(250px, 50vw, 500px);
  background: radial-gradient(circle, var(--chakra-colors-brandSecondary) 0%, transparent 70%);
  opacity: 0.12;
  filter: blur(60px);
  bottom: 10%;
  right: 10%;
  animation: floating-glow-2 18s infinite alternate ease-in-out;
  pointer-events: none;
  z-index: 1;
`;

const LoginContainer = styled.div`
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
    z-index: 1;
  }
`;

const LoginCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
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
    gap: 16px;
    border-radius: 18px;
  }
`;

const LoginInputContainer = styled.div`
  position: relative;
  width: 100%;
`;

const LoginInput = styled.input`
  width: 100%;
  padding: 14px 48px 14px 18px;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 14px;
  color: var(--chakra-colors-textPrimary);
  font-size: 1rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.25s ease;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: var(--chakra-colors-surface);
    box-shadow: 0 0 0 1px var(--chakra-colors-brandPrimary), 0 0 15px var(--chakra-colors-brandGlow);
  }
`;

const LoginEyeButton = styled.button`
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

const LoginButton = styled.button`
  padding: 14px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 15px var(--chakra-colors-brandGlow);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px var(--chakra-colors-brandGlow);
  }
`;

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("admin_token") || "");
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [search, setSearch] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [decryptTarget, setDecryptTarget] = useState(null);
  const [decryptAction, setDecryptAction] = useState(""); // "download" or "preview"
  const [roomCode, setRoomCode] = useState("");
  const [mainSection, setMainSection] = useState("live");

  const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";

  const closePreview = () => {
    if (previewItem && previewItem.url && previewItem.url.startsWith("blob:")) {
      URL.revokeObjectURL(previewItem.url);
    }
    setPreviewItem(null);
  };

  

  const executeDecryption = async (targetOverride, actionOverride) => {
    const target = targetOverride || decryptTarget;
    const action = actionOverride || decryptAction;
    if (!target) return;
    try {
      const response = await fetch(`${backendUrl}/api/proxy-file?url=${encodeURIComponent(target.url)}`);
      if (!response.ok) throw new Error("File retrieval failed");
      let bytes = await response.arrayBuffer();
      if (target.encrypted) {
        const passwordToUse = target.roomPassword || roomCode;
        if (!passwordToUse || !passwordToUse.trim()) {
          throw new Error("Enter the room security code to decrypt this file.");
        }
        const key = await generateKeyFromSecret(`${passwordToUse.trim()}${target.roomId}`);
        const iv = new Uint8Array(atob(target.iv).split("").map((char) => char.charCodeAt(0)));
        bytes = await decryptBinary(key, { iv, data: bytes });
      }
      const blob = new Blob([bytes], { type: target.type || "application/octet-stream" });
      const localUrl = URL.createObjectURL(blob);

      if (action === "download") {
        const anchor = document.createElement("a");
        anchor.href = localUrl;
        anchor.download = target.name || "download";
        anchor.click();
        URL.revokeObjectURL(localUrl);
        toast.success("File downloaded securely.");
      } else {
        setPreviewItem({
          ...target,
          url: localUrl
        });
      }
      setDecryptTarget(null);
      setRoomCode("");
    } catch (error) {
      toast.error(error.message || "Unable to decrypt this file.");
    }
  };

  const handlePreviewClick = (item) => {
    if (item.encrypted) {
      if (item.roomPassword) {
        executeDecryption(item, "preview");
      } else {
        setDecryptTarget(item);
        setDecryptAction("preview");
      }
    } else {
      setPreviewItem(item);
    }
  };

  const handleDownloadClick = (item) => {
    if (item.encrypted) {
      if (item.roomPassword) {
        executeDecryption(item, "download");
      } else {
        setDecryptTarget(item);
        setDecryptAction("download");
      }
    } else {
      executeDecryption(item, "download");
    }
  };

  const fetchUploads = useCallback(async (adminToken) => {
    setLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/admin/uploads`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setUploads(res.data.uploads || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load uploads data.");
      if (err.response?.status === 403 || err.response?.status === 401) {
        localStorage.removeItem("admin_token");
        setToken("");
      }
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (token) {
      fetchUploads(token);
      const refreshTimer = setInterval(() => fetchUploads(token), 20000);
      return () => clearInterval(refreshTimer);
    }
    return undefined;
  }, [token, fetchUploads]);

  const renderPreview = (item) => {
    if ((item.type || "").startsWith("image/")) {
      return <img src={item.url} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: "cover", display: "block", background: "#151821" }} loading="lazy" />;
    }
    if ((item.type || "").startsWith("video/")) {
      return <video src={`${item.url}#t=0.1`} muted preload="metadata" style={{ width: 44, height: 44, borderRadius: 9, objectFit: "cover", display: "block", background: "#151821" }} />;
    }
    return <div style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 9, background: "rgba(255,255,255,.06)", color: "var(--chakra-colors-brandPrimary)", fontSize: ".7rem", fontWeight: 800 }}>FILE</div>;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.warn("Please enter admin password.");
      return;
    }
    try {
      const res = await axios.post(`${backendUrl}/api/admin/login`, { password });
      const receivedToken = res.data.token;
      localStorage.setItem("admin_token", receivedToken);
      setToken(receivedToken);
      toast.success("Welcome, Super Admin!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Invalid Credentials.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setToken("");
    setUploads([]);
    setSelectedRoom("");
    setSelectedUser("");
    toast.info("Logged out.");
  };

  const handleChangePassword = async () => {
    if (!currentPw.trim() || !newPw.trim()) {
      toast.warn("Please fill in both fields.");
      return;
    }
    if (newPw.length < 4) {
      toast.warn("New password must be at least 4 characters.");
      return;
    }
    try {
      await axios.post(`${backendUrl}/api/admin/change-password`, {
        currentPassword: currentPw,
        newPassword: newPw
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Password changed! Please log in again.");
      localStorage.removeItem("admin_token");
      setToken("");
      setUploads([]);
      setShowChangePassword(false);
      setCurrentPw("");
      setNewPw("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to change password.");
    }
  };

  const handleDelete = async (roomId, messageId) => {
    try {
      await axios.delete(`${backendUrl}/api/admin/uploads/${roomId}/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("File permanently deleted.");
      setUploads(prev => prev.filter(item => item.id !== messageId));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete file.");
    }
  };

  const uniqueRoomsList = useMemo(() => {
    return Array.from(new Set(uploads.map(item => item.roomId).filter(Boolean))).sort();
  }, [uploads]);

  const uniqueUsersList = useMemo(() => {
    return Array.from(new Set(uploads.map(item => item.uploadedBy).filter(Boolean))).sort();
  }, [uploads]);

  const filteredUploads = useMemo(() => {
    let result = [...uploads];

    if (selectedRoom) {
      result = result.filter(item => item.roomId === selectedRoom);
    }
    if (selectedUser) {
      result = result.filter(item => item.uploadedBy === selectedUser);
    }
    if (sourceFilter !== "all") {
      result = result.filter((item) => (item.source || "realtime") === sourceFilter);
    }

    const query = search.toLowerCase();
    if (query) {
      result = result.filter(item =>
        (item.name || "").toLowerCase().includes(query) ||
        (item.roomId || "").toLowerCase().includes(query) ||
        (item.uploadedBy || "").toLowerCase().includes(query)
      );
    }

    const rangeDays = { "1": 1, "5": 5, "30": 30, "60": 60 }[dateRange];
    if (rangeDays) {
      const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
      result = result.filter((item) => Number(item.timestamp) >= cutoff);
    }

    if (dateFrom) {
      const fromTs = new Date(dateFrom).getTime();
      if (!isNaN(fromTs)) result = result.filter(item => Number(item.timestamp) >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo).setHours(23, 59, 59, 999);
      if (!isNaN(toTs)) result = result.filter(item => Number(item.timestamp) <= toTs);
    }

    if (typeFilter !== "all") {
      result = result.filter(item => {
        const mime = (item.type || "").toLowerCase();
        switch (typeFilter) {
          case "images": return mime.startsWith("image/");
          case "videos": return mime.startsWith("video/");
          case "audio": return mime.startsWith("audio/");
          case "documents": return !mime.startsWith("image/") && !mime.startsWith("video/") && !mime.startsWith("audio/");
          default: return true;
        }
      });
    }

    result.sort((a, b) => {
      if (sortBy === "oldest") return Number(a.timestamp) - Number(b.timestamp);
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "room") return (a.roomId || "").localeCompare(b.roomId || "");
      return Number(b.timestamp) - Number(a.timestamp);
    });

    return result;
  }, [uploads, search, selectedRoom, selectedUser, dateRange, dateFrom, dateTo, typeFilter, sortBy, sourceFilter]);

  const stats = useMemo(() => {
    const totalFiles = uploads.length;
    const uniqueRooms = new Set(uploads.map(item => item.roomId)).size;
    const uniqueUsers = new Set(uploads.map(item => item.uploadedBy)).size;
    const totalBytes = uploads.reduce((acc, item) => acc + (Number(item.size) || 0), 0);

    let storageStr = "0 B";
    if (totalBytes > 0) {
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(totalBytes) / Math.log(k));
      storageStr = parseFloat((totalBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    return { totalFiles, uniqueRooms, uniqueUsers, storageStr };
  }, [uploads]);

  if (!token) {
    return (
      <LoginContainer>
        <ToastContainer position="top-center" autoClose={2600} limit={3} theme="dark" newestOnTop closeOnClick pauseOnHover={false} icon={false} />
        <FloatingBlob />
        <form onSubmit={handleLogin} style={{ zIndex: 2, position: "relative" }}>
          <LoginCard>
            <div style={{ textAlign: "center" }}>
              <div style={{
                display: "inline-flex",
                background: "rgba(255, 63, 94, 0.10)",
                border: "1px solid rgba(255, 63, 94, 0.30)",
                boxShadow: "0 0 0 5px rgba(255,63,94,.04), 0 8px 20px rgba(0,0,0,.18)",
                padding: "12px",
                borderRadius: "14px",
                marginBottom: "16px"
              }}>
                <FaShieldAlt size={24} color="var(--chakra-colors-brandPrimary)" />
              </div>
              <h2 style={{ margin: 0, fontSize: "clamp(1.35rem, 3.5vw, 1.6rem)", fontWeight: 800, letterSpacing: "-.04em", color: "var(--chakra-colors-textPrimary)" }}>Admin Panel</h2>
              <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "0.82rem", margin: "6px auto 0", maxWidth: 280, lineHeight: 1.45 }}>Enter your security key to access the control panel.</p>
            </div>

            <LoginInputContainer>
              <LoginInput
                type={showPassword ? "text" : "password"}
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <LoginEyeButton
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </LoginEyeButton>
            </LoginInputContainer>

            <LoginButton type="submit">Verify Credentials</LoginButton>
          </LoginCard>
        </form>
      </LoginContainer>
    );
  }

  return (
    <AdminWrapper>
      <ToastContainer position="top-center" autoClose={2600} limit={3} theme="dark" newestOnTop closeOnClick pauseOnHover={false} icon={false} />
      {decryptTarget && <div role="dialog" aria-modal="true" aria-label="Secure file download" style={{ position: "fixed", inset: 0, zIndex: 20000, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.62)" }}>
        <div style={{ width: "min(420px, 100%)", padding: 24, borderRadius: 20, background: "#10192e", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 24px 70px rgba(0,0,0,.55)" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Secure download</h2>
          <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: ".86rem", lineHeight: 1.5 }}>Enter the room security code to decrypt <strong>{decryptTarget.name}</strong> locally. The code is never sent to the server.</p>
          {decryptTarget.encrypted && <LoginInput value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="Room security code" autoFocus />}
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}><ActionButton onClick={() => { setDecryptTarget(null); setRoomCode(""); }}>Cancel</ActionButton><LoginButton type="button" onClick={executeDecryption}>Download original</LoginButton></div>
        </div>
      </div>}
      <Header>
        <Brand>
          <FaShieldAlt /> Admin Panel
        </Brand>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ThemeSwitcher />
          <ActionButton onClick={() => setShowChangePassword(true)}>
            <FaCog /> <span className="hide-mobile">Settings</span>
          </ActionButton>
          <ActionButton onClick={handleLogout}>
            <FaSignOutAlt /> <span className="hide-mobile">Logout</span>
          </ActionButton>
        </div>
      </Header>

      {showChangePassword && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px", boxSizing: "border-box"
        }} onClick={() => setShowChangePassword(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--chakra-colors-surface, #1a1a2e)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "420px",
            display: "flex", flexDirection: "column", gap: "20px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem" }}>Change Admin Password</h3>

            <LoginInputContainer>
              <LoginInput
                type={showCurrentPw ? "text" : "password"}
                placeholder="Current Password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
              />
              <LoginEyeButton type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                {showCurrentPw ? <FaEyeSlash /> : <FaEye />}
              </LoginEyeButton>
            </LoginInputContainer>

            <LoginInputContainer>
              <LoginInput
                type={showNewPw ? "text" : "password"}
                placeholder="New Password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
              />
              <LoginEyeButton type="button" onClick={() => setShowNewPw(!showNewPw)}>
                {showNewPw ? <FaEyeSlash /> : <FaEye />}
              </LoginEyeButton>
            </LoginInputContainer>

            <div style={{ display: "flex", gap: "12px" }}>
              <LoginButton type="button" onClick={handleChangePassword} style={{ flex: 1 }}>Update Password</LoginButton>
              <ActionButton type="button" onClick={() => setShowChangePassword(false)} style={{ flex: 0 }}>Cancel</ActionButton>
            </div>
          </div>
        </div>
      )}

      <ContentContainer>
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setMainSection("live")}
            aria-pressed={mainSection === "live"}
            style={{
              minHeight: 44,
              padding: "10px 18px",
              borderRadius: 12,
              border: `1px solid ${mainSection === "live" ? "var(--chakra-colors-brandPrimary)" : "rgba(255,255,255,0.08)"}`,
              background: mainSection === "live" ? "rgba(255, 63, 94, 0.12)" : "rgba(255,255,255,0.02)",
              color: mainSection === "live" ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-textSecondary)",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FaDoorOpen /> Live Rooms
          </button>
          <button
            type="button"
            onClick={() => setMainSection("uploads")}
            aria-pressed={mainSection === "uploads"}
            style={{
              minHeight: 44,
              padding: "10px 18px",
              borderRadius: 12,
              border: `1px solid ${mainSection === "uploads" ? "var(--chakra-colors-brandPrimary)" : "rgba(255,255,255,0.08)"}`,
              background: mainSection === "uploads" ? "rgba(255, 63, 94, 0.12)" : "rgba(255,255,255,0.02)",
              color: mainSection === "uploads" ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-textSecondary)",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FaFolder /> File Uploads
          </button>
        </div>

        {mainSection === "live" ? (
          <AdminControlCenter token={token} backendUrl={backendUrl} />
        ) : (
        <>
        <StatsGrid>
          <StatCard>
            <StatIcon><FaFolder /></StatIcon>
            <StatInfo>
              <span>Total Uploads</span>
              <span>{stats.totalFiles}</span>
            </StatInfo>
          </StatCard>
          <StatCard>
            <StatIcon><FaDatabase /></StatIcon>
            <StatInfo>
              <span>Active Rooms</span>
              <span>{stats.uniqueRooms}</span>
            </StatInfo>
          </StatCard>
          <StatCard>
            <StatIcon><FaUsers /></StatIcon>
            <StatInfo>
              <span>Contributors</span>
              <span>{stats.uniqueUsers}</span>
            </StatInfo>
          </StatCard>
          <StatCard style={{ minWidth: 200 }}>
            <StatIcon style={{ background: "rgba(46, 213, 115, 0.08)", border: "1px solid rgba(46, 213, 115, 0.15)", color: "#2ed573" }}><FaDatabase /></StatIcon>
            <StatInfo>
              <span>Total Storage</span>
              <span>{stats.storageStr}</span>
            </StatInfo>
          </StatCard>
        </StatsGrid>

        <FilterSection>
          <div style={{ display: "flex", gap: 8, padding: 4, borderRadius: 12, background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)" }}>
            {[['all', 'All'], ['realtime', 'Realtime'], ['cloudinary', 'Cloudinary']].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setSourceFilter(value)} aria-pressed={sourceFilter === value} style={{ border: 0, borderRadius: 8, cursor: 'pointer', padding: '8px 11px', fontSize: '.78rem', fontWeight: 700, color: sourceFilter === value ? '#fff' : 'var(--chakra-colors-textSecondary)', background: sourceFilter === value ? 'var(--chakra-colors-brandPrimary)' : 'transparent' }}>{label}</button>
            ))}
          </div>
          <SearchInputWrapper>
            <FaSearch style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--chakra-colors-textSecondary)" }} />
            <SearchInput
              type="text"
              placeholder="Search uploads by name, room ID, or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </SearchInputWrapper>

          <FilterSelect
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            title="Filter by Room ID"
          >
            <option value="">All Rooms</option>
            {uniqueRoomsList.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </FilterSelect>

          <FilterSelect
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            title="Filter by Contributor"
          >
            <option value="">All Users</option>
            {uniqueUsersList.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </FilterSelect>

          <FilterSelect value={dateRange} onChange={(e) => { setDateRange(e.target.value); if (e.target.value !== "custom") { setDateFrom(""); setDateTo(""); } }} title="Filter by upload date">
            <option value="all">All dates</option>
            <option value="1">Last 24 hours</option>
            <option value="5">Last 5 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 2 months</option>
          </FilterSelect>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDateRange("all"); }} title="From date" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "6px 8px", color: "#fff", fontSize: ".75rem", outline: "none", width: 130, cursor: "pointer", colorScheme: "dark" }} />
            <span style={{ fontSize: ".7rem", opacity: 0.4 }}>–</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDateRange("all"); }} title="To date" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "6px 8px", color: "#fff", fontSize: ".75rem", outline: "none", width: 130, cursor: "pointer", colorScheme: "dark" }} />
          </div>

          <FilterSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} title="Filter by file type">
            <option value="all">All types</option>
            <option value="images">Images</option>
            <option value="videos">Videos</option>
            <option value="audio">Audio</option>
            <option value="documents">Documents</option>
          </FilterSelect>

          <FilterSelect value={sortBy} onChange={(e) => setSortBy(e.target.value)} title="Sort uploads">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">File name A–Z</option>
            <option value="room">Room ID A–Z</option>
          </FilterSelect>

          <ActionButton onClick={() => fetchUploads(token)} disabled={loading} aria-busy={loading} title="Refresh dashboard data">
            {loading ? <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.25)", borderTopColor: "var(--chakra-colors-brandPrimary)", animation: "spin .7s linear infinite" }} /> : "Refresh"}
          </ActionButton>
          <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12 }} aria-label="Dashboard layout">
            <ActionButton type="button" onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"} title="List layout" style={{ padding: "8px 10px", color: viewMode === "list" ? "var(--chakra-colors-brandPrimary)" : undefined }}><FaList /></ActionButton>
            <ActionButton type="button" onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"} title="Grid layout" style={{ padding: "8px 10px", color: viewMode === "grid" ? "var(--chakra-colors-brandPrimary)" : undefined }}><FaThLarge /></ActionButton>
          </div>
        </FilterSection>

        {!loading && <div style={{ margin: "-8px 0 16px", fontSize: ".82rem", color: "var(--chakra-colors-textSecondary)" }}>{filteredUploads.length} file{filteredUploads.length === 1 ? "" : "s"} shown</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--chakra-colors-textSecondary)" }}>
            Loading dashboard data...
          </div>
        ) : filteredUploads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px", color: "var(--chakra-colors-textSecondary)", background: "rgba(255,255,255,0.01)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.04)" }}>
            No uploads found.
          </div>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: '100vh' }}>
            {viewMode === "list" ? <TableCard>
              <GridTable>
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>File Metadata</th>
                    <th>Room ID</th>
                    <th>Uploaded By</th>
                    <th>Uploaded At</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUploads.map((item) => (
                    <tr key={item.id}>
                      <td><button type="button" onClick={() => handlePreviewClick(item)} title="Preview file" style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer" }}>{renderPreview(item)}</button></td>
                      <td>
                        <FileLink href={item.url} onClick={(e) => { e.preventDefault(); handleDownloadClick(item); }}>
                          <FaDownload style={{ flexShrink: 0, color: "var(--chakra-colors-brandPrimary)" }} />
                          {item.name}
                        </FileLink>
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          <Badge>{(item.source || "realtime") === "cloudinary" ? "Cloudinary" : "Realtime"}</Badge>
                          {item.type && <Badge $brand>{item.type.split('/')[0]}</Badge>}
                          {item.size && (
                            <Badge style={{ background: "rgba(46, 213, 115, 0.08)", color: "#2ed573", borderColor: "rgba(46, 213, 115, 0.15)" }}>
                              {(() => {
                                const k = 1024;
                                const sizes = ['B', 'KB', 'MB', 'GB'];
                                const i = Math.floor(Math.log(item.size) / Math.log(k));
                                return parseFloat((item.size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                              })()}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge>{item.roomId}</Badge>
                      </td>
                      <td>
                        <Badge $brand>{item.uploadedBy}</Badge>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--chakra-colors-textSecondary)" }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <ActionButton onClick={() => handlePreviewClick(item)} title="Preview file"><FaEye /></ActionButton>{" "}
                        <ActionButton $danger title="Permanently delete this file" onClick={() => handleDelete(item.roomId, item.id)}>
                          <FaTrash /> Delete
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </GridTable>
            </TableCard> : <UploadGrid>
              {filteredUploads.map((item) => {
                const { color, icon } = getFileTypeDetails(item.type);
                return (
                  <UploadGridCard key={item.id}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <FileCardHeader>
                        <FileTypeIconWrapper $color={color}>
                          {icon}
                        </FileTypeIconWrapper>
                        <FileNameText
                          title={item.name}
                          onClick={() => handleDownloadClick(item)}
                        >
                          {item.name}
                        </FileNameText>
                      </FileCardHeader>

                      <FileMetaGrid>
                        <FileMetaItem>
                          <span>
                            <FaLock size={10} />
                            Room
                          </span>
                          <strong>{item.roomId || "—"}</strong>
                        </FileMetaItem>
                        <FileMetaItem>
                          <span>
                            <FaUsers size={10} />
                            By
                          </span>
                          <strong>{item.uploadedBy || "System"}</strong>
                        </FileMetaItem>
                        <FileMetaItem style={{ gridColumn: "span 2" }}>
                          <span>
                            <FaDatabase size={10} />
                            Source
                          </span>
                          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                            <Badge style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
                              {(item.source || "realtime") === "cloudinary" ? "Cloudinary" : "Realtime"}
                            </Badge>
                            {item.type && (
                              <Badge $brand style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
                                {item.type.split('/')[0]}
                              </Badge>
                            )}
                          </div>
                        </FileMetaItem>
                        <FileMetaItem style={{ gridColumn: "span 2" }}>
                          <span>
                            <FaCalendarAlt size={10} />
                            Uploaded
                          </span>
                          <span style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "0.72rem", marginTop: 1 }}>
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </FileMetaItem>
                      </FileMetaGrid>
                    </div>

                    <FileCardActions>
                      <RoundActionBtn
                        type="button"
                        onClick={() => handlePreviewClick(item)}
                        title="Preview file"
                      >
                        <FaEye size={12} />
                      </RoundActionBtn>
                      <RoundActionBtn
                        type="button"
                        onClick={() => handleDownloadClick(item)}
                        title="Decrypt & Download"
                      >
                        <FaDownload size={12} />
                      </RoundActionBtn>
                      <RoundActionBtn
                        type="button"
                        $danger
                        onClick={() => handleDelete(item.roomId, item.id)}
                        title="Delete permanently"
                      >
                        <FaTrash size={12} />
                      </RoundActionBtn>
                    </FileCardActions>
                  </UploadGridCard>
                );
              })}
            </UploadGrid>}

            {viewMode === "list" && <MobileCardList>
              {filteredUploads.map((item) => (
                <MobileCard key={item.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button type="button" onClick={() => handlePreviewClick(item)} title="Preview file" style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer" }}>
                      {renderPreview(item)}
                    </button>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: ".72rem", color: "var(--chakra-colors-textSecondary)", textTransform: "uppercase", fontWeight: 700 }}>Preview</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                        <Badge>{(item.source || "realtime") === "cloudinary" ? "Cloudinary" : "Realtime"}</Badge>
                        {item.type && <Badge $brand>{item.type.split('/')[0]}</Badge>}
                      </div>
                    </div>
                  </div>
                  <MobileCardRow>
                    <span>File</span>
                    <FileLink href={item.url} onClick={(e) => { e.preventDefault(); handleDownloadClick(item); }}>
                      {item.name}
                    </FileLink>
                  </MobileCardRow>
                  <MobileCardRow>
                    <span>Room ID</span>
                    <Badge>{item.roomId}</Badge>
                  </MobileCardRow>
                  <MobileCardRow>
                    <span>Uploaded By</span>
                    <Badge $brand>{item.uploadedBy}</Badge>
                  </MobileCardRow>
                  <MobileCardRow>
                    <span>Uploaded At</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--chakra-colors-textSecondary)" }}>
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </MobileCardRow>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                    <ActionButton $danger onClick={() => handleDelete(item.roomId, item.id)}>
                      <FaTrash /> Delete File
                    </ActionButton>
                  </div>
                </MobileCard>
              ))}
            </MobileCardList>}
          </div>
        )}
        </>
        )}
      </ContentContainer>
      {previewItem && <div role="dialog" aria-modal="true" aria-label="File preview" onClick={closePreview} style={{ position: "fixed", inset: 0, zIndex: 12000, background: "rgba(0,0,0,.76)", backdropFilter: "blur(8px)", padding: 20, display: "grid", placeItems: "center" }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(760px, 100%)", maxHeight: "90dvh", overflow: "auto", borderRadius: 20, padding: 16, background: "#151720", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 28px 80px rgba(0,0,0,.55)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{previewItem.name}</strong><ActionButton onClick={closePreview}>Close</ActionButton></div>
          {(previewItem.type || "").startsWith("image/") ? <img src={previewItem.url} alt={previewItem.name} style={{ display: "block", width: "100%", maxHeight: "68dvh", objectFit: "contain", borderRadius: 12, background: "#090a0e" }} /> : (previewItem.type || "").startsWith("video/") ? <video src={previewItem.url} controls autoPlay playsInline style={{ display: "block", width: "100%", maxHeight: "68dvh", borderRadius: 12, background: "#090a0e" }} /> : <a href={previewItem.url} target="_blank" rel="noreferrer" style={{ display: "block", padding: 30, textAlign: "center", color: "var(--chakra-colors-brandPrimary)" }}>Open this file in a new tab</a>}
        </div>
      </div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AdminWrapper>
  );
}
