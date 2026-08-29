import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import styled, { css } from "styled-components";
import { io } from "socket.io-client";
import {
  FaUsers,
  FaDoorOpen,
  FaBell,
  FaCheck,
  FaTimes,
  FaEyeSlash,
  FaMicrophoneSlash,
  FaTrash,
  FaCog,
  FaSync,
  FaLock,
  FaCalendarAlt,
  FaRegCommentDots,
  FaUserShield,
  FaImage,
  FaVideo,
  FaComments,
  FaPaintBrush,
  FaWhatsapp,
  FaChevronDown,
  FaChevronRight,
  FaCrown,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { BREAKPOINTS } from "../hooks/useIsMobile";
import {
  PLAN_META,
  PLAN_IDS,
  planLimitRows,
  planIncludes,
  FEATURE_GROUPS as PLAN_FEATURE_GROUPS,
} from "../lib/planSpecs";

const GROUP_ICONS = {
  "Calls & Media": FaVideo,
  Messaging: FaComments,
  "Media & Files": FaImage,
  Collaboration: FaPaintBrush,
  Platform: FaCog,
};

const FEATURE_GROUPS = PLAN_FEATURE_GROUPS.map((g) => ({ ...g, icon: GROUP_ICONS[g.label] || FaCog }));

/* ── STYLED COMPONENTS ── */

const TabBar = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--chakra-colors-borderSubtle);
  padding-bottom: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const TabButton = styled.button`
  min-height: 36px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.$active ? "var(--chakra-colors-badgeBorder)" : "transparent")};
  background: ${(p) => (p.$active ? "var(--chakra-colors-badgeBg)" : "transparent")};
  color: ${(p) => (p.$active ? "var(--chakra-colors-brandText)" : "var(--chakra-colors-textSecondary)")};
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &:hover {
    background: var(--chakra-colors-featuredBg);
    color: var(--chakra-colors-textPrimary);
  }
`;

const BadgeCount = styled.span`
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 99px;
  background: ${(p) => (p.$active ? "var(--chakra-colors-brandText)" : "var(--chakra-colors-badgeBg)")};
  color: ${(p) => (p.$active ? "var(--chakra-colors-onBrand)" : "var(--chakra-colors-textSecondary)")};
  font-weight: 800;
`;

const RoomGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  @media (max-width: ${BREAKPOINTS.sm}px) { grid-template-columns: 1fr; gap: 10px; }
`;

const RoomCard = styled.article`
  background: var(--chakra-colors-glassBg);
  backdrop-filter: blur(16px) saturate(1.25);
  -webkit-backdrop-filter: blur(16px) saturate(1.25);
  border: 1px solid var(--chakra-colors-border);
  box-shadow: var(--chakra-shadows-cardShadow), inset 0 1px 0 var(--chakra-colors-borderSubtle);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease, box-shadow 0.22s ease;
  &:hover {
    border-color: var(--chakra-colors-brandText);
    transform: translateY(-3px);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
`;

const RoomBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-badgeBorder);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--chakra-colors-textPrimary);
  svg { color: var(--chakra-colors-brandText); }
`;

const StatusIndicator = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.65rem;
  font-weight: 700;
  color: #2ed573;
  background: rgba(46, 213, 115, 0.06);
  border: 1px solid rgba(46, 213, 115, 0.15);
  padding: 3px 8px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PulseDot = styled.span`
  width: 5px;
  height: 5px;
  background-color: #2ed573;
  border-radius: 50%;
  animation: pulseCC 1.8s infinite ease-in-out;
  @keyframes pulseCC {
    0% { transform: scale(0.9); opacity: 0.6; }
    50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 6px #2ed573; }
    100% { transform: scale(0.9); opacity: 0.6; }
  }
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  background: var(--chakra-colors-featuredBg);
  border: 1px solid var(--chakra-colors-borderSubtle);
  border-radius: 10px;
  padding: 10px;
  @media (max-width: ${BREAKPOINTS.xs}px) { grid-template-columns: 1fr; }
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  ${p => p.$wide && css`grid-column: span 2;`}
  span:first-child {
    font-size: 0.62rem;
    text-transform: uppercase;
    color: var(--chakra-colors-textSecondary);
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  span:last-child {
    font-size: 0.82rem;
    font-weight: 800;
    color: var(--chakra-colors-textPrimary);
  }
`;

const ParticipantContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const AvatarStack = styled.div`
  display: flex;
  align-items: center;
`;

const StackAvatar = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chakra-colors-brandText), var(--chakra-colors-brandTextSecondary));
  border: 2px solid var(--chakra-colors-bg);
  margin-left: -5px;
  display: grid;
  place-items: center;
  font-size: 0.6rem;
  font-weight: 800;
  color: var(--chakra-colors-onBrand);
  cursor: pointer;
  transition: transform 0.15s ease;
  &:hover { transform: scale(1.15) translateY(-1px); z-index: 10; }
  &:first-child { margin-left: 0; }
`;

const ExtraAvatarCount = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--chakra-colors-badgeBg);
  border: 2px solid var(--chakra-colors-bg);
  margin-left: -5px;
  display: grid;
  place-items: center;
  font-size: 0.6rem;
  font-weight: 800;
  color: var(--chakra-colors-textSecondary);
`;

const ParticipantTag = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--chakra-colors-textSecondary);
  transition: background 0.15s;
  &:hover { background: var(--chakra-colors-badgeBg); }
  .kick-btn {
    opacity: 0;
    transition: opacity 0.15s;
    cursor: pointer;
    color: #ff4757;
    background: none;
    border: none;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
  }
  &:hover .kick-btn { opacity: 1; }
`;

const CardActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const ActionBtn = styled.button`
  flex: 1;
  min-height: 32px;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.$danger ? "var(--chakra-colors-dangerBorder)" : "var(--chakra-colors-border)")};
  background: ${(p) => (p.$danger ? "var(--chakra-colors-dangerSoft)" : "var(--chakra-colors-featuredBg)")};
  color: ${(p) => (p.$danger ? "var(--chakra-colors-danger)" : "var(--chakra-colors-textSecondary)")};
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  transition: all 0.15s ease;
  &:hover { background: ${(p) => (p.$danger ? "var(--chakra-colors-dangerHover)" : "var(--chakra-colors-badgeBg)")}; color: ${(p) => (p.$danger ? "var(--chakra-colors-onDanger)" : "var(--chakra-colors-textPrimary)")}; }
`;

const RefreshBtn = styled(ActionBtn)`
  flex: none;
  min-height: 32px;
  padding: 5px 12px;
`;

const NotificationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const NotificationItem = styled.div`
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$unread ? "var(--chakra-colors-badgeBorder)" : "var(--chakra-colors-border)")};
  background: ${(p) => (p.$unread ? "var(--chakra-colors-featuredBg)" : "var(--chakra-colors-badgeBg)")};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.82rem;
  @media (max-width: ${BREAKPOINTS.md}px) {
    flex-direction: column;
    align-items: flex-start;
    > div:last-child { width: 100%; }
  }
`;

/* ── SETTINGS SECTION ── */

const SettingsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SectionCard = styled.div`
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 12px;
  padding: 14px 16px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 0.88rem;
  color: var(--chakra-colors-textPrimary);
  cursor: ${p => p.$collapsible ? "pointer" : "default"};
  user-select: none;
  &:hover { color: ${p => p.$collapsible ? "var(--chakra-colors-brandText)" : "var(--chakra-colors-textPrimary)"}; }
`;

const SectionDesc = styled.p`
  margin: 6px 0 0;
  font-size: 0.75rem;
  color: var(--chakra-colors-textSecondary);
  line-height: 1.5;
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--chakra-colors-borderSubtle);
  &:last-child { border-bottom: none; }
  @media (max-width: ${BREAKPOINTS.sm}px) { gap: 8px; }
`;

const ToggleLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--chakra-colors-textPrimary);
`;

const ToggleDesc = styled.div`
  font-size: 0.7rem;
  color: var(--chakra-colors-textSecondary);
  line-height: 1.3;
  margin-top: 1px;
`;

const ToggleSwitch = styled.div`
  position: relative;
  width: 40px;
  min-width: 40px;
  height: 22px;
  background-color: ${(p) => (p.$checked ? "var(--chakra-colors-brandText)" : "var(--chakra-colors-badgeBg)")};
  border-radius: 99px;
  transition: background-color 0.2s ease;
  cursor: pointer;
  flex-shrink: 0;
  &::after {
    content: "";
    position: absolute;
    top: 3px;
    left: ${(p) => (p.$checked ? "21px" : "3px")};
    width: 16px;
    height: 16px;
    background-color: ${(p) => (p.$checked ? "var(--chakra-colors-onBrand)" : "#fff")};
    border-radius: 50%;
    transition: left 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
`;

const PlanGrid = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const PlanCard = styled.button`
  flex: 1 1 130px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 2px solid ${(p) => (p.$selected ? p.$color : "var(--chakra-colors-border)")};
  background: ${(p) => (p.$selected ? `${p.$color}15` : "var(--chakra-colors-badgeBg)")};
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  &:hover { border-color: ${p => p.$color}; }
`;

const PlanLabel = styled.div`
  font-weight: 800;
  font-size: 0.85rem;
  color: ${(p) => (p.$selected ? p.$color : "var(--chakra-colors-textPrimary)")};
  margin-bottom: 3px;
`;

const PlanDesc = styled.div`
  font-size: 0.68rem;
  color: var(--chakra-colors-textSecondary);
  line-height: 1.3;
`;

const PlanRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 2px;
`;

const PlanPill = styled.button`
  padding: 3px 10px;
  border-radius: 99px;
  border: 1px solid ${(p) => (p.$selected ? p.$color : "var(--chakra-colors-badgeBorder)")};
  background: ${(p) => (p.$selected ? `${p.$color}26` : "var(--chakra-colors-badgeBg)")};
  color: ${(p) => (p.$selected ? p.$color : "var(--chakra-colors-textSecondary)")};
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: capitalize;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover { border-color: ${(p) => p.$color}; color: ${(p) => p.$color}; }
`;

const ROOM_PLANS = PLAN_IDS.map((id) => ({ id, label: PLAN_META[id].label, color: PLAN_META[id].color }));

const EmptyState = styled.p`
  color: var(--chakra-colors-textSecondary);
  text-align: center;
  padding: 40px 20px;
  margin: 0;
  font-size: 0.85rem;
  border: 1px dashed var(--chakra-colors-border);
  border-radius: 12px;
  background: var(--chakra-colors-badgeBg);
`;

/* ── MODAL ── */

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 25000;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 20px;
  animation: fadeInCC 0.2s ease;
  @keyframes fadeInCC { from { opacity: 0; } to { opacity: 1; } }
`;

const ModalContent = styled.div`
  width: min(420px, 100%);
  padding: 22px;
  border-radius: 14px;
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-border);
  box-shadow: 0 24px 38px 3px rgba(0, 0, 0, 0.5);
  animation: slideUpCC 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  @keyframes slideUpCC { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;

const ModalTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--chakra-colors-textPrimary);
`;

const ModalBody = styled.p`
  margin: 0 0 18px;
  color: var(--chakra-colors-textSecondary);
  font-size: 0.82rem;
  line-height: 1.5;
`;

const ModalInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--chakra-colors-badgeBorder);
  background: var(--chakra-colors-badgeBg);
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 0.88rem;
  margin-bottom: 18px;
  box-sizing: border-box;
  &:focus { border-color: var(--chakra-colors-brandText); }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  @media (max-width: ${BREAKPOINTS.sm}px) { flex-direction: column-reverse; }
`;

const ModalBtn = styled.button`
  min-height: 36px;
  padding: 7px 14px;
  border-radius: 8px;
  border: ${(p) => (p.$primary ? "none" : "1px solid var(--chakra-colors-badgeBorder)")};
  background: ${(p) =>
    p.$primary ? (p.$danger ? "var(--chakra-colors-danger)" : "var(--chakra-colors-brandText)") : "transparent"};
  color: ${(p) => (p.$primary ? "var(--chakra-colors-onBrand)" : "var(--chakra-colors-textSecondary)")};
  font-weight: 700;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover { background: ${(p) => p.$primary ? (p.$danger ? "var(--chakra-colors-dangerHover)" : "var(--chakra-colors-brandHover)") : "var(--chakra-colors-badgeBg)"}; color: ${(p) => p.$primary ? "var(--chakra-colors-onBrand)" : "var(--chakra-colors-textPrimary)"}; }
`;

/* ── FORM ── */

const SettingsForm = styled.form`
  padding-top: 14px;
  border-top: 1px solid var(--chakra-colors-borderSubtle);
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 420px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const FormLabel = styled.label`
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--chakra-colors-textSecondary);
`;

const FormInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--chakra-colors-badgeBorder);
  background: var(--chakra-colors-featuredBg);
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 0.82rem;
  box-sizing: border-box;
  &:focus { border-color: var(--chakra-colors-brandText); background: var(--chakra-colors-badgeBg); }
`;

const FormSubmitBtn = styled.button`
  align-self: flex-start;
  min-height: 34px;
  padding: 7px 16px;
  border-radius: 8px;
  border: none;
  background: var(--chakra-colors-brandText);
  color: var(--chakra-colors-onBrand);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { opacity: 0.9; }
`;

/* ── HELPERS ── */

function formatTime(ts) {
  if (!ts) return "\u2014";
  return new Date(ts).toLocaleString();
}

/* ── COMPONENT ── */

export default function AdminControlCenter({ token, backendUrl }) {
  const [tab, setTab] = useState("rooms");
  const [rooms, setRooms] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState({ requireRoomApproval: false });
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [callmebotKey, setCallmebotKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [promptInput, setPromptInput] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const map = {};
    FEATURE_GROUPS.forEach((g) => { map[g.label] = true; });
    return map;
  });
  const socketRef = useRef(null);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  /* ── DATA FETCHING ── */

  const fetchRooms = useCallback(async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/admin/rooms`, { headers: authHeaders() });
      setRooms(res.data.rooms || []);
    } catch {}
  }, [backendUrl, authHeaders]);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/admin/room-requests`, { headers: authHeaders() });
      setRequests(res.data.requests || []);
    } catch {}
  }, [backendUrl, authHeaders]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/admin/notifications`, { headers: authHeaders() });
      setNotifications(res.data.notifications || []);
    } catch {}
  }, [backendUrl, authHeaders]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/admin/settings`, { headers: authHeaders() });
      const s = res.data.settings || {};
      setSettings(s);
      setWhatsappPhone(s.whatsappPhone || "");
      setCallmebotKey(s.callmebotKey || "");
    } catch {}
  }, [backendUrl, authHeaders]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([fetchRooms(), fetchRequests(), fetchNotifications(), fetchSettings()]);
    setLoading(false);
  }, [fetchRooms, fetchRequests, fetchNotifications, fetchSettings]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  /* ── SOCKET ── */

  useEffect(() => {
    if (!token || !backendUrl) return;
    const s = io(backendUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = s;

    s.on("adminNotification", () => fetchNotifications());
    s.on("adminRoomUpdated", () => fetchRooms());
    s.on("adminRoomRequestUpdated", () => fetchRequests());
    s.on("adminRoomClosed", () => fetchRooms());
    s.on("adminSettingsUpdated", (data) => {
      if (data?.settings) setSettings(data.settings);
    });

    return () => { s.disconnect(); socketRef.current = null; };
  }, [token, backendUrl, fetchRooms, fetchRequests, fetchNotifications, fetchSettings]);

  /* ── HANDLERS ── */

  const handleToggleApproval = async () => {
    const newVal = !settings.requireRoomApproval;
    setSettings((prev) => ({ ...prev, requireRoomApproval: newVal }));
    try {
      await axios.patch(`${backendUrl}/api/admin/settings`, { requireRoomApproval: newVal }, { headers: authHeaders() });
    } catch {}
  };

  const handleSaveWhatsAppSettings = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${backendUrl}/api/admin/settings`, { whatsappPhone, callmebotKey }, { headers: authHeaders() });
      toast.success("WhatsApp settings saved.");
    } catch {
      toast.error("Failed to save WhatsApp settings.");
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await axios.post(`${backendUrl}/api/admin/room-requests/${requestId}/approve`, {}, { headers: authHeaders() });
      toast.success("Room request approved.");
      fetchRequests();
    } catch {
      toast.error("Failed to approve request.");
    }
  };

  const handleReject = (requestId) => {
    setModal({
      type: "prompt",
      title: "Reject Request",
      body: "Optionally provide a reason for rejection:",
      confirmLabel: "Reject",
      confirmDanger: true,
      onConfirm: async (reason) => {
        try {
          await axios.post(`${backendUrl}/api/admin/room-requests/${requestId}/reject`, { reason }, { headers: authHeaders() });
          toast.info("Room request rejected.");
          fetchRequests();
        } catch { toast.error("Failed to reject request."); }
      },
    });
  };

  const handleStealthJoin = async (roomId) => {
    try {
      const res = await axios.post(`${backendUrl}/api/admin/rooms/${encodeURIComponent(roomId)}/stealth-token`, {}, { headers: authHeaders() });
      if (res.data?.token) window.open(`/room/${roomId}?stealth=${res.data.token}`, "_blank");
    } catch { toast.error("Failed to stealth join."); }
  };

  const handleChangeRoomPlan = async (roomId, plan) => {
    try {
      await axios.patch(`${backendUrl}/api/admin/rooms/${encodeURIComponent(roomId)}/plan`, { plan }, { headers: authHeaders() });
      setRooms((prev) => prev.map((r) => (r.roomId === roomId ? { ...r, plan } : r)));
      toast.success(`Room plan set to ${plan}.`);
    } catch {
      toast.error("Failed to change room plan.");
    }
  };

  const handleCloseRoom = (roomId) => {
    setModal({
      type: "confirm",
      title: "Close Room",
      body: `Are you sure you want to close room "${roomId}"? This will disconnect all participants.`,
      confirmLabel: "Close Room",
      confirmDanger: true,
      onConfirm: async () => {
        try {
          await axios.delete(`${backendUrl}/api/admin/rooms/${encodeURIComponent(roomId)}`, { headers: authHeaders() });
          toast.success("Room closed.");
          fetchRooms();
        } catch { toast.error("Failed to close room."); }
      },
    });
  };

  const handleKickParticipant = (roomId, participantName) => {
    if (!socketRef.current) return;
    socketRef.current.emit("adminKickUser", { roomId, userName: participantName });
    socketRef.current.emit("kick-from-room", { roomId, userName: participantName });
    socketRef.current.emit("admin-kick-user", { roomId, userName: participantName });
    toast.info(`Kicked ${participantName} from room.`);
  };

  const handleMuteParticipant = (roomId, participantName) => {
    if (!socketRef.current) return;
    // Same event the in-call host moderation uses; LiveMeeting mutes on receipt
    socketRef.current.emit("admin-mute-user", { roomId, name: participantName });
    toast.info(`Mute request sent for ${participantName}.`);
  };

  const markAllRead = async () => {
    try {
      await axios.post(`${backendUrl}/api/admin/notifications/read`, {}, { headers: authHeaders() });
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  /* ── FEATURE FLAG TOGGLE ── */

  const toggleFeature = (key) => {
    const newVal = settings.features?.[key] === false;
    const updatedFeatures = { ...(settings.features || {}), [key]: newVal };
    setSettings((prev) => ({ ...prev, features: updatedFeatures }));
    axios.patch(`${backendUrl}/api/admin/settings`, { features: updatedFeatures }, { headers: authHeaders() }).catch(() => {});
  };

  const toggleGroup = (label) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  /* ── RENDER ── */

  return (
    <section>
      {/* ── TAB BAR ── */}
      <TabBar>
        <TabButton $active={tab === "rooms"} onClick={() => setTab("rooms")}>
          <FaDoorOpen /> Rooms <BadgeCount>{rooms.length}</BadgeCount>
        </TabButton>
        <TabButton $active={tab === "requests"} onClick={() => setTab("requests")}>
          <FaLock /> Requests <BadgeCount $active={requests.length > 0}>{requests.length}</BadgeCount>
        </TabButton>
        <TabButton $active={tab === "notifications"} onClick={() => setTab("notifications")}>
          <FaBell /> Notifications <BadgeCount $active={notifications.some((n) => !n.read)}>{notifications.length}</BadgeCount>
        </TabButton>
        <TabButton $active={tab === "settings"} onClick={() => setTab("settings")}>
          <FaCog /> Settings
        </TabButton>
        <RefreshBtn onClick={refreshAll} disabled={loading} title="Refresh all">
          <FaSync spin={loading || undefined} />
        </RefreshBtn>
      </TabBar>

      {/* ── ROOMS TAB ── */}
      {tab === "rooms" && (
        rooms.length === 0 ? (
          <EmptyState>No active rooms right now.</EmptyState>
        ) : (
          <RoomGrid>
            {rooms.map((room) => (
              <RoomCard key={room.roomId}>
                <CardHeader>
                  <RoomBadge><FaDoorOpen size={12} /> #{room.roomId}</RoomBadge>
                  <StatusIndicator><PulseDot /> Active</StatusIndicator>
                </CardHeader>

                <MetricGrid>
                  <MetricItem>
                    <span><FaUsers size={9} /> Participants</span>
                    <span>{room.participantCount ?? 0}</span>
                  </MetricItem>
                  <MetricItem>
                    <span><FaRegCommentDots size={9} /> Messages</span>
                    <span>{room.messageCount ?? 0}</span>
                  </MetricItem>
                  <MetricItem $wide>
                    <span><FaUserShield size={9} /> Owner</span>
                    <span>{room.owner || "\u2014"}</span>
                  </MetricItem>
                  <MetricItem $wide>
                    <span><FaCalendarAlt size={9} /> Created</span>
                    <span>{formatTime(room.createdAt)}</span>
                  </MetricItem>
                </MetricGrid>

                <PlanRow>
                  <span style={{ fontSize: "0.62rem", textTransform: "uppercase", color: "var(--chakra-colors-textSecondary)", fontWeight: 600, letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <FaCrown size={9} color="#f59e0b" /> Plan
                  </span>
                  {ROOM_PLANS.map((p) => (
                    <PlanPill
                      key={p.id}
                      $selected={(room.plan || settings.plan) === p.id}
                      $color={p.color}
                      onClick={() => handleChangeRoomPlan(room.roomId, p.id)}
                      title={`Apply ${p.label} plan to this room`}
                    >
                      {p.label}
                    </PlanPill>
                  ))}
                </PlanRow>

                {room.participants?.length > 0 && (
                  <ParticipantContainer>
                    <AvatarStack>
                      {room.participants.slice(0, 5).map((p, i) => (
                        <StackAvatar key={i} title={p.name || p}>{(p.name || p || "?")[0].toUpperCase()}</StackAvatar>
                      ))}
                      {room.participants.length > 5 && <ExtraAvatarCount>+{room.participants.length - 5}</ExtraAvatarCount>}
                    </AvatarStack>
                  </ParticipantContainer>
                )}

                {room.participants?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {room.participants.map((p, i) => {
                      const name = p.name || p;
                      return (
                        <ParticipantTag key={i}>
                          <span>{name}</span>
                          <button className="kick-btn" onClick={() => handleMuteParticipant(room.roomId, name)} title="Force-mute their microphone">
                            <FaMicrophoneSlash size={9} /> Mute
                          </button>
                          <button className="kick-btn" onClick={() => handleKickParticipant(room.roomId, name)}>
                            <FaTimes size={9} /> Kick
                          </button>
                        </ParticipantTag>
                      );
                    })}
                  </div>
                )}

                <CardActions>
                  {settings.features?.stealthMode !== false && (
                  <ActionBtn onClick={() => handleStealthJoin(room.roomId)} title="Join as stealth observer">
                    <FaEyeSlash size={11} /> Stealth
                  </ActionBtn>
                  )}
                  <ActionBtn $danger onClick={() => handleCloseRoom(room.roomId)} title="Close this room">
                    <FaTrash size={11} /> Close
                  </ActionBtn>
                </CardActions>
              </RoomCard>
            ))}
          </RoomGrid>
        )
      )}

      {/* ── REQUESTS TAB ── */}
      {tab === "requests" && (
        requests.length === 0 ? (
          <EmptyState>No pending room requests.</EmptyState>
        ) : (
          <NotificationList>
            {requests.map((req) => (
              <NotificationItem key={req._id} $unread>
                <div>
                  <div style={{ fontWeight: 700 }}>{req.roomId || "New Room"}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--chakra-colors-textSecondary)", marginTop: 2 }}>
                    Requested by {req.requestedBy || "Unknown"} \u2022 {formatTime(req.createdAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <ActionBtn onClick={() => handleApprove(req._id)} style={{ flex: "none" }}>
                    <FaCheck size={11} /> Approve
                  </ActionBtn>
                  <ActionBtn $danger onClick={() => handleReject(req._id)} style={{ flex: "none" }}>
                    <FaTimes size={11} /> Reject
                  </ActionBtn>
                </div>
              </NotificationItem>
            ))}
          </NotificationList>
        )
      )}

      {/* ── NOTIFICATIONS TAB ── */}
      {tab === "notifications" && (
        <>
          {notifications.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <ActionBtn onClick={markAllRead} style={{ flex: "none" }}>
                <FaCheck size={11} /> Mark all read
              </ActionBtn>
            </div>
          )}
          {notifications.length === 0 ? (
            <EmptyState>No notifications.</EmptyState>
          ) : (
            <NotificationList>
              {notifications.map((n) => (
                <NotificationItem key={n._id || n.id} $unread={!n.read}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{n.title || n.type || "Notification"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--chakra-colors-textSecondary)", marginTop: 2 }}>
                      {n.message || n.body || ""} {n.createdAt ? `\u2022 ${formatTime(n.createdAt)}` : ""}
                    </div>
                  </div>
                </NotificationItem>
              ))}
            </NotificationList>
          )}
        </>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === "settings" && (
        <SettingsWrapper>
          {/* Room Approval */}
          <SectionCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>Require Room Approval</div>
                <div style={{ fontSize: "0.72rem", color: "var(--chakra-colors-textSecondary)", marginTop: 2 }}>
                  Users must submit a request with a password before creating a room.
                </div>
              </div>
              <ToggleSwitch
                $checked={Boolean(settings.requireRoomApproval)}
                onClick={handleToggleApproval}
                role="checkbox"
                aria-checked={Boolean(settings.requireRoomApproval)}
              />
            </div>
          </SectionCard>

          {/* Subscription Plan */}
          <SectionCard>
            <SectionHeader>
              <FaCrown size={14} color="#f59e0b" /> Subscription Plan
            </SectionHeader>
            <SectionDesc>Choose the plan tier for feature limits and participant caps.</SectionDesc>
            <PlanGrid style={{ marginTop: 10 }}>
              {PLAN_IDS.map((id) => {
                const meta = PLAN_META[id];
                const selected = settings.plan === id;
                return (
                  <PlanCard
                    key={id}
                    $selected={selected}
                    $color={meta.color}
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, plan: id }));
                      axios.patch(`${backendUrl}/api/admin/settings`, { plan: id }, { headers: authHeaders() }).catch(() => {});
                    }}
                  >
                    <PlanLabel $selected={selected} $color={meta.color}>{meta.label}</PlanLabel>
                    <PlanDesc>{meta.desc}</PlanDesc>
                  </PlanCard>
                );
              })}
            </PlanGrid>

            {settings.plan && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: "var(--chakra-colors-textSecondary)" }}>
                    What's included
                  </span>
                  <span style={{ flex: 1, height: 1, background: "var(--chakra-colors-borderSubtle)" }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {planLimitRows(settings.plan, settings.planLimits?.[settings.plan]).map((row) => (
                    <span key={row.key} style={{ fontSize: "0.68rem", fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: "var(--chakra-colors-badgeBg)", color: "var(--chakra-colors-textPrimary)", border: "1px solid var(--chakra-colors-badgeBorder)" }}>
                      {row.label}: <span style={{ color: PLAN_META[settings.plan].color }}>{row.value}</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                  {FEATURE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--chakra-colors-textSecondary)", marginBottom: 5 }}>
                        {group.label}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 5 }}>
                        {group.features.map((feat) => {
                          const included = planIncludes(settings.plan, feat.key);
                          return (
                            <span
                              key={feat.key}
                              title={`${feat.label} — ${feat.desc}`}
                              style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 8px", borderRadius: 8, background: "var(--chakra-colors-badgeBg)", fontSize: "0.72rem", color: "var(--chakra-colors-textPrimary)", opacity: included ? 1 : 0.62 }}
                            >
                              {included ? (
                                <FaCheck size={10} color={PLAN_META[settings.plan].color} style={{ flexShrink: 0 }} />
                              ) : (
                                <FaTimes size={10} color="var(--chakra-colors-textMuted)" style={{ flexShrink: 0 }} />
                              )}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{feat.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: "0.68rem", color: "var(--chakra-colors-textSecondary)" }}>
                  Feature toggles above still apply globally on top of plan entitlements.
                </div>
              </div>
            )}
          </SectionCard>

          {/* Feature Flags — Grouped */}
          <SectionCard>
            <SectionHeader>
              <FaCog size={14} /> Feature Flags
            </SectionHeader>
            <SectionDesc>Toggle features on or off for all users. Disabled features show a banner.</SectionDesc>
            <div style={{ marginTop: 10 }}>
              {FEATURE_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                const expanded = expandedGroups[group.label];
                return (
                  <div key={group.label} style={{ marginBottom: 6 }}>
                    <SectionHeader
                      $collapsible
                      onClick={() => toggleGroup(group.label)}
                      style={{ padding: "8px 0", fontSize: "0.8rem" }}
                    >
                      {expanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                      <GroupIcon size={12} />
                      {group.label}
                      <BadgeCount style={{ marginLeft: "auto" }}>
                        {group.features.filter((f) => settings.features?.[f.key] !== false).length}/{group.features.length}
                      </BadgeCount>
                    </SectionHeader>
                    {expanded && (
                      <div style={{ paddingLeft: 22 }}>
                        {group.features.map((f) => (
                          <ToggleRow key={f.key}>
                            <div>
                              <ToggleLabel>{f.label}</ToggleLabel>
                              <ToggleDesc>{f.desc}</ToggleDesc>
                            </div>
                            <ToggleSwitch
                              $checked={settings.features?.[f.key] !== false}
                              onClick={() => toggleFeature(f.key)}
                              role="checkbox"
                              aria-checked={settings.features?.[f.key] !== false}
                            />
                          </ToggleRow>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* WhatsApp */}
          <SectionCard>
            <SettingsForm onSubmit={handleSaveWhatsAppSettings}>
              <SectionHeader>
                <FaWhatsapp size={14} color="#25d366" /> WhatsApp Alerts
              </SectionHeader>
              <SectionDesc>
                Add <strong>+34 644 51 95 23</strong> on WhatsApp and send "I allow callmebot to send me messages" to get a free API key.
              </SectionDesc>
              <FormGroup>
                <FormLabel>Admin Phone Number</FormLabel>
                <FormInput type="text" placeholder="e.g. +919876543210" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} />
              </FormGroup>
              <FormGroup>
                <FormLabel>CallMeBot API Key</FormLabel>
                <FormInput type="password" placeholder="e.g. 123456" value={callmebotKey} onChange={(e) => setCallmebotKey(e.target.value)} />
              </FormGroup>
              <FormSubmitBtn type="submit">Save Configuration</FormSubmitBtn>
            </SettingsForm>
          </SectionCard>
        </SettingsWrapper>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <ModalOverlay onClick={() => setModal(null)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{modal.title}</ModalTitle>
            <ModalBody>{modal.body}</ModalBody>
            {modal.type === "prompt" && (
              <ModalInput type="text" value={promptInput} onChange={(e) => setPromptInput(e.target.value)} autoFocus />
            )}
            <ModalActions>
              <ModalBtn type="button" onClick={() => setModal(null)}>Cancel</ModalBtn>
              <ModalBtn
                type="button"
                $primary
                $danger={modal.confirmDanger}
                onClick={() => {
                  modal.onConfirm(modal.type === "prompt" ? promptInput : null);
                  setModal(null);
                }}
              >
                {modal.confirmLabel}
              </ModalBtn>
            </ModalActions>
          </ModalContent>
        </ModalOverlay>
      )}
    </section>
  );
}
