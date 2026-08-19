import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import styled from "styled-components";
import { io } from "socket.io-client";
import {
  FaUsers,
  FaDoorOpen,
  FaBell,
  FaCheck,
  FaTimes,
  FaEyeSlash,
  FaTrash,
  FaCog,
  FaSync,
  FaLock,
  FaCalendarAlt,
  FaRegCommentDots,
  FaUserShield,
} from "react-icons/fa";
import { toast } from "react-toastify";

/* ── STYLED COMPONENTS (SaaS Aesthetic) ── */

const TabBar = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 28px;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 16px;

  @media (max-width: 600px) {
    gap: 6px;
    margin-bottom: 18px;
    padding-bottom: 12px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
`;

const TabButton = styled.button`
  min-height: 42px;
  padding: 8px 18px;
  border-radius: 12px;
  border: 1px solid ${(p) => (p.$active ? "rgba(255, 63, 94, 0.3)" : "rgba(255, 255, 255, 0.05)")};
  background: ${(p) => (p.$active ? "rgba(255, 63, 94, 0.08)" : "rgba(255, 255, 255, 0.02)")};
  color: ${(p) => (p.$active ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-textSecondary)")};
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: rgba(255, 63, 94, 0.4);
    color: var(--chakra-colors-textPrimary);
    background: rgba(255, 63, 94, 0.04);
  }

  @media (max-width: 600px) {
    min-height: 36px;
    padding: 6px 12px;
    font-size: 0.78rem;
    border-radius: 10px;
    gap: 5px;
  }
`;

const BadgeCount = styled.span`
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 99px;
  background: ${(p) => (p.$active ? "var(--chakra-colors-brandPrimary)" : "rgba(255, 255, 255, 0.08)")};
  color: ${(p) => (p.$active ? "#fff" : "var(--chakra-colors-textSecondary)")};
  font-weight: 800;
  transition: all 0.2s ease;
`;

const RoomGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
`;

const RoomCard = styled.article`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  position: relative;
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.25);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, transparent, rgba(255, 63, 94, 0.45), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    border-color: rgba(255, 63, 94, 0.25);
    transform: translateY(-3px);
    box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.35), 0 0 1px 1px rgba(255, 63, 94, 0.15);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);

    &::before {
      opacity: 1;
    }
  }

  @media (max-width: 480px) {
    padding: 16px;
    gap: 12px;
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const RoomBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.01em;

  svg {
    color: var(--chakra-colors-brandPrimary);
  }
`;

const StatusIndicator = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #2ed573;
  background: rgba(46, 213, 115, 0.06);
  border: 1px solid rgba(46, 213, 115, 0.15);
  padding: 4px 10px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PulseDot = styled.span`
  width: 6px;
  height: 6px;
  background-color: #2ed573;
  border-radius: 50%;
  display: inline-block;
  animation: pulseCC 1.8s infinite ease-in-out;

  @keyframes pulseCC {
    0% { transform: scale(0.9); opacity: 0.6; }
    50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 8px #2ed573; }
    100% { transform: scale(0.9); opacity: 0.6; }
  }
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 14px;

  @media (max-width: 360px) {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 10px;
  }
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  span:first-child {
    font-size: 0.68rem;
    text-transform: uppercase;
    color: var(--chakra-colors-textSecondary);
    font-weight: 600;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  span:last-child {
    font-size: 0.9rem;
    font-weight: 800;
    color: #fff;
  }
`;

const ParticipantContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
`;

const AvatarStack = styled.div`
  display: flex;
  align-items: center;
  margin-left: 6px;
`;

const StackAvatar = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  border: 2px solid #10141d;
  margin-left: -6px;
  display: grid;
  place-items: center;
  font-size: 0.65rem;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  position: relative;
  transition: transform 0.2s ease, z-index 0.2s ease;

  &:hover {
    transform: scale(1.2) translateY(-2px);
    z-index: 10;
  }
`;

const ExtraAvatarCount = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid #10141d;
  margin-left: -6px;
  display: grid;
  place-items: center;
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--chakra-colors-textSecondary);
`;

const CardActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
  margin-top: 4px;
`;

const ActionBtn = styled.button`
  flex: 1;
  min-height: 38px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$danger ? "rgba(255,71,87,0.25)" : "rgba(255, 255, 255, 0.06)")};
  background: ${(p) => (p.$danger ? "rgba(255,71,87,0.06)" : "rgba(255, 255, 255, 0.02)")};
  color: ${(p) => (p.$danger ? "#ff4757" : "var(--chakra-colors-textSecondary)")};
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    background: ${(p) => (p.$danger ? "#ff4757" : "rgba(255, 255, 255, 0.08)")};
    color: #fff;
    border-color: ${(p) => (p.$danger ? "#ff4757" : "rgba(255, 255, 255, 0.12)")};
  }
`;

const NotificationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const NotificationItem = styled.div`
  padding: 18px 20px;
  border-radius: 16px;
  border: 1px solid ${(p) => (p.$unread ? "rgba(255, 63, 94, 0.2)" : "rgba(255, 255, 255, 0.05)")};
  background: ${(p) => (p.$unread ? "rgba(255, 63, 94, 0.04)" : "rgba(255, 255, 255, 0.01)")};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

  @media (max-width: 580px) {
    flex-direction: column;
    align-items: flex-start;
    
    > div:last-child {
      width: 100%;
    }
  }
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%);

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
  }
`;

const ToggleSwitch = styled.div`
  position: relative;
  width: 46px;
  height: 24px;
  background-color: ${(p) => (p.$checked ? "var(--chakra-colors-brandPrimary)" : "rgba(255, 255, 255, 0.12)")};
  border-radius: 99px;
  transition: background-color 0.25s ease;
  cursor: pointer;

  &::after {
    content: "";
    position: absolute;
    top: 3px;
    left: ${(p) => (p.$checked ? "25px" : "3px")};
    width: 18px;
    height: 18px;
    background-color: #fff;
    border-radius: 50%;
    transition: left 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
`;

const EmptyState = styled.p`
  color: var(--chakra-colors-textSecondary);
  text-align: center;
  padding: 60px 20px;
  margin: 0;
  font-size: 0.9rem;
  border: 1px dashed rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.005);
`;

/* ── CUSTOM MODAL OVERLAYS (SaaS style) ── */

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

  @keyframes fadeInCC {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalContent = styled.div`
  width: min(440px, 100%);
  padding: 26px;
  border-radius: 18px;
  background: var(--chakra-colors-surface);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 38px 3px rgba(0, 0, 0, 0.5), 0 9px 46px 8px rgba(0, 0, 0, 0.4);
  animation: slideUpCC 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes slideUpCC {
    from { transform: translateY(12px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const ModalTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--chakra-colors-textPrimary);
`;

const ModalBody = styled.p`
  margin: 0 0 22px;
  color: var(--chakra-colors-textSecondary);
  font-size: 0.85rem;
  line-height: 1.5;
`;

const ModalInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 0.9rem;
  margin-bottom: 22px;
  box-sizing: border-box;
  transition: all 0.2s ease;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(255, 255, 255, 0.05);
    box-shadow: 0 0 0 1px var(--chakra-colors-brandPrimary);
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  @media (max-width: 480px) {
    flex-direction: column-reverse;
    gap: 8px;
  }
`;

const ModalBtn = styled.button`
  min-height: 40px;
  padding: 8px 16px;
  border-radius: 10px;
  border: ${(p) => (p.$primary ? "none" : "1px solid rgba(255, 255, 255, 0.08)")};
  background: ${(p) =>
    p.$primary
      ? p.$danger
        ? "#ff4757"
        : "var(--chakra-colors-brandPrimary)"
      : "transparent"};
  color: ${(p) => (p.$primary ? "#fff" : "var(--chakra-colors-textSecondary)")};
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${(p) =>
      p.$primary
        ? p.$danger
          ? "#ff2f44"
          : "rgba(255, 63, 94, 0.9)"
        : "rgba(255,255,255,0.05)"};
    color: #fff;
  }
`;

/* ── HELPER UTILS ── */

function formatTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

const SettingsForm = styled.form`
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 500px;

  @media (max-width: 600px) {
    max-width: 100%;
  }
`;

const SettingsSectionTitle = styled.div`
  font-weight: 800;
  font-size: 1.05rem;
  color: #fff;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
`;

const FormLabel = styled.label`
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--chakra-colors-textSecondary);
`;

const FormInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: #fff;
  outline: none;
  font-size: 0.88rem;
  box-sizing: border-box;
  transition: all 0.2s ease;

  &:focus {
    border-color: var(--chakra-colors-brandPrimary);
    background: rgba(255, 255, 255, 0.05);
  }
`;

const FormSubmitBtn = styled.button`
  align-self: flex-start;
  min-height: 38px;
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background: var(--chakra-colors-brandPrimary);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }
`;

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
  const [modal, setModal] = useState(null); // { type: 'confirm'|'prompt', title, body, confirmLabel, confirmDanger, onConfirm, defaultVal }
  const [promptInput, setPromptInput] = useState("");
  const socketRef = useRef(null);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const fetchRooms = useCallback(async () => {
    const res = await axios.get(`${backendUrl}/api/admin/rooms`, { headers: authHeaders() });
    setRooms(res.data.rooms || []);
  }, [backendUrl, authHeaders]);

  const handleKickParticipant = (roomId, targetSocketId, targetName) => {
    setModal({
      type: "confirm",
      title: "Remove participant from room?",
      body: `Are you sure you want to remove "${targetName}" from the room "${roomId}"?`,
      confirmLabel: "Remove User",
      confirmDanger: true,
      onConfirm: () => {
        if (socketRef.current) {
          socketRef.current.emit("adminKickUser", { roomId, targetSocketId, name: targetName });
          socketRef.current.emit("kick-from-room", { roomId, targetSocketId, targetName });
          socketRef.current.emit("admin-kick-user", { roomId, peerId: targetSocketId, name: targetName, isRoomKick: true });
        }
        toast.success(`Removal command sent for ${targetName}`);
      }
    });
  };

  const fetchRequests = useCallback(async () => {
    const res = await axios.get(`${backendUrl}/api/admin/room-requests`, { headers: authHeaders() });
    setRequests(res.data.requests || []);
  }, [backendUrl, authHeaders]);

  const fetchNotifications = useCallback(async () => {
    const res = await axios.get(`${backendUrl}/api/admin/notifications`, { headers: authHeaders() });
    setNotifications(res.data.notifications || []);
  }, [backendUrl, authHeaders]);

  const fetchSettings = useCallback(async () => {
    const res = await axios.get(`${backendUrl}/api/admin/settings`, { headers: authHeaders() });
    const s = res.data.settings || { requireRoomApproval: false, adminWhatsAppPhone: "", callmebotApiKey: "" };
    setSettings(s);
    setWhatsappPhone(s.adminWhatsAppPhone || "");
    setCallmebotKey(s.callmebotApiKey || "");
  }, [backendUrl, authHeaders]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRooms(), fetchRequests(), fetchNotifications(), fetchSettings()]);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to refresh admin data.");
    } finally {
      setLoading(false);
    }
  }, [fetchRooms, fetchRequests, fetchNotifications, fetchSettings]);

  useEffect(() => {
    if (!token) return undefined;
    refreshAll();

    const socket = io(backendUrl, {
      transports: ["polling"],
      upgrade: true,
      rememberUpgrade: false
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("adminSubscribe", { token }, (res) => {
        if (res?.success) {
          if (res.rooms) setRooms(res.rooms);
          if (res.requests) setRequests(res.requests);
          if (res.notifications) setNotifications(res.notifications);
          if (res.settings) setSettings(res.settings);
        }
      });
    });

    socket.on("adminNotification", ({ notification }) => {
      if (notification) {
        setNotifications((prev) => [notification, ...prev]);
        toast.info(notification.message || "New admin notification");
      }
    });

    socket.on("adminRoomUpdated", ({ room }) => {
      if (!room?.roomId) return;
      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.roomId === room.roomId);
        if (idx === -1) return [room, ...prev];
        const next = [...prev];
        next[idx] = room;
        return next;
      });
    });

    socket.on("adminRoomRequestUpdated", ({ request }) => {
      if (!request?.id) return;
      setRequests((prev) => {
        const idx = prev.findIndex((r) => r.id === request.id);
        if (idx === -1) return [request, ...prev];
        const next = [...prev];
        next[idx] = request;
        return next;
      });
    });

    socket.on("adminRoomClosed", ({ roomId }) => {
      setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
    });

    socket.on("adminSettingsUpdated", ({ settings: nextSettings }) => {
      if (nextSettings) setSettings(nextSettings);
    });

    return () => {
      socket.emit("adminUnsubscribe");
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, backendUrl]); // Removed refreshAll from dependencies to prevent socket recreation on re-render

  const handleToggleApproval = async () => {
    try {
      const res = await axios.patch(
        `${backendUrl}/api/admin/settings`,
        { requireRoomApproval: !settings.requireRoomApproval },
        { headers: authHeaders() }
      );
      setSettings(res.data.settings);
      toast.success(
        res.data.settings.requireRoomApproval
          ? "Room approval mode enabled."
          : "Open room creation restored."
      );
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update settings.");
    }
  };
  const handleSaveWhatsAppSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.patch(
        `${backendUrl}/api/admin/settings`,
        {
          adminWhatsAppPhone: whatsappPhone,
          callmebotApiKey: callmebotKey
        },
        { headers: authHeaders() }
      );
      setSettings(res.data.settings);
      toast.success("WhatsApp configuration updated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save WhatsApp settings.");
    }
  };


  const handleApprove = async (requestId) => {
    try {
      await axios.post(`${backendUrl}/api/admin/room-requests/${requestId}/approve`, {}, { headers: authHeaders() });
      toast.success("Room request approved.");
      await Promise.all([fetchRequests(), fetchRooms()]);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to approve request.");
    }
  };

  const handleReject = (requestId) => {
    setPromptInput("Rejected by admin");
    setModal({
      type: "prompt",
      title: "Reject Room Creation",
      body: "Provide a reason for rejecting this room creation request:",
      confirmLabel: "Reject Request",
      confirmDanger: true,
      onConfirm: async (reasonVal) => {
        try {
          await axios.post(
            `${backendUrl}/api/admin/room-requests/${requestId}/reject`,
            { reason: reasonVal.trim() || "Rejected by admin" },
            { headers: authHeaders() }
          );
          toast.success("Room request rejected.");
          await fetchRequests();
        } catch (err) {
          toast.error(err.response?.data?.error || "Failed to reject request.");
        }
      }
    });
  };

  const handleStealthJoin = async (roomId) => {
    try {
      const res = await axios.post(
        `${backendUrl}/api/admin/rooms/${encodeURIComponent(roomId)}/stealth-token`,
        {},
        { headers: authHeaders() }
      );
      const url = `${window.location.origin}/room/${encodeURIComponent(roomId)}?stealth=${res.data.token}&key=${encodeURIComponent(res.data.roomPassword || "")}`;
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Stealth join opened in a new tab.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create stealth token.");
    }
  };

  const handleCloseRoom = (roomId) => {
    setModal({
      type: "confirm",
      title: "Close secure room?",
      body: `Are you sure you want to close and destroy the room "${roomId}"? All participants will be disconnected instantly and the chat logs archived.`,
      confirmLabel: "Close Room",
      confirmDanger: true,
      onConfirm: async () => {
        try {
          await axios.delete(`${backendUrl}/api/admin/rooms/${encodeURIComponent(roomId)}`, {
            headers: authHeaders(),
          });
          toast.success("Room closed.");
          setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
        } catch (err) {
          toast.error(err.response?.data?.error || "Failed to close room.");
        }
      }
    });
  };

  const markAllRead = async () => {
    try {
      const res = await axios.post(
        `${backendUrl}/api/admin/notifications/read`,
        { ids: notifications.filter((n) => !n.read).map((n) => n.id) },
        { headers: authHeaders() }
      );
      setNotifications(res.data.notifications || []);
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <section>
      <TabBar>
        <TabButton type="button" $active={tab === "rooms"} onClick={() => setTab("rooms")}>
          <FaDoorOpen /> Rooms <BadgeCount $active={tab === "rooms"}>{rooms.length}</BadgeCount>
        </TabButton>
        <TabButton type="button" $active={tab === "requests"} onClick={() => setTab("requests")}>
          <FaUsers /> Requests <BadgeCount $active={tab === "requests"}>{pendingRequests.length}</BadgeCount>
        </TabButton>
        <TabButton type="button" $active={tab === "notifications"} onClick={() => setTab("notifications")}>
          <FaBell /> Alerts <BadgeCount $active={tab === "notifications"}>{unreadCount}</BadgeCount>
        </TabButton>
        <TabButton type="button" $active={tab === "settings"} onClick={() => setTab("settings")}>
          <FaCog /> Platform
        </TabButton>
        <ActionBtn type="button" onClick={refreshAll} disabled={loading} style={{ marginLeft: "auto", flex: "none", width: "auto" }}>
          <FaSync /> {loading ? "Refreshing…" : "Refresh"}
        </ActionBtn>
      </TabBar>

      {tab === "rooms" && (
        rooms.length === 0 ? (
          <EmptyState>No active rooms. Rooms appear here when users join or create them.</EmptyState>
        ) : (
          <RoomGrid>
            {rooms.map((room) => {
              const maxAvatars = 4;
              const participantsList = room.participants || [];
              const visibleParticipants = participantsList.slice(0, maxAvatars);
              const extraCount = participantsList.length - maxAvatars;

              return (
                <RoomCard key={room.roomId}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <CardHeader>
                      <RoomBadge>
                        <FaLock size={12} />
                        {room.roomId}
                      </RoomBadge>
                      <StatusIndicator>
                        <PulseDot />
                        Active
                      </StatusIndicator>
                    </CardHeader>

                    <MetricGrid>
                      <MetricItem>
                        <span>
                          <FaUsers size={11} />
                          Users
                        </span>
                        <span>{room.participantCount}</span>
                      </MetricItem>
                      <MetricItem>
                        <span>
                          <FaRegCommentDots size={11} />
                          Texts
                        </span>
                        <span>{room.messageCount}</span>
                      </MetricItem>
                      <MetricItem style={{ gridColumn: "span 2" }}>
                        <span>
                          <FaUserShield size={11} />
                          Owner
                        </span>
                        <span style={{ fontSize: "0.85rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {room.createdBy || "System"}
                        </span>
                      </MetricItem>
                      <MetricItem style={{ gridColumn: "span 2" }}>
                        <span>
                          <FaCalendarAlt size={11} />
                          Created
                        </span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--chakra-colors-textSecondary)" }}>
                          {formatTime(room.createdAt)}
                        </span>
                      </MetricItem>
                    </MetricGrid>

                    {participantsList.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <ParticipantContainer>
                          <span style={{ fontSize: "0.75rem", color: "var(--chakra-colors-textSecondary)", fontWeight: 600 }}>
                            Online Now:
                          </span>
                          <AvatarStack>
                            {visibleParticipants.map((p) => {
                              const initial = String(p.name || "?").trim().charAt(0).toUpperCase();
                              return (
                                <StackAvatar key={p.id} title={p.name}>
                                  {initial}
                                </StackAvatar>
                              );
                            })}
                            {extraCount > 0 && (
                              <ExtraAvatarCount title={`${extraCount} more users`}>
                                +{extraCount}
                              </ExtraAvatarCount>
                            )}
                          </AvatarStack>
                        </ParticipantContainer>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: -4 }}>
                          {participantsList.map((p) => (
                            <div key={p.id} style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              color: "rgba(255, 255, 255, 0.85)",
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              padding: "3px 6px 3px 8px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6
                            }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4cc9f0" }} />
                              {p.name}
                              <button
                                type="button"
                                onClick={() => handleKickParticipant(room.roomId, p.id, p.name)}
                                style={{
                                  border: 0,
                                  background: "transparent",
                                  color: "rgba(255, 71, 87, 0.6)",
                                  cursor: "pointer",
                                  padding: "0 2px",
                                  fontSize: "0.75rem",
                                  display: "flex",
                                  alignItems: "center",
                                  fontWeight: "bold",
                                  transition: "color 0.2s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = "#ff4757"}
                                onMouseLeave={e => e.currentTarget.style.color = "rgba(255, 71, 87, 0.6)"}
                                title={`Remove ${p.name} from room`}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <CardActions>
                    <ActionBtn type="button" onClick={() => handleStealthJoin(room.roomId)}>
                      <FaEyeSlash /> Stealth join
                    </ActionBtn>
                    <ActionBtn type="button" $danger onClick={() => handleCloseRoom(room.roomId)}>
                      <FaTrash /> Close
                    </ActionBtn>
                  </CardActions>
                </RoomCard>
              );
            })}
          </RoomGrid>
        )
      )}

      {tab === "requests" && (
        pendingRequests.length === 0 ? (
          <EmptyState>No pending room creation requests.</EmptyState>
        ) : (
          <NotificationList>
            {pendingRequests.map((req) => (
              <NotificationItem key={req.id} $unread>
                <div>
                  <strong>{req.userName}</strong> requested room <strong>{req.roomId}</strong>
                  <div style={{ fontSize: "0.78rem", color: "var(--chakra-colors-textSecondary)", marginTop: 4 }}>
                    {formatTime(req.createdAt)} · Personal password set by requester
                  </div>
                </div>
                <CardActions style={{ margin: 0 }}>
                  <ActionBtn type="button" onClick={() => handleApprove(req.id)} style={{ minWidth: 100 }}><FaCheck /> Approve</ActionBtn>
                  <ActionBtn type="button" $danger onClick={() => handleReject(req.id)} style={{ minWidth: 100 }}><FaTimes /> Reject</ActionBtn>
                </CardActions>
              </NotificationItem>
            ))}
          </NotificationList>
        )
      )}

      {tab === "notifications" && (
        <>
          {notifications.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <ActionBtn type="button" onClick={markAllRead} style={{ flex: "none" }}>Mark all read</ActionBtn>
            </div>
          )}
          {notifications.length === 0 ? (
            <EmptyState>No notifications yet.</EmptyState>
          ) : (
            <NotificationList>
              {notifications.map((n) => (
                <NotificationItem key={n.id} $unread={!n.read}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{n.message}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--chakra-colors-textSecondary)", marginTop: 4 }}>
                      {formatTime(n.createdAt)} · {n.type}
                    </div>
                  </div>
                </NotificationItem>
              ))}
            </NotificationList>
          )}
        </>
      )}

      {tab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <ToggleRow style={{ marginTop: 0 }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Require room approval</div>
              <div style={{ fontSize: "0.82rem", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.5 }}>
                When enabled, users must submit a room request with a personal password before creating a new room.
                When disabled, anyone can create rooms instantly.
              </div>
            </div>
            <ToggleSwitch
              $checked={Boolean(settings.requireRoomApproval)}
              onClick={handleToggleApproval}
              role="checkbox"
              aria-checked={Boolean(settings.requireRoomApproval)}
            />
          </ToggleRow>

          <SettingsForm onSubmit={handleSaveWhatsAppSettings}>
            <SettingsSectionTitle>
              <span>🔔</span> WhatsApp Alerts (CallMeBot)
            </SettingsSectionTitle>
            <div style={{ fontSize: "0.82rem", color: "var(--chakra-colors-textSecondary)", lineHeight: 1.5, marginBottom: 8 }}>
              Configure where room creation alerts are sent. To obtain your free API key, add <strong>+34 644 51 95 23</strong> on WhatsApp and send: <code>I allow callmebot to send me messages</code>.
            </div>

            <FormGroup>
              <FormLabel>Admin WhatsApp Phone Number</FormLabel>
              <FormInput
                type="text"
                placeholder="e.g. +919876543210"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
              />
            </FormGroup>

            <FormGroup>
              <FormLabel>CallMeBot API Key</FormLabel>
              <FormInput
                type="password"
                placeholder="e.g. 123456"
                value={callmebotKey}
                onChange={(e) => setCallmebotKey(e.target.value)}
              />
            </FormGroup>

            <FormSubmitBtn type="submit">
              Save WhatsApp Configuration
            </FormSubmitBtn>
          </SettingsForm>
        </div>
      )}

      {/* ── CUSTOM SaaS DIALOG MODALS ── */}
      {modal && (
        <ModalOverlay onClick={() => setModal(null)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{modal.title}</ModalTitle>
            <ModalBody>{modal.body}</ModalBody>
            {modal.type === "prompt" && (
              <ModalInput
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                autoFocus
              />
            )}
            <ModalActions>
              <ModalBtn type="button" onClick={() => setModal(null)}>
                Cancel
              </ModalBtn>
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
