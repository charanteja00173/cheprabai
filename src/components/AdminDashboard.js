import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import styled from "styled-components";
import { FaTrash, FaSearch, FaEye, FaEyeSlash, FaDownload, FaSignOutAlt, FaFolder, FaDatabase, FaLock, FaUsers, FaCog, FaList, FaThLarge } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { generateKeyFromSecret, decryptBinary } from "../utils/crypto";

const AdminWrapper = styled.div`
  min-height: 100dvh;
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
  padding: 18px 32px;
  background: rgba(10, 10, 15, 0.45);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 16px 20px;
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
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--chakra-colors-brandPrimary);
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
`;

const StatInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  span:first-child {
    font-size: 0.8rem;
    color: var(--chakra-colors-textSecondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  span:last-child {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--chakra-colors-textPrimary);
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
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  color: var(--chakra-colors-textPrimary);
  font-size: 0.95rem;
  outline: none;
  cursor: pointer;
  min-width: 180px;
  max-width: 100%;
  transition: all 0.25s ease;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;

  option {
    background: #12121a;
    color: #fff;
  }

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(0, 0, 0, 0.2);
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
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  color: var(--chakra-colors-textPrimary);
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.25s ease;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(0, 0, 0, 0.2);
    box-shadow: 0 0 0 1px var(--chakra-colors-brandPrimary), 0 0 15px var(--chakra-colors-brandGlow);
  }
`;

const TableCard = styled.div`
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);

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
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  th {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--chakra-colors-textSecondary);
    background: rgba(255, 255, 255, 0.01);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  tbody tr {
    transition: background 0.2s ease;
    
    &:hover {
      background: rgba(255, 255, 255, 0.01);
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
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
`;

const UploadGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
`;

const UploadGridCard = styled.article`
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.16);
`;

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
  background: ${props => props.$danger ? "rgba(255, 71, 87, 0.1)" : "rgba(255, 255, 255, 0.06)"};
  color: ${props => props.$danger ? "#ff4757" : "var(--chakra-colors-textPrimary)"};
  border: 1px solid ${props => props.$danger ? "rgba(255, 71, 87, 0.2)" : "rgba(255, 255, 255, 0.1)"};
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
    background: ${props => props.$danger ? "#ff4757" : "rgba(255, 255, 255, 0.15)"};
    color: #fff;
    transform: translateY(-1px);
  }
`;

const Badge = styled.span`
  background: ${props => props.$brand ? "rgba(255, 63, 94, 0.08)" : "rgba(255, 255, 255, 0.06)"};
  color: ${props => props.$brand ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-textSecondary)"};
  border: 1px solid ${props => props.$brand ? "rgba(255, 63, 94, 0.15)" : "rgba(255, 255, 255, 0.1)"};
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

const LoginContainer = styled.div`
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--chakra-colors-bg);
  box-sizing: border-box;
`;

const LoginCard = styled.div`
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 24px;
  backdrop-filter: blur(20px);
`;

const LoginInputContainer = styled.div`
  position: relative;
  width: 100%;
`;

const LoginInput = styled.input`
  width: 100%;
  padding: 14px 48px 14px 18px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  color: var(--chakra-colors-textPrimary);
  font-size: 1rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.25s ease;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(0, 0, 0, 0.4);
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
  const [viewMode, setViewMode] = useState("list");
  const [decryptTarget, setDecryptTarget] = useState(null);
  const [decryptAction, setDecryptAction] = useState(""); // "download" or "preview"
  const [roomCode, setRoomCode] = useState("");

  const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";

  const closePreview = () => {
    if (previewItem && previewItem.url && previewItem.url.startsWith("blob:")) {
      URL.revokeObjectURL(previewItem.url);
    }
    setPreviewItem(null);
  };

  const handleAction = async (item, action) => {
    if (!item.encrypted) {
      if (action === "download") {
        try {
          const response = await fetch(`${backendUrl}/api/proxy-file?url=${encodeURIComponent(item.url)}`);
          if (!response.ok) throw new Error("Download failed");
          const blob = await response.blob();
          const anchor = document.createElement("a");
          anchor.href = URL.createObjectURL(blob);
          anchor.download = item.name || "download";
          anchor.click();
          URL.revokeObjectURL(anchor.href);
          toast.success("File downloaded.");
        } catch (error) {
          toast.error("Download failed.");
        }
      } else {
        setPreviewItem(item);
      }
      return;
    }
    setDecryptTarget(item);
    setDecryptAction(action);
    setRoomCode("");
  };

  const executeDecryption = async () => {
    if (!decryptTarget) return;
    try {
      const response = await fetch(`${backendUrl}/api/proxy-file?url=${encodeURIComponent(decryptTarget.url)}`);
      if (!response.ok) throw new Error("File retrieval failed");
      let bytes = await response.arrayBuffer();
      if (decryptTarget.encrypted) {
        if (!roomCode.trim()) throw new Error("Enter the room security code to decrypt this file.");
        const key = await generateKeyFromSecret(`${roomCode}${decryptTarget.roomId}`);
        const iv = new Uint8Array(atob(decryptTarget.iv).split("").map((char) => char.charCodeAt(0)));
        bytes = await decryptBinary(key, { iv, data: bytes });
      }
      const blob = new Blob([bytes], { type: decryptTarget.type || "application/octet-stream" });
      const localUrl = URL.createObjectURL(blob);

      if (decryptAction === "download") {
        const anchor = document.createElement("a");
        anchor.href = localUrl;
        anchor.download = decryptTarget.name || "download";
        anchor.click();
        URL.revokeObjectURL(localUrl);
        toast.success("File downloaded securely.");
      } else {
        setPreviewItem({
          ...decryptTarget,
          url: localUrl
        });
      }
      setDecryptTarget(null);
      setRoomCode("");
    } catch (error) {
      toast.error(error.message || "Unable to decrypt this file.");
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

    result.sort((a, b) => {
      if (sortBy === "oldest") return Number(a.timestamp) - Number(b.timestamp);
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "room") return (a.roomId || "").localeCompare(b.roomId || "");
      return Number(b.timestamp) - Number(a.timestamp);
    });

    return result;
  }, [uploads, search, selectedRoom, selectedUser, dateRange, sortBy, sourceFilter]);

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
        <ToastContainer position="top-center" theme="dark" />
        <form onSubmit={handleLogin}>
          <LoginCard>
            <div style={{ textAlign: "center" }}>
              <div style={{
                display: "inline-flex",
                background: "rgba(255, 63, 94, 0.08)",
                border: "1px solid rgba(255, 63, 94, 0.25)",
                padding: "16px",
                borderRadius: "50%",
                marginBottom: "20px"
              }}>
                <FaLock size={32} color="var(--chakra-colors-brandPrimary)" />
              </div>
              <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Admin Console</h2>
              <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "0.85rem", marginTop: "8px" }}>Enter admin password key to log in</p>
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
      <ToastContainer position="top-center" theme="dark" />
      {decryptTarget && <div role="dialog" aria-modal="true" aria-label="Secure file download" style={{ position: "fixed", inset: 0, zIndex: 20000, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.62)" }}>
        <div style={{ width: "min(420px, 100%)", padding: 24, borderRadius: 20, background: "#10192e", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 24px 70px rgba(0,0,0,.55)" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Secure download</h2>
          <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: ".86rem", lineHeight: 1.5 }}>Enter the room security code to decrypt <strong>{decryptTarget.name}</strong> locally. The code is never sent to the server.</p>
          {decryptTarget.encrypted && <LoginInput value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="Room security code" autoFocus />}
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}><ActionButton onClick={() => { setDecryptTarget(null); setRoomCode(""); }}>Cancel</ActionButton><LoginButton type="button" onClick={decryptAndDownload}>Download original</LoginButton></div>
        </div>
      </div>}
      <Header>
        <Brand>
          <FaDatabase /> Super Admin Console
        </Brand>
        <div style={{ display: "flex", gap: "10px" }}>
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

          <FilterSelect value={dateRange} onChange={(e) => setDateRange(e.target.value)} title="Filter by upload date">
            <option value="all">All dates</option>
            <option value="1">Last 24 hours</option>
            <option value="5">Last 5 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 2 months</option>
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
                      <td><button type="button" onClick={() => setPreviewItem(item)} title="Preview file" style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer" }}>{renderPreview(item)}</button></td>
                      <td>
                        <FileLink href={item.url} onClick={(e) => { e.preventDefault(); setDecryptTarget(item); }}>
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
                        <ActionButton onClick={() => setPreviewItem(item)} title="Preview file"><FaEye /></ActionButton>{" "}
                        <ActionButton $danger title="Permanently delete this file" onClick={() => handleDelete(item.roomId, item.id)}>
                          <FaTrash /> Delete
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </GridTable>
            </TableCard> : <UploadGrid>
              {filteredUploads.map((item) => (
                <UploadGridCard key={item.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}><button type="button" onClick={() => setPreviewItem(item)} title="Preview file" style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer" }}>{renderPreview(item)}</button><div style={{ minWidth: 0, flex: 1 }}><FileLink href={item.url} onClick={(e) => { e.preventDefault(); setDecryptTarget(item); }} style={{ padding: 0, border: 0, background: "transparent" }}>{item.name}</FileLink><div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}><Badge>{(item.source || "realtime") === "cloudinary" ? "Cloudinary" : "Realtime"}</Badge>{item.type && <Badge $brand>{item.type.split('/')[0]}</Badge>}</div></div><ActionButton onClick={() => setPreviewItem(item)} title="Preview file"><FaEye /></ActionButton></div>
                  <div style={{ display: "grid", gap: 5, fontSize: ".78rem", color: "var(--chakra-colors-textSecondary)" }}><span>Room: <strong style={{ color: "var(--chakra-colors-textPrimary)" }}>{item.roomId}</strong></span><span>By: <strong style={{ color: "var(--chakra-colors-textPrimary)" }}>{item.uploadedBy}</strong></span><span>{new Date(item.timestamp).toLocaleString()}</span></div>
                  <ActionButton $danger onClick={() => handleDelete(item.roomId, item.id)} style={{ justifyContent: "center" }}><FaTrash /> Delete permanently</ActionButton>
                </UploadGridCard>
              ))}
            </UploadGrid>}

            {viewMode === "list" && <MobileCardList>
              {filteredUploads.map((item) => (
                <MobileCard key={item.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{renderPreview(item)}<div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: ".72rem", color: "var(--chakra-colors-textSecondary)", textTransform: "uppercase", fontWeight: 700 }}>Preview</div><div style={{ display: "flex", gap: 6, marginTop: 5 }}><Badge>{(item.source || "realtime") === "cloudinary" ? "Cloudinary" : "Realtime"}</Badge>{item.type && <Badge $brand>{item.type.split('/')[0]}</Badge>}</div></div></div>
                  <MobileCardRow>
                    <span>File</span>
                    <FileLink href={item.url} target="_blank" rel="noreferrer">
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
      </ContentContainer>
      {previewItem && <div role="dialog" aria-modal="true" aria-label="File preview" onClick={() => setPreviewItem(null)} style={{ position: "fixed", inset: 0, zIndex: 12000, background: "rgba(0,0,0,.76)", backdropFilter: "blur(8px)", padding: 20, display: "grid", placeItems: "center" }}>
        <div onClick={(event) => event.stopPropagation()} style={{ width: "min(760px, 100%)", maxHeight: "90dvh", overflow: "auto", borderRadius: 20, padding: 16, background: "#151720", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 28px 80px rgba(0,0,0,.55)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{previewItem.name}</strong><ActionButton onClick={() => setPreviewItem(null)}>Close</ActionButton></div>
          {(previewItem.type || "").startsWith("image/") ? <img src={previewItem.url} alt={previewItem.name} style={{ display: "block", width: "100%", maxHeight: "68dvh", objectFit: "contain", borderRadius: 12, background: "#090a0e" }} /> : (previewItem.type || "").startsWith("video/") ? <video src={previewItem.url} controls autoPlay playsInline style={{ display: "block", width: "100%", maxHeight: "68dvh", borderRadius: 12, background: "#090a0e" }} /> : <a href={previewItem.url} target="_blank" rel="noreferrer" style={{ display: "block", padding: 30, textAlign: "center", color: "var(--chakra-colors-brandPrimary)" }}>Open this file in a new tab</a>}
        </div>
      </div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AdminWrapper>
  );
}
