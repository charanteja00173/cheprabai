import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import styled, { keyframes } from "styled-components";
import {
  FaPaperPlane,
  // FaVideo, FaPhoneAlt,
  FaFileUpload,
  FaSearch,
} from "react-icons/fa";
import { HiGif } from "react-icons/hi2";
// import { CiStreamOn } from "react-icons/ci";
import image from "../logo192.png";
import notificationSound from "../assets/iphone-sms.mp3";
// import { Link } from 'react-router-dom';
import { AiOutlineClose } from "react-icons/ai";
import { useToast } from "@chakra-ui/react";

/* ================= CONFIG ================= */

const SECURITY_CODE = process.env.REACT_APP_SECURITY_CODES.split(",");
const CHUNK_SIZE = 1024 * 1024 * 5;

const urlRegex = /(https?:\/\/[^\s]+)/g;

/* ================= STYLES ================= */

const colorPalette = [
  "#FF5722","#4CAF50","#2196F3","#9C27B0","#FFC107",
  "#00BCD4","#E91E63","#8BC34A","#FF9800","#3F51B5"
];

const glow = keyframes`
  0% { opacity: .3 }
  50% { opacity: 1 }
  100% { opacity: .3 }
`;

const ChatContainer = styled.div`
  display:flex; flex-direction:column;
  height:100vh; background:#121212;
`;

const Header = styled.div`
  display:flex; align-items:center;
  padding:10px 20px; background:#1f1f1f;
  color:#fff; border-bottom:1px solid #333;
`;

const Avatar = styled.img`
  width:32px; height:32px;
  border-radius:50%; margin-right:10px;
`;

const RoomActions = styled.div`
  margin-left:auto; display:flex; gap:12px;
`;

const ActionButton = styled.button`
  background:none; border:none; color:#fff;
  cursor:pointer; font-size:1.2rem;
`;

const MessageContainer = styled.div`
  flex:1; padding:20px; overflow-y:auto;
  display:flex; flex-direction:column; gap:12px;
  postion:relative;
`;

// const ActionLink = styled(Link)`
//   background:none; border:none; color:#fff;
//   cursor:pointer; font-size:1.2rem;
//   display: flex;
//   align-items: center;
//   justify-content: center;
// `;

const MessageBubble = styled.div`
   max-width: ${p =>
    p.isSystem
      ? "60%"
      : p.isFile
      ? "40%"
      : "100%"};
  padding: ${p => (p.isSystem ? "0" : p.isFile ? "6px" : "10px 14px")};

  background: transparent;

  border-radius: ${p => (p.isSystem ? "0" : "12px")};

  align-self: ${p =>
    p.isSystem
      ? "center"
      : p.isSender
      ? "flex-end"
      : "flex-start"};

  

  color: ${p =>
    p.isSystem
      ? p.systemType === "join"
        ? "#2ecc71"  
        : "#e74c3c" 
      : "#fff"};

  font-size: ${p => (p.isSystem ? "13px" : "14px")};
  font-style: ${p => (p.isSystem ? "italic" : "normal")};
  opacity: ${p => (p.isSystem ? 0.9 : 1)};
  text-align: left;
`;


const Username = styled.div`
  font-size:.75rem;
  font-weight:bold;
  color:${p => p.color};
  margin-bottom:4px;
`;

const Timestamp = styled.div`
  font-size:.65rem;
  color:#aaa; text-align:right;
  margin-top:4px;
`;

const FileCard = styled.div`
  background:#1c1c1c;
  border-radius:10px;
  padding:6px;
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
  box-shadow: 0 -4px 10px rgba(0,0,0,0.4);
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
  background: rgba(0,0,0,0.8);
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

  img, video {
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
`;

const GifPickerModal = styled(PreviewModal)`
  max-width: 650px;
  max-height: 80%;
  padding: 16px;
  background: #1f1f1f;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
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

const CloseGifPickerButton = styled.button`
  background: #ff4d4d;
  border: none;
  color: #fff;
  border-radius: 25px;
  padding: 8px 12px;
  font-weight: bold;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &:hover {
    background: #ff6666;
  }
`;

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
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 12px rgba(0,0,0,0.5);
  }
`;

const CardOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.25);
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

/* ================= COMPONENT ================= */

export default function ChatRoom() {
  const socketRef = useRef(null);
  const audioRef = useRef(new Audio(notificationSound));
  const fileChunksRef = useRef({});
  const userColorsRef = useRef({});

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
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const [ownerToken, setOwnerToken] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);

  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");

  const [gifs, setGifs] = useState([]);
  const [gifOffset, setGifOffset] = useState(0); // track offset
  const [hasMoreGifs, setHasMoreGifs] = useState(true);
  const GIF_LIMIT = 30;

  const toast = useToast();

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

  const extractYoutubeId = (url) => {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.slice(1);
      }
      if (u.hostname.includes("youtube.com")) {
        return u.searchParams.get("v");
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
    socketRef.current = io(process.env.REACT_APP_SOCKET_ENDPOINT);
    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => {
    if (!joined) return;

    socketRef.current.emit("joinRoom", { roomId, userName });

    socketRef.current.on("newMessage", (msg) => {
      setMessages((m) => [...m, msg]);
      if (msg.userName !== userName) audioRef.current.play().catch(() => {});
    });

    socketRef.current.on("presence", ({ online }) =>
      setOnlineCount(online.length),
    );

    socketRef.current.on("typing", (users) =>
      setTypingUsers(users.filter((u) => u !== userName)),
    );
    socketRef.current.on("roomDestroyed", () => {
      alert("Room has been destroyed. Reloading...");
      window.location.reload();
    });

    socketRef.current.on("receiveFileChunk", (data) => {
      const {
        fileId,
        chunk,
        chunkIndex,
        totalChunks,
        fileName,
        fileType,
        userName: senderName,
      } = data;

      if (!fileChunksRef.current[fileId]) {
        fileChunksRef.current[fileId] = [];
      }

      fileChunksRef.current[fileId][chunkIndex] = chunk;

      if (
        fileChunksRef.current[fileId].filter(Boolean).length === totalChunks
      ) {
        const blob = new Blob(fileChunksRef.current[fileId], {
          type: fileType,
        });
        const url = URL.createObjectURL(blob);

        setMessages((m) => [
          ...m,
          {
            userName: senderName,
            file: { name: fileName, url, type: fileType },
            ts: Date.now(),
          },
        ]);
        if (senderName !== userName) audioRef.current.play().catch(() => {});
        delete fileChunksRef.current[fileId];
      }
    });

    socketRef.current.on("roomOwner", (token) => setOwnerToken(token));

    return () => socketRef.current.off();
  }, [joined, roomId, userName]);

  /* ================= FILE HANDLING ================= */

  const uploadFile = (file) => {
    const fileId = `${socketRef.current.id}-${Date.now()}-${file.name}`;
    let chunkIndex = 0;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const reader = new FileReader();

    reader.onload = (e) => {
      socketRef.current.emit("sendFileChunk", {
        roomId,
        fileId,
        chunk: e.target.result,
        chunkIndex,
        totalChunks,
        fileName: file.name,
        fileType: file.type,
        userName,
      });

      chunkIndex++;
      if (chunkIndex < totalChunks) read();
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

  const handleSend = () => {
    if (pendingFile) {
      uploadFile(pendingFile);
      setPendingFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!message.trim()) return;
    socketRef.current.emit("sendMessage", {
      text: message,
      userName,
      ts: Date.now(),
    });
    setMessage("");
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
      <ChatContainer style={{ justifyContent: "center", alignItems: "center" }}>
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
            onClick={() => {
              const code = securityCode.trim();
              if (!SECURITY_CODE.includes(code)) {
                toast({
                  title: "Invalid security code",
                  description: "Please check and try again",
                  status: "error",
                  duration: 3000,
                  isClosable: true,
                  position: "top",
                });
                return;
              }
              setJoined(true);
            }}
          >
            {" "}
            Join{" "}
          </JoinButton>
        </JoinContainer>
      </ChatContainer>
    );
  }

  return (
    <ChatContainer>
      <Header>
        <Avatar src={image} />
        <span>
          {roomId} ({onlineCount} online)
        </span>
        <RoomActions>
          {/* <ActionButton><FaVideo/></ActionButton>
          <ActionButton><FaPhoneAlt/></ActionButton>
          <ActionLink to="/live-stream">
  <CiStreamOn />
</ActionLink> */}

          {ownerToken && (
            <ActionButton onClick={handleDestroyRoom} style={{ color: "red" }}>
              {" "}
              ✖{" "}
            </ActionButton>
          )}
        </RoomActions>
      </Header>

      <MessageContainer>
        {messages.map((m, i) => {
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

                  const ytId = extractYoutubeId(part);

                  if (ytId) {
                    return (
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        style={{
                          border: "0px",
                          padding: 0,
                          margin: 0,
                          width: "100%",
                          height: "200px",
                          borderRadius: "8px",
                        }}
                        title="YouTube video"
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

              {m.file && (
                <FileCard onClick={() => setFullscreen(m.file)}>
                  {m.file.type === "application/pdf" && (
                    <iframe
                      title={m.file.name}
                      src={m.file.url}
                      style={{ width: "100%", height: 250, borderRadius: 10 }}
                    />
                  )}
                  {m.file.type.startsWith("image") && (
                    <img
                      alt={m.file.name}
                      src={m.file.url}
                      style={{ width: "100%" }}
                    />
                  )}
                  {m.file.type.startsWith("video") && (
                    <video
                      src={m.file.url}
                      controls
                      style={{ width: "100%" }}
                    />
                  )}
                  {m.file.type.startsWith("audio") && (
                    <audio src={m.file.url} controls />
                  )}
                  {m.gif && (
                    <img
                      src={m.gif}
                      alt="GIF"
                      style={{ maxWidth: "200px", borderRadius: 10 }}
                      onClick={() =>
                        setFullscreen({ url: m.gif, type: "image" })
                      }
                    />
                  )}

                  {!m.file.type.startsWith("image/") &&
                    !m.file.type.startsWith("video/") &&
                    !m.file.type.startsWith("audio/") &&
                    m.file.type !== "application/pdf" && (
                      <a
                        href={m.file.url}
                        download={m.file.name}
                        style={{ color: "#00bfa5", fontSize: "0.9rem" }}
                      >
                        {" "}
                        📎 {m.file.name}{" "}
                      </a>
                    )}
                </FileCard>
              )}

              <Timestamp>{new Date(m.ts).toLocaleTimeString()}</Timestamp>
            </MessageBubble>
          );
        })}
        {typingUsers.length > 0 && (
  <TypingIndicator>
    {typingUsers.join(", ")} typing…
  </TypingIndicator>
)}

      </MessageContainer>

           {showGifPicker && (
  <GifPickerOverlay onClick={() => setShowGifPicker(false)}>
    <GifPickerModal onClick={e => e.stopPropagation()}>
     <GifPickerHeader>
  <GifSearchInput
    placeholder="Search GIFs..."
    value={gifQuery}
    onChange={e => setGifQuery(e.target.value)}
    onKeyDown={e => e.key === "Enter" && fetchGifs(gifQuery)}
  />
  <SearchGifButton onClick={() => fetchGifs(gifQuery)}><FaSearch /></SearchGifButton>
  <CloseGifPickerButton onClick={() => setShowGifPicker(false)}><AiOutlineClose /></CloseGifPickerButton>
</GifPickerHeader>


 <GifGrid ref={gifGridRef}>
  {gifs.map(gif => (
    <GifCard key={gif.id}>
      <GifItem src={gif.images.fixed_height.url} alt={gif.title} loading="lazy" />
      <CardOverlay>
        <OverlayButton onClick={async () => {
          try {
            const res = await fetch(gif.images.fixed_height.url);
            const blob = await res.blob();
            const file = new File([blob], `GIF-${Date.now()}.gif`, { type: "image/gif" });
            uploadFile(file);
          } catch (err) {
            console.error("Failed to send GIF:", err);
          }
        }}>
          <FaPaperPlane style={{ size: 'sm'}}/>
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

            <PreviewContent>
              {pendingFile.type.startsWith("image") && (
                <img alt={pendingFile.name} src={previewUrl} />
              )}

              {pendingFile.type.startsWith("video") && (
                <video src={previewUrl} controls />
              )}

              {pendingFile.type.startsWith("audio") && (
                <audio src={previewUrl} controls />
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
              style={{ maxWidth: "90%" }}
            />
          )}
        </div>
      )}
    </ChatContainer>
  );
}
