import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import styled from "styled-components";
import { FaTrash, FaSearch, FaEye, FaEyeSlash, FaDownload, FaSignOutAlt, FaFolder, FaDatabase, FaLock, FaUsers, FaCog } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";

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
  const [search, setSearch] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com";

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
    }
  }, [token, fetchUploads]);

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
    if (!window.confirm("Are you sure you want to permanently delete this file and remove its message from chat history?")) return;
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
    let result = uploads;

    if (selectedRoom) {
      result = result.filter(item => item.roomId === selectedRoom);
    }
    if (selectedUser) {
      result = result.filter(item => item.uploadedBy === selectedUser);
    }

    const query = search.toLowerCase();
    if (query) {
      result = result.filter(item => 
        (item.name || "").toLowerCase().includes(query) ||
        (item.roomId || "").toLowerCase().includes(query) ||
        (item.uploadedBy || "").toLowerCase().includes(query)
      );
    }

    return result;
  }, [uploads, search, selectedRoom, selectedUser]);

  const stats = useMemo(() => {
    const totalFiles = uploads.length;
    const uniqueRooms = new Set(uploads.map(item => item.roomId)).size;
    const uniqueUsers = new Set(uploads.map(item => item.uploadedBy)).size;
    return { totalFiles, uniqueRooms, uniqueUsers };
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
        </StatsGrid>

         <FilterSection>
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

           <ActionButton onClick={() => fetchUploads(token)}>Refresh Data</ActionButton>
         </FilterSection>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--chakra-colors-textSecondary)" }}>
            Loading dashboard data...
          </div>
        ) : filteredUploads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px", color: "var(--chakra-colors-textSecondary)", background: "rgba(255,255,255,0.01)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.04)" }}>
            No uploads found.
          </div>
        ) : (
          <>
            <TableCard>
              <GridTable>
                <thead>
                  <tr>
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
                      <td>
                        <FileLink href={item.url} target="_blank" rel="noreferrer">
                          <FaDownload style={{ flexShrink: 0, color: "var(--chakra-colors-brandPrimary)" }} />
                          {item.name}
                        </FileLink>
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
                        <ActionButton $danger onClick={() => handleDelete(item.roomId, item.id)}>
                          <FaTrash /> Delete
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </GridTable>
            </TableCard>

            <MobileCardList>
              {filteredUploads.map((item) => (
                <MobileCard key={item.id}>
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
            </MobileCardList>
          </>
        )}
      </ContentContainer>
    </AdminWrapper>
  );
}
