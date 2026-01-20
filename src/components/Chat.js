import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import styled, { keyframes } from "styled-components";
import { FaPaperPlane, FaVideo, FaPhoneAlt, FaFileUpload } from "react-icons/fa";
import { CiStreamOn } from "react-icons/ci";
import image from "../logo192.png";
import notificationSound from "../assets/iphone-sms.mp3";

const SECURITY_CODE = process.env.REACT_APP_SECURITY_CODES.split(",");
const CHUNK_SIZE = 1024 * 1024 * 5;

const colorPalette = [
  "#FF5722", "#4CAF50", "#2196F3", "#9C27B0", "#FFC107", "#00BCD4",
  "#E91E63", "#8BC34A", "#FF9800", "#3F51B5"
];

const glow = keyframes`
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
`;

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #121212;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 20px;
  background: #1f1f1f;
  color: #fff;
  border-bottom: 1px solid #333;
  position: relative;
  font-weight: bold;
  font-size: 1.1rem;
`;

const Avatar = styled.img`
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  margin-right: 10px;
`;

const RoomActions = styled.div`
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 10px;
`;

const ActionButton = styled.button`
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  &:hover { color: #00bfa5; }
`;

const MessageContainer = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #181818;
`;

const MessageBubble = styled.div`
  max-width: 75%;
  padding: ${({ isFile }) => (isFile ? "5px" : "10px 15px")};
  border-radius: 12px;
  background: ${({ isSender, isSystem, userColor }) =>
  isSystem
    ? "#555"               
    : isSender
      ? "#3a3f55"          
      : userColor || "#444" 
};
color: #fff;

  align-self: ${({ isSender, isSystem }) =>
    isSystem ? "center" : isSender ? "flex-end" : "flex-start"};
  text-align: ${({ isSystem }) => (isSystem ? "center" : "left")};
  font-style: ${({ isSystem }) => (isSystem ? "italic" : "normal")};
  opacity: ${({ isSystem }) => (isSystem ? 0.8 : 1)};
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const FileCard = styled.div`
  background: #222;
  border-radius: 10px;
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
`;

// const FileName = styled.span`
//   font-size: 0.8rem;
//   color: #ccc;
//   font-weight: bold;
// `;

// const FileActions = styled.div`
//   display: flex;
//   justify-content: flex-end;
//   gap: 10px;
// `;

const Timestamp = styled.span`
  font-size: 0.7rem;
  color: #ccc;
  position: absolute;
  bottom: -15px;
  right: 10px;
`;

const TypingIndicator = styled.div`
  font-size: 0.8rem;
  color: #aaa;
  font-style: italic;
  animation: ${glow} 1.5s infinite;
`;

const MessageInputContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 20px;
  background: #1f1f1f;
  border-top: 1px solid #333;
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 12px 15px;
  border-radius: 20px;
  border: 1px solid #333;
  background: #121212;
  color: #fff;
  outline: none;
`;

const FileInput = styled.input` display: none; `;
const FileUploadLabel = styled.label`
  margin-right: 10px;
  font-size: 1.3rem;
  cursor: pointer;
  color: #fff;
`;
const SendButton = styled.button`
  margin-left: 10px;
  padding: 10px 12px;
  border-radius: 50%;
  border: none;
  background: #00bfa5;
  color: #000;
  cursor: pointer;
`;

const JoinRoomContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  align-items: center;
  color: #fff;
`;

const GlowingInput = styled.input`
  width: 250px;
  padding: 12px;
  margin-bottom: 10px;
  border-radius: 25px;
  border: 2px solid #333;
  background: #121212;
  color: #fff;
`;

const JoinButton = styled.button`
  padding: 12px 25px;
  border-radius: 25px;
  border: none;
  background: #00bfa5;
  cursor: pointer;
  font-weight: bold;
`;

const ChatRoom = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [ownerToken, setOwnerToken] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);
  const audioRef = useRef(new Audio(notificationSound));
  const fileChunksRef = useRef({});
  const typingTimeout = useRef(null);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const userColorsRef = useRef({}); 

   const socketRef = useRef(null);

useEffect(() => {
  socketRef.current = io(process.env.REACT_APP_SOCKET_ENDPOINT);

  return () => {
    socketRef.current?.disconnect();
  };
}, []);


  // Function to get a color for a username
const getUsernameColor = (name) => {
  if (!userColorsRef.current[name]) {
    // Assign a random color from the palette
    const color = colorPalette[Object.keys(userColorsRef.current).length % colorPalette.length];
    userColorsRef.current[name] = color;
  }
  return userColorsRef.current[name];
};

  const handleTyping = (value) => {
    socketRef.current.emit("typing", value.length > 0);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socketRef.current.emit("typing", false), 1000);
  };

  useEffect(() => {
    if (!joined) return;

    socketRef.current.emit("joinRoom", { roomId, userName });

    socketRef.current.on("newMessage", (msg) => {
      if (msg.userName === "System") {
        if (msg.text.includes("joined the room"))
          msg.text = msg.userNameRef === userName ? "You joined the room" : `${msg.userNameRef} joined the room`;
        if (msg.text.includes("left the room"))
          msg.text = msg.userNameRef === userName ? "You left the room" : `${msg.userNameRef} left the room`;
      }

      setMessages(prev => [...prev, msg]);
      if (msg.userName !== userName && msg.userName !== "System") audioRef.current.play().catch(() => {});
    });

    socketRef.current.on("presence", ({ online }) => setOnlineCount(online.length));
    socketRef.current.on("typing", (users) => setTypingUsers(users.filter(u => u !== userName)));

    socketRef.current.on("receiveFileChunk", ({ chunk, chunkIndex, totalChunks, fileName, fileType, userName: senderName }) => {
      if (!fileChunksRef.current[fileName]) fileChunksRef.current[fileName] = [];
      fileChunksRef.current[fileName][chunkIndex] = chunk;

      const receivedChunks = fileChunksRef.current[fileName].filter(Boolean).length;
      if (receivedChunks === totalChunks) {
        const blob = new Blob(fileChunksRef.current[fileName], { type: fileType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        setMessages(prev => [...prev, { userName: senderName, file: { name: fileName, url, type: fileType || 'application/octet-stream' }, ts: Date.now() }]);
         if (senderName !== userName) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
        delete fileChunksRef.current[fileName];
      }
    });

    socketRef.current.on("roomOwner", (token) => setOwnerToken(token));
    socketRef.current.on("roomDestroyed", () => { alert("Room was destroyed!"); setJoined(false); setMessages([]); });

    return () => {
      socketRef.current.off("newMessage"); socketRef.current.off("typing"); socketRef.current.off("receiveFileChunk");
      socketRef.current.off("roomOwner"); socketRef.current.off("roomDestroyed");
    };
  }, [joined, roomId, userName]);

  const handleJoinRoom = () => {
    if (!roomId || !userName) return setErrorMessage("Enter room and name");
    if (!SECURITY_CODE.includes(securityCode)) return setErrorMessage("Invalid security code");
    setJoined(true);
    setErrorMessage("");
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    socketRef.current.emit("sendMessage", { text: message, userName, ts: Date.now() });
    setMessage("");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE); let chunkIndex = 0; const reader = new FileReader();
    const loadNext = () => { const start = chunkIndex * CHUNK_SIZE; const end = Math.min(file.size, start + CHUNK_SIZE); reader.readAsArrayBuffer(file.slice(start, end)); };
    reader.onload = (ev) => {
      socketRef.current.emit("sendFileChunk", { roomId, chunk: ev.target.result, chunkIndex, totalChunks, fileName: file.name, fileType: file.type, userName });
      chunkIndex++; if (chunkIndex < totalChunks) loadNext();
    };
    loadNext();
  };

  const handleDestroyRoom = () => {
    if (!roomId || !ownerToken) return;
    if (window.confirm("Destroy this room? All messages will be lost!")) {
      socketRef.current.emit("destroyRoom", { roomId, token: ownerToken });
      setMessages([]);
      setJoined(false);
    }
  };

  if (!joined) return (
    <ChatContainer>
      <JoinRoomContainer>
        <h2>Join Room</h2>
        <GlowingInput placeholder="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        <GlowingInput placeholder="Name" value={userName} onChange={(e) => setUserName(e.target.value)} />
        <GlowingInput placeholder="Security Code" value={securityCode} onChange={(e) => setSecurityCode(e.target.value)} />
        {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
        <JoinButton onClick={handleJoinRoom}>Join</JoinButton>
      </JoinRoomContainer>
    </ChatContainer>
  );

  return (
    <ChatContainer>
      <Header>
        <Avatar src={image} />
        <span>{roomId} ({onlineCount} online)</span>
        <RoomActions>
          <ActionButton><FaVideo /></ActionButton>
          <ActionButton><FaPhoneAlt /></ActionButton>
          <ActionButton><CiStreamOn /></ActionButton>
           {ownerToken && (
            <ActionButton onClick={handleDestroyRoom} style={{ color: "red" }}>
              ✖
            </ActionButton>
          )}
        </RoomActions>
      </Header>

   <MessageContainer>
  {messages.map((msg, idx) => (
    <MessageBubble
      key={idx}
      isSender={msg.userName === userName}
      isSystem={msg.userName === "System"}
      isFile={!!msg.file}
      style={{ marginBottom: "15px", fontSize: msg.userName === "System" ? "0.85rem" : "0.9rem" }}
    >
      {/* SYSTEM MESSAGE */}
      {msg.userName === "System" && (
        <div
          style={{
            color: "#00bfa5",
            fontStyle: "italic",
            textAlign: "center",
            fontSize: "0.85rem",
            marginBottom: "5px",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* FILE MESSAGE */}
      {msg.file && (
        <FileCard style={{ marginBottom: "5px" }}>
          {msg.file.type.startsWith("image/") && (
            <img alt={msg.file.name} src={msg.file.url} style={{ width: "100%", borderRadius: 10 }} />
          )}
          {msg.file.type.startsWith("video/") && (
            <video src={msg.file.url} controls style={{ width: "100%", borderRadius: 10 }} />
          )}
          {msg.file.type.startsWith("audio/") && (
            <audio
  src={msg.file.url}
  controls
  style={{
    height: "40px",
    borderRadius: "8px",
    backgroundColor: "#222",
  }}
/>
          )}
          {msg.file.type === "application/pdf" && (
            <iframe title={msg.file.name} src={msg.file.url} style={{ width: "100%", height: 250, borderRadius: 10 }} />
          )}
          {!msg.file.type.startsWith("image/") &&
           !msg.file.type.startsWith("video/") &&
           !msg.file.type.startsWith("audio/") &&
           msg.file.type !== "application/pdf" && (
            <a href={msg.file.url} download={msg.file.name} style={{ color: "#00bfa5", fontSize: "0.9rem" }}>
              📎 {msg.file.name}
            </a>
          )}
        </FileCard>
      )}

      {/* TEXT MESSAGE */}
{!msg.file && msg.userName !== "System" && (
  <div style={{ marginBottom: "5px", fontSize: "0.9rem" }}>
    {msg.userName !== userName && (
      <strong
        style={{
          fontSize: "0.85rem",
          color: getUsernameColor(msg.userName),
          fontWeight: "bold",
        }}
      >
        {msg.userName}
      </strong>
    )}
    <div>
      {msg.text.split(urlRegex).map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "0.9rem", color: "#fff" }}
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </div>
  </div>
)}


      <Timestamp style={{ fontSize: "0.7rem" }}>{new Date(msg.ts).toLocaleTimeString()}</Timestamp>
    </MessageBubble>
  ))}

  {typingUsers.length > 0 && <TypingIndicator style={{ fontSize: "0.8rem" }}>{typingUsers.join(", ")} typing...</TypingIndicator>}
</MessageContainer>


      <MessageInputContainer>
        <FileUploadLabel htmlFor="file-input"><FaFileUpload /></FileUploadLabel>
        <FileInput id="file-input" type="file" onChange={handleFileUpload} />
        <MessageInput placeholder="Type a message..." value={message} onChange={(e) => { setMessage(e.target.value); handleTyping(e.target.value); }} onKeyDown={(e) => e.key==="Enter" && handleSendMessage()} />
        <SendButton onClick={handleSendMessage}><FaPaperPlane /></SendButton>
      </MessageInputContainer>
    </ChatContainer>
  );
};

export default ChatRoom;
