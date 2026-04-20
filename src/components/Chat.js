import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import styled, { keyframes } from "styled-components";
import {
  FaPaperPlane,
  FaPenNib,
  FaFileUpload,
  FaFile,
  FaSearch,
} from "react-icons/fa";
import { HiGif } from "react-icons/hi2";
import Whiteboard from "./Whiteboard";
import LiveMeeting from "./LiveMeeting";
import { FaVideo, FaPlay } from "react-icons/fa";
import image from "../logo192.png";
import notificationSound from "../assets/iphone-sms.mp3";
import { AiOutlineClose } from "react-icons/ai";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { generateKeyFromSecret, encryptMessage, decryptMessage, encryptBinary, decryptBinary } from "../utils/crypto";

/* ================= CONFIG ================= */

const SECURITY_CODE = process.env.REACT_APP_SECURITY_CODES.split(",");
const CHUNK_SIZE = 1024 * 128; // 128KB chunks for high-speed streaming relay

const urlRegex = /(https?:\/\/[^\s]+)/g;

/* ================= STYLES ================= */

const colorPalette = [
  "#FF5722",
  "#4CAF50",
  "#2196F3",
  "#9C27B0",
  "#FFC107",
  "#00BCD4",
  "#E91E63",
  "#8BC34A",
  "#FF9800",
  "#3F51B5",
];

const glow = keyframes`
  0% { opacity: .4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: .4; transform: scale(1); }
`;

const LiveBadge = styled.div`
  background: #ff4757;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
  animation: ${glow} 1.5s infinite;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 12px;
`;

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #121212;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 20px;
  background: #1f1f1f;
  color: #fff;
  border-bottom: 1px solid #333;
`;

const Avatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  margin-right: 10px;
`;

const RoomActions = styled.div`
  margin-left: auto;
  display: flex;
  gap: 12px;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 1.2rem;
`;

const MessageContainer = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  postion: relative;
`;

// const ActionLink = styled(Link)`
//   background:none; border:none; color:#fff;
//   cursor:pointer; font-size:1.2rem;
//   display: flex;
//   align-items: center;
//   justify-content: center;
// `;

const MessageBubble = styled.div`
  max-width: ${(p) => (p.isSystem ? "60%" : p.isFile ? "40%" : "100%")};
  padding: ${(p) => (p.isSystem ? "0" : p.isFile ? "6px" : "10px 14px")};

  background: transparent;

  border-radius: ${(p) => (p.isSystem ? "0" : "12px")};

  align-self: ${(p) =>
    p.isSystem ? "center" : p.isSender ? "flex-end" : "flex-start"};

  color: ${(p) =>
    p.isSystem ? (p.systemType === "join" ? "#2ecc71" : "#e74c3c") : "#fff"};

  font-size: ${(p) => (p.isSystem ? "13px" : "14px")};
  font-style: ${(p) => (p.isSystem ? "italic" : "normal")};
  opacity: ${(p) => (p.isSystem ? 0.9 : 1)};
  text-align: left;
`;

const Username = styled.div`
  font-size: 0.75rem;
  font-weight: bold;
  color: ${(p) => p.color};
  margin-bottom: 4px;
`;

const Timestamp = styled.div`
  font-size: 0.65rem;
  color: #aaa;
  text-align: right;
  margin-top: 4px;
`;

const FileCard = styled.div`
  background: #1c1c1c;
  border-radius: 10px;
  padding: 6px;
`;

const TypingIndicator = styled.div`
  position: sticky;
  bottom: 10px;

  align-self: flex-start;
  margin-top: auto;

  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid #333;

  background: rgba(31, 31, 31, 0.95);
  backdrop-filter: blur(6px);

  font-size: 0.8rem;
  color: #aaa;

  animation: ${glow} 1.5s infinite;

  z-index: 50;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.4);
`;

const JoinContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 320px;
`;

const JoinInput = styled.input`
  padding: 12px 16px;
  border-radius: 25px;
  border: 1px solid #333;
  background: #1e1e1e;
  color: #fff;
  outline: none;

  ::placeholder {
    color: #aaa;
  }
`;

const JoinButton = styled.button`
  padding: 12px;
  border-radius: 25px;
  border: none;
  background: #00bfa5;
  color: #000;
  font-weight: bold;
  cursor: pointer;
`;

const PreviewOverlay = styled.div`
  position: fixed;
  inset: 0;
  backdrop-filter: blur(4px);
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
`;

const PreviewModal = styled.div`
  background: #1f1f1f;
  border-radius: 14px;
  max-width: 90%;
  max-height: 90%;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PreviewContent = styled.div`
  max-height: 70vh;
  overflow: auto;

  img,
  video {
    max-width: 100%;
    border-radius: 10px;
  }
`;

const PreviewActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const PreviewButton = styled.button`
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: bold;
`;

const CancelBtn = styled(PreviewButton)`
  background: #444;
  color: #fff;
`;

const SendBtn = styled(PreviewButton)`
  background: #00bfa5;
  color: #000;
`;

const MessageInputContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 20px;
  background: #1f1f1f;
  border-top: 1px solid #333;
  gap: 10px; /* consistent spacing between elements */
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 12px 15px;
  border-radius: 20px;
  border: 1px solid #333;
  background: #121212;
  color: #fff;
  outline: none;

  ::placeholder {
    color: #aaa;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileUploadLabel = styled.label`
  font-size: 1.3rem;
  cursor: pointer;
  color: #fff;
`;

const SendButton = styled.button`
  padding: 10px;
  border-radius: 50%;
  border: none;
  background: #00bfa5;
  color: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;
/* ================= GIF PICKER IMPROVED ================= */

const GifPickerOverlay = styled(PreviewOverlay)`
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(5px);
  z-index: 10000;

  display: flex;
  align-items: center;
  justify-content: center;

  /* Mobile spacing + safe area */
  padding: max(12px, env(safe-area-inset-top))
           max(12px, env(safe-area-inset-right))
           max(12px, env(safe-area-inset-bottom))
           max(12px, env(safe-area-inset-left));

  @media (min-width: 768px) {
    padding: 0;
  }
`;

const GifPickerModal = styled(PreviewModal)`
  width: 100%;
  max-width: 650px;
  max-height: 85vh;

  padding: 16px;
  background: #1f1f1f;
  border-radius: 16px;

  display: flex;
  flex-direction: column;
  gap: 12px;

  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);

  overflow: hidden;

  /* Mobile gap */
  @media (max-width: 600px) {
    max-width: 100%;
    border-radius: 14px;
  }
`;


const GifPickerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const GifSearchInput = styled.input`
  flex: 1;
  padding: 12px 16px;
  border-radius: 25px;
  border: 1px solid #333;
  background: #121212;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;

  ::placeholder {
    color: #aaa;
  }
`;

const SearchGifButton = styled.button`
  background: #00bfa5;
  border: none;
  color: #000;
  border-radius: 25px;
  padding: 8px 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #00d8b0;
  }
`;

// const CloseGifPickerButton = styled.button`
//   background: #ff4d4d;
//   border: none;
//   color: #fff;
//   border-radius: 25px;
//   padding: 8px 12px;
//   font-weight: bold;
//   cursor: pointer;
//   flex-shrink: 0;
//   transition: all 0.2s ease;

//   &:hover {
//     background: #ff6666;
//   }
// `;

const GifGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px; /* very small gap so no visible white space */
  overflow-y: auto;
  max-height: 65vh;
  justify-items: center;
  scroll-behavior: smooth;
`;

const GifCard = styled.div`
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: #000;
  aspect-ratio: 1 / 1; /* square cards for uniform layout */
`;

const GifItem = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover; /* fill the card, no gaps */
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.5);
  }
`;

const CardOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;

  ${GifCard}:hover & {
    opacity: 1;
  }
`;

const OverlayButton = styled.button`
  background: #00bfa5;
  color: #000;
  border: none;
  padding: 6px 12px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: bold;
  opacity: 0.9;
  font-size: 0.85rem;
  transition: all 0.2s;

  &:hover {
    background: #00d8b0;
    opacity: 1;
  }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;



/* ================= COMPONENT ================= */

export default function ChatRoom() {
  const socketRef = useRef(null);
  const audioRef = useRef(new Audio(notificationSound));
  const fileChunksRef = useRef({});
  const userColorsRef = useRef({});
  const cryptoKeyRef = useRef(null);

  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);

  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fullscreen, setFullscreen] = useState(null);
  const [receivingFiles, setReceivingFiles] = useState({});
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const [ownerToken, setOwnerToken] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const isEncrypted = !!cryptoKeyRef.current;

  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [latency, setLatency] = useState(0);
  const [gifQuery, setGifQuery] = useState("");

  const [gifs, setGifs] = useState([]);
  const [gifOffset, setGifOffset] = useState(0); // track offset
  const [hasMoreGifs, setHasMoreGifs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const GIF_LIMIT = 30;

  const fetchGifs = async (query = "", offset = 0) => {
    const API_KEY = process.env.REACT_APP_GIPHY_API_KEY;
    const url = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${query}&limit=${GIF_LIMIT}&offset=${offset}`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&limit=${GIF_LIMIT}&offset=${offset}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.data.length < GIF_LIMIT) setHasMoreGifs(false); // no more GIFs
      if (offset === 0) setGifs(data.data);
      else setGifs((prev) => [...prev, ...data.data]); // append
    } catch (err) {
      console.error("Error fetching GIFs:", err);
    }
  };

  const gifGridRef = useRef(null);

  useEffect(() => {
    if (showGifPicker) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showGifPicker]);

  useEffect(() => {
    const grid = gifGridRef.current;
    if (!grid) return;

    const handleScroll = () => {
      if (
        grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 10 &&
        hasMoreGifs
      ) {
        fetchGifs(gifQuery, gifOffset + GIF_LIMIT);
        setGifOffset((prev) => prev + GIF_LIMIT);
      }
    };

    grid.addEventListener("scroll", handleScroll);
    return () => grid.removeEventListener("scroll", handleScroll);
  }, [gifOffset, gifQuery, hasMoreGifs]);

  /* ================= HELPERS ================= */

  const getColor = (name) => {
    if (!userColorsRef.current[name]) {
      userColorsRef.current[name] =
        colorPalette[
          Object.keys(userColorsRef.current).length % colorPalette.length
        ];
    }
    return userColorsRef.current[name];
  };

  const getEmbedData = (url) => {
    try {
      const u = new URL(url);
      
      // YouTube
      if (u.hostname.includes("youtu.be")) return { type: "youtube", src: `https://www.youtube.com/embed/${u.pathname.slice(1)}` };
      if (u.hostname.includes("youtube.com")) {
        if (u.pathname.startsWith("/shorts/")) return { type: "youtube", src: `https://www.youtube.com/embed/${u.pathname.split("/")[2]}` };
        if (u.pathname.startsWith("/live/")) return { type: "youtube", src: `https://www.youtube.com/embed/${u.pathname.split("/")[2]}` };
        if (u.searchParams.get("v")) return { type: "youtube", src: `https://www.youtube.com/embed/${u.searchParams.get("v")}` };
      }

      // Spotify
      if (u.hostname.includes("spotify.com")) {
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          return { type: "spotify", src: `https://open.spotify.com/embed/${parts[0]}/${parts[1]}` };
        }
      }

      // TikTok
      if (u.hostname.includes("tiktok.com")) {
        const videoId = u.pathname.split("/video/")[1];
        if (videoId) return { type: "tiktok", src: `https://www.tiktok.com/embed/v2/${videoId.split("?")[0]}` };
      }

      // Instagram
      if (u.hostname.includes("instagram.com")) {
        const pIndex = u.pathname.split("/").indexOf("p");
        const reelIndex = u.pathname.split("/").indexOf("reel");
        const idIndex = pIndex > -1 ? pIndex + 1 : (reelIndex > -1 ? reelIndex + 1 : -1);
        if (idIndex !== -1) {
          const id = u.pathname.split("/")[idIndex];
          return { type: "instagram", src: `https://www.instagram.com/p/${id}/embed` };
        }
      }

      // Twitter / X
      if (u.hostname.includes("twitter.com") || u.hostname.includes("x.com")) {
        const tweetId = u.pathname.split("/status/")[1];
        if (tweetId) {
           return { type: "twitter", src: `https://twitframe.com/show?url=${encodeURIComponent(`https://twitter.com/i/status/${tweetId.split("?")[0]}`)}` };
        }
      }
      
    } catch {}
    return null;
  };

  const handleDestroyRoom = () => {
    if (!roomId || !ownerToken) return;

    // Only the owner gets the confirmation
    const confirmDestroy = window.confirm(
      "Destroy this room? All messages will be lost!",
    );
    if (!confirmDestroy) return;

    // Emit destroy event to server
    socketRef.current.emit("destroyRoom", { roomId, token: ownerToken });

    // Owner also clears local state
    setMessages([]);
    setJoined(false);
  };

  /* ================= SOCKET ================= */

  useEffect(() => {
    socketRef.current = io(process.env.REACT_APP_SOCKET_ENDPOINT || "http://localhost:4000");
    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => {
    if (!joined) return;

    socketRef.current.emit("joinRoom", { roomId, userName });

    socketRef.current.on("newMessage", async (msg) => {
      let finalMsg = { ...msg };
      if (msg.type !== "system" && msg.payload) {
        try {
          const decryptedText = await decryptMessage(cryptoKeyRef.current, msg.payload);
          try {
            const parsed = JSON.parse(decryptedText);
            finalMsg.text = parsed.text || "";
            finalMsg.gif = parsed.gif || "";
          } catch (e) {
            finalMsg.text = decryptedText;
          }
        } catch (err) {
          finalMsg.text = "🔒 [Encrypted Message]";
        }
      } else if (!msg.type && msg.text) {
          // Fallback for unencrypted historical messages if any
      }
      setMessages((m) => [...m, finalMsg]);
      if (msg.userName !== userName) audioRef.current.play().catch(() => {});
    });

    socketRef.current.on("presence", ({ online, count }) => {

      setOnlineUsers(online);
    });

    socketRef.current.on("typing", (users) =>
      setTypingUsers(users.filter((u) => u !== userName)),
    );
    socketRef.current.on("roomDestroyed", () => {
      alert("Room has been destroyed. Reloading...");
      window.location.reload();
    });

    socketRef.current.on("receiveFileChunk", async (data) => {
      const {
        fileId,
        chunk,
        iv,
        chunkIndex,
        totalChunks,
        fileName,
        fileType,
        userName: senderName,
      } = data;

      if (!fileChunksRef.current[fileId]) {
        fileChunksRef.current[fileId] = [];
        // First chunk - initialize receiver UI
        setMessages(m => [
            ...m,
            {
              id: `loading-${fileId}`,
              userName: senderName,
              file: { name: fileName, loading: true },
              ts: Date.now(),
            }
        ]);
      }

      const percent = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      setReceivingFiles(prev => ({
          ...prev,
          [fileId]: { name: fileName, percent, senderName }
      }));

      try {
        let decryptedChunk = chunk;
        if (iv && chunk) {
          decryptedChunk = await decryptBinary(cryptoKeyRef.current, { iv, data: chunk });
        }
        fileChunksRef.current[fileId][chunkIndex] = decryptedChunk;
      } catch (err) {
        console.error("Failed to decrypt file chunk");
      }

      if (
        fileChunksRef.current[fileId].filter(Boolean).length === totalChunks
      ) {
        let safeType = "application/octet-stream";
        if (
          fileType.startsWith("image/") ||
          fileType.startsWith("video/") ||
          fileType.startsWith("audio/") ||
          fileType === "application/pdf"
        ) {
          safeType = fileType;
        }

        const blob = new Blob(fileChunksRef.current[fileId], { type: safeType });
        const url = URL.createObjectURL(blob);

        setMessages((m) => {
           const updated = m.filter(msg => msg.id !== `loading-${fileId}`);
           return [
            ...updated,
            {
                userName: senderName,
                file: { name: fileName, url, type: fileType },
                ts: Date.now(),
            },
           ];
        });

        if (senderName !== userName) audioRef.current.play().catch(() => {});
        delete fileChunksRef.current[fileId];
        setReceivingFiles(prev => {
            const next = { ...prev };
            delete next[fileId];
            return next;
        });
      }
    });

    socketRef.current.on("roomOwner", (token) => setOwnerToken(token));

    socketRef.current.on("connect", () => {
      console.log("Connected to server:", socketRef.current.id);
      if (joined && roomId && userName) {
        socketRef.current.emit("joinRoom", { roomId, userName });
      }
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from server");
    });

    // Latency Tracking (Ping-Pong)
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        const start = Date.now();
        socketRef.current.emit("ping", () => {
          setLatency(Date.now() - start);
        });
      }
    }, 5000);

    return () => {
      socketRef.current.off();
      clearInterval(pingInterval);
    };
  }, [joined, roomId, userName]);

  useEffect(() => {
    if (!joined) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to leave the room? Your current session and chat history will be lost.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [joined]);

  /* ================= FILE HANDLING ================= */

  const uploadFile = (file) => {
    const fileId = `${socketRef.current.id}-${Date.now()}-${file.name}`;
    let chunkIndex = 0;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const encrypted = await encryptBinary(cryptoKeyRef.current, e.target.result);
      const isFinished = chunkIndex + 1 === totalChunks;

      setUploadProgress(prev => ({ ...prev, [fileId]: Math.round(((chunkIndex + 1) / totalChunks) * 100) }));

      socketRef.current.emit("sendFileChunk", {
        roomId,
        fileId,
        chunk: encrypted.data,
        iv: encrypted.iv,
        chunkIndex,
        totalChunks,
        finished: isFinished,
        fileName: file.name,
        fileType: file.type,
        userName,
      });

      if (isFinished) {
        setTimeout(() => {
          setUploadProgress(prev => { const n = { ...prev }; delete n[fileId]; return n; });
        }, 1000);
      } else {
        chunkIndex++;
        read();
      }
    };

    const read = () => {
      const start = chunkIndex * CHUNK_SIZE;
      reader.readAsArrayBuffer(file.slice(start, start + CHUNK_SIZE));
    };

    read();
  };

  /* ================= PASTE SUPPORT ================= */

  useEffect(() => {
    const onPaste = (e) => {
      const item = [...e.clipboardData.items].find((i) => i.kind === "file");
      if (item) {
        const file = item.getAsFile();
        setPendingFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  /* ================= SEND ================= */

  const handleSend = async (customData = null) => {
    if (pendingFile) {
      uploadFile(pendingFile);
      setPendingFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!customData && !message.trim()) return;
    
    const dataToEncrypt = customData || { text: message };
    const payload = await encryptMessage(cryptoKeyRef.current, JSON.stringify(dataToEncrypt));
    
    socketRef.current.emit("sendMessage", {
      payload,
      userName,
      ts: Date.now(),
    });
    
    if (!customData) setMessage("");
  };

  const handleTyping = (value) => {
    socketRef.current.emit("typing", value.length > 0);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () => socketRef.current.emit("typing", false),
      1000,
    );
  };

  /* ================= UI ================= */

  if (!joined) {
    return (
      <>
        <ToastContainer position="top-center" />
        <ChatContainer
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <JoinContainer>
            <h2 style={{ color: "#fff", textAlign: "center" }}>Join Room</h2>

            <JoinInput
              placeholder="Room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />

            <JoinInput
              placeholder="Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />

            <JoinInput
              placeholder="Security Code"
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value)}
            />

            <JoinButton
              onClick={async () => {
                const code = securityCode.trim();

                if (!SECURITY_CODE.includes(code)) {
                  toast.error(
                    "Invalid security code! Please check and try again.",
                  );
                  return;
                }
                
                try {
                  cryptoKeyRef.current = await generateKeyFromSecret(code);
                  setJoined(true);
                } catch (err) {
                  toast.error("Failed to generate encryption key.");
                }
              }}
            >
              Join
            </JoinButton>
          </JoinContainer>
        </ChatContainer>
      </>
    );
  }

  return (
    <>
      <ChatContainer>
        <Header>
          <Avatar src={image} alt="Logo" />
          <div 
            style={{ display: "flex", flexDirection: "column", cursor: "pointer", position: "relative" }}
            onClick={() => setShowRoomInfo(!showRoomInfo)}
          >
            <div style={{ fontWeight: "bold", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 5 }}>
              {roomId} 
              <span style={{ fontSize: "0.6rem", opacity: 0.5 }}>▼</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#aaa" }}>
              {onlineUsers.length} online • {isEncrypted ? "🔒 E2EE" : "⚠️ Plain"}
            </div>

            {showRoomInfo && (
              <div style={{
                position: "absolute",
                top: "120%",
                left: 0,
                width: 250,
                background: "rgba(31, 31, 31, 0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 12,
                padding: 15,
                zIndex: 1000,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
              }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "#888" }}>Room Insights</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>Active Session</span>
                    <span style={{ color: (showWhiteboard || showMeeting) ? "#ff4757" : "#4CAF50" }}>
                      {(showWhiteboard || showMeeting) ? "● Collaborative" : "● Idle"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>Network Latency</span>
                    <span style={{ color: latency < 100 ? "#4CAF50" : "#FFC107" }}>
                      {latency}ms
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>Security</span>
                    <span style={{ color: "#2196F3" }}>AES-256 GCM</span>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 10 }}>
                    <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 5 }}>Participants</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {onlineUsers.map(u => (
                        <div key={u.id} style={{ background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 20, fontSize: "0.7rem" }}>
                          {u.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <RoomActions>
            {(showWhiteboard || showMeeting) && (
              <LiveBadge>
                <div style={{ width: 6, height: 6, background: "white", borderRadius: "50%" }} />
                LIVE
              </LiveBadge>
            )}

            <ActionButton onClick={() => setShowMeeting(true)} title="Start Video Call">
              <FaVideo />
            </ActionButton>
            
            <ActionButton onClick={() => setShowWhiteboard(true)} title="Open Whiteboard">
              <FaPenNib />
            </ActionButton>

            <ActionButton onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }} title="Search Messages">
              <FaSearch />
            </ActionButton>

            {showSearch && (
              <div style={{ position: "absolute", top: "70px", right: "20px", zIndex: 100, background: "rgba(20, 20, 20, 0.9)", padding: "10px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", display: "flex", gap: "10px", alignItems: "center" }}>
                <FaSearch style={{ opacity: 0.5 }} />
                <input 
                  autoFocus
                  placeholder="Filter messages..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: "none", border: "none", color: "white", outline: "none", width: "150px" }}
                />
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} style={{ background: "none", border: "none", color: "white", cursor: "pointer", opacity: 0.5 }}>✕</button>
              </div>
            )}

            {ownerToken && (
              <ActionButton
                onClick={handleDestroyRoom}
                style={{ color: "red" }}
              >
                {" "}
                ✖{" "}
              </ActionButton>
            )}
          </RoomActions>
        </Header>

        <MessageContainer>
          {messages.filter(m => {
            if (!searchQuery) return true;
            if (m.type === "system") return false;
            return m.text?.toLowerCase().includes(searchQuery.toLowerCase());
          }).map((m, i) => {
            const isSystem = m.type === "system";
            const systemType = isSystem ? m.action : null;

            if (isSystem && m.userName === userName) return null;

            return (
              <MessageBubble
                key={i}
                isSender={m.userName === userName}
                isSystem={isSystem}
                systemType={systemType}
                isFile={!!m.file}
              >
                {m.userName !== userName && !isSystem && (
                  <Username color={getColor(m.userName)}>{m.userName}</Username>
                )}

                {isSystem && (
                  <span>
                    {m.userName} {systemType === "join" ? "joined" : "left"} the
                    room
                  </span>
                )}

                {!isSystem &&
                  m.text &&
                  m.text.split(urlRegex).map((part, j) => {
                    if (!part.startsWith("http")) return part;

                    const embed = getEmbedData(part);

                    if (embed) {
                      let height = "250px";
                      if (embed.type === "spotify") height = "152px";
                      if (embed.type === "tiktok") height = "500px";
                      if (embed.type === "instagram") height = "450px";
                      if (embed.type === "twitter") height = "350px";

                      return (
                        <iframe
                          key={j}
                          src={embed.src}
                          style={{
                            border: "0px",
                            padding: 0,
                            margin: "8px 0",
                            width: "100%",
                            height: height,
                            borderRadius: "12px",
                            background: embed.type === "twitter" ? "#fff" : "transparent"
                          }}
                          title={`${embed.type} embed`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      );
                    }

                    return (
                      <a key={j} href={part} target="_blank" rel="noreferrer">
                        {part}
                      </a>
                    );
                  })}

                {m.gif && (
                  <img
                    src={m.gif}
                    alt="GIF"
                    style={{ maxWidth: "200px", borderRadius: 10, marginTop: "8px" }}
                    onClick={() =>
                      setFullscreen({ url: m.gif, type: "image" })
                    }
                  />
                )}

                {m.file && (
                  <div style={{ position: "relative" }}>
                    {m.file.loading ? (
                      <div style={{ 
                        width: "100%", padding: "20px", background: "rgba(30, 30, 30, 0.8)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)",
                        display: "flex", flexDirection: "column", gap: "10px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff", opacity: 0.8 }}>Receiving: {m.file.name}</span>
                          <span style={{ fontSize: "0.75rem", color: "#00bfa5" }}>{receivingFiles[m.id.replace('loading-', '')]?.percent || 0}%</span>
                        </div>
                        <ProgressTrack>
                           <ProgressFill percent={receivingFiles[m.id.replace('loading-', '')]?.percent || 0} />
                        </ProgressTrack>
                      </div>
                    ) : (
                    <FileCard onClick={() => setFullscreen(m.file)}>
                      {m.file.type && m.file.type.startsWith("image") ? (
                        <img alt={m.file.name} src={m.file.url} style={{ width: "100%", borderRadius: 8 }} />
                      ) : m.file.type && m.file.type.startsWith("video") ? (
                        <div style={{ position: "relative" }}>
                          <video src={m.file.url} style={{ width: "100%", borderRadius: 8 }} />
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                            <FaPlay style={{ color: "white", fontSize: "2rem" }} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ 
                          display: "flex", alignItems: "center", gap: "16px", padding: "16px", 
                          background: "rgba(0, 191, 165, 0.08)", borderRadius: "12px", border: "1px solid rgba(0, 191, 165, 0.3)" 
                        }}>
                          <div style={{ fontSize: "2.5rem" }}>
                             {m.file.name.match(/\.(xlsx|xls|csv)$/i) ? "📊" : 
                              m.file.name.match(/\.(docx|doc)$/i) ? "📝" :
                              m.file.name.match(/\.(zip|rar|7z)$/i) ? "🗜️" : "📎"}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                            <span style={{ fontWeight: "600", fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {m.file.name}
                            </span>
                            <span style={{ fontSize: "0.85rem", color: "#00bfa5", marginTop: "4px" }}>
                              {m.userName === userName ? "View Shared File" : "Click to preview & download"}
                            </span>
                          </div>
                        </div>
                      )}
                    </FileCard>
                    )}
                  </div>
                )}

                <Timestamp>{new Date(m.ts).toLocaleTimeString()}</Timestamp>
              </MessageBubble>
            );
          })}
          {typingUsers.length > 0 && (
            <TypingIndicator>{typingUsers.join(", ")} typing…</TypingIndicator>
          )}
        </MessageContainer>

        {showGifPicker && (
          <GifPickerOverlay onClick={() => setShowGifPicker(false)}>
            <GifPickerModal onClick={(e) => e.stopPropagation()}>
              <GifPickerHeader>
                <GifSearchInput
                  placeholder="Search GIFs..."
                  value={gifQuery}
                  onChange={(e) => setGifQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchGifs(gifQuery)}
                />
                <SearchGifButton onClick={() => fetchGifs(gifQuery)}>
                  <FaSearch />
                </SearchGifButton>
                {/* <CloseGifPickerButton onClick={() => setShowGifPicker(false)}>
                  <AiOutlineClose />
                </CloseGifPickerButton> */}
              </GifPickerHeader>

              <GifGrid ref={gifGridRef}>
                {gifs.map((gif) => (
                  <GifCard key={gif.id}>
                    <GifItem
                      src={gif.images.fixed_height.url}
                      alt={gif.title}
                      loading="lazy"
                    />
                    <CardOverlay>
                      <OverlayButton
                        onClick={() => {
                          handleSend({ text: "", gif: gif.images.fixed_height.url });
                          setShowGifPicker(false);
                        }}
                      >
                        <FaPaperPlane style={{ size: "sm" }} />
                      </OverlayButton>
                    </CardOverlay>
                  </GifCard>
                ))}
              </GifGrid>
            </GifPickerModal>
          </GifPickerOverlay>
        )}

        {pendingFile && (
          <PreviewOverlay onClick={() => setPendingFile(null)}>
            <PreviewModal onClick={(e) => e.stopPropagation()}>
              {/* <h3 style={{ color: "#fff", margin: 0 , textAlign: 'center'}}>Send file?</h3> */}

              <PreviewContent style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: "300px", minHeight: "150px" }}>
                {pendingFile.type && pendingFile.type.startsWith("image") ? (
                  <img alt={pendingFile.name} src={previewUrl} />
                ) : pendingFile.type && pendingFile.type.startsWith("video") ? (
                  <video src={previewUrl} controls />
                ) : pendingFile.type && pendingFile.type.startsWith("audio") ? (
                  <audio src={previewUrl} controls />
                ) : (
                  <div style={{ textAlign: "center", padding: "20px" }}>
                    <FaFile size={60} style={{ color: "#00bfa5", marginBottom: "15px" }} />
                    <div style={{ color: "white", fontSize: "1.1rem", fontWeight: "600", wordBreak: "break-all" }}>
                      {pendingFile.name}
                    </div>
                    <div style={{ color: "#888", fontSize: "0.85rem", marginTop: "8px" }}>
                      {(pendingFile.size / 1024 / 1024).toFixed(2)} MB • Ready to send
                    </div>
                  </div>
                )}
              </PreviewContent>

              <PreviewActions>
                <CancelBtn
                  onClick={() => {
                    setPendingFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <AiOutlineClose />
                </CancelBtn>

                <SendBtn
                  onClick={() => {
                    handleSend();
                    setPendingFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <FaPaperPlane />
                </SendBtn>
              </PreviewActions>
            </PreviewModal>
          </PreviewOverlay>
        )}

        <MessageInputContainer>
          <FileUploadLabel htmlFor="file-input">
            <FaFileUpload />
          </FileUploadLabel>

          <FileInput
            ref={fileInputRef}
            id="file-input"
            type="file"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              setPendingFile(null);
              setPreviewUrl(null);

              setPendingFile(file);
              setPreviewUrl(URL.createObjectURL(file));
            }}
          />

          <MessageInput
            placeholder="Type a message..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping?.(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSend?.()}
          />
          <FileUploadLabel
            onClick={() => {
              setShowGifPicker(true);
              fetchGifs();
            }}
          >
            <HiGif />
          </FileUploadLabel>

          <SendButton onClick={handleSend}>
            <FaPaperPlane />
          </SendButton>
        </MessageInputContainer>

        {fullscreen && (
          <div
            onClick={() => setFullscreen(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.9)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {fullscreen.type.startsWith("image") && (
              <img
                alt={fullscreen.name}
                src={fullscreen.url}
                style={{ maxWidth: "90%" }}
              />
            )}
            {fullscreen.type.startsWith("video") && (
              <video
                src={fullscreen.url}
                controls
                autoPlay
                style={{ maxWidth: "90%", maxHeight: "90%" }}
              />
            )}
            {!fullscreen.type.startsWith("image") && !fullscreen.type.startsWith("video") && (
              <div style={{ textAlign: "center", color: "white", padding: 20 }}>
                <FaFile size={100} style={{ marginBottom: 20, opacity: 0.3 }} />
                <h2 style={{ marginBottom: 10 }}>{fullscreen.name}</h2>
                <p style={{ opacity: 0.6, marginBottom: 20 }}>This file type cannot be previewed in the browser.</p>
                <a 
                  href={fullscreen.url} 
                  download={fullscreen.name} 
                  style={{ 
                    background: "#2196F3", 
                    color: "white", 
                    padding: "12px 24px", 
                    borderRadius: "12px", 
                    textDecoration: "none",
                    fontWeight: "bold",
                    display: "inline-block"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        )}
      </ChatContainer>

      <div style={{ display: showWhiteboard ? "block" : "none" }}>
        <Whiteboard
          socket={socketRef.current}
          roomId={roomId}
          isAdmin={!!ownerToken}
          onClose={() => setShowWhiteboard(false)}
        />
      </div>

      {showMeeting && (
        <LiveMeeting 
          socket={socketRef.current}
          roomId={roomId}
          userName={userName}
          isAdmin={!!ownerToken}
          onClose={() => setShowMeeting(false)}
        />
      )}
    </>
  );
}
