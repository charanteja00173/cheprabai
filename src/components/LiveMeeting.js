import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { FaMicrophone, FaVideo, FaPhoneSlash, FaPause, FaSync, FaTv, FaDesktop, FaFolderOpen, FaRecordVinyl, FaThumbtack } from "react-icons/fa";
import { Peer } from "peerjs";
import { toast } from "react-toastify";

const MeetingOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10005;
  background: rgba(10, 10, 10, 0.95);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  color: white;
  padding: 20px;
`;

const MeetingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ContentLayout = styled.div`
  display: flex;
  flex: 1;
  gap: 20px;
  min-height: 0;
  ${props => !props.isAdmin && `
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  `}
  @media (max-width: 1024px) {
    flex-direction: column;
  }
`;

const MainStage = styled.div`
  flex: 3;
  background: #000;
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 30px 60px rgba(0,0,0,0.6);
`;

const ParticipantGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding-right: 10px;
`;

const VideoTile = styled.div`
  background: #1a1a1a;
  border-radius: 16px;
  aspect-ratio: 16/9;
  position: relative;
  overflow: hidden;
  border: 2px solid ${props => props.isTalking ? "#4CAF50" : "rgba(255,255,255,0.05)"};
  transition: all 0.3s ease;
  video { width: 100%; height: 100%; object-fit: cover; }
`;

const NameTag = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  backdrop-filter: blur(4px);
`;

const ControlBar = styled.div`
  height: 85px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 24px;
  margin-top: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 30px;
`;

const CircleButton = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 1px solid ${props => props.active ? "rgba(255, 71, 87, 0.5)" : "rgba(255, 255, 255, 0.1)"};
  background: ${props => props.active ? "#ff4757" : "rgba(255, 255, 255, 0.05)"};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  &:hover { transform: translateY(-2px); background: ${props => props.active ? "#ff6b81" : "rgba(255, 255, 255, 0.12)"}; }
`;

const WatchInput = styled.input`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 10px 15px;
  color: white;
  width: 250px;
  outline: none;
  font-size: 0.9rem;
  &:focus { border-color: #2196F3; }
`;

const PrivacyGuard = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.9);
  backdrop-filter: blur(50px);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: white;
  opacity: ${props => props.show ? 1 : 0};
  pointer-events: ${props => props.show ? "all" : "none"};
  transition: opacity 0.3s ease;
`;

const Watermark = styled.div`
  position: absolute;
  top: ${props => props.y}%;
  left: ${props => props.x}%;
  opacity: 0.1;
  font-size: 0.8rem;
  color: white;
  pointer-events: none;
  z-index: 50;
  white-space: nowrap;
  transition: all 8s linear;
`;

export default function LiveMeeting({ socket, roomId, userName, onClose, isAdmin }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [watchUrl, setWatchUrl] = useState("");
  const [activeMedia, setActiveMedia] = useState(null);
  const [speakingPeers] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [isFocused, setIsFocused] = useState(true);
  const [watermarkPos, setWatermarkPos] = useState({ x: 10, y: 10 });
  const [focusedPeerId, setFocusedPeerId] = useState(null);
  
  const peerRef = useRef(null);
  const myVideoRef = useRef();
  const mediaRef = useRef();
  const isRemoteUpdate = useRef(false);
  const peers = useRef({});
  const recorderRef = useRef(null);
  const recordedChunks = useRef([]);

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        const backendUrl = new URL(process.env.REACT_APP_SOCKET_ENDPOINT || "http://localhost:4000");
        const peer = new Peer(undefined, {
          path: "/peerjs", host: backendUrl.hostname,
          port: backendUrl.port || (backendUrl.protocol === "https:" ? 443 : 80),
          secure: backendUrl.protocol === "https:",
        });

        peer.on("open", (id) => socket.emit("join-call", { roomId, peerId: id, userName }));
        peer.on("call", (call) => {
          call.answer(stream);
          call.on("stream", (rem) => setRemoteStreams(p => ({ ...p, [call.peer]: { stream: rem, name: "Participant" } })));
        });
        peerRef.current = peer;

        socket.on("user-connected-call", ({ peerId, name }) => {
          const call = peer.call(peerId, stream);
          call.on("stream", (rem) => setRemoteStreams(p => ({ ...p, [peerId]: { stream: rem, name } })));
          peers.current[peerId] = call;
        });

        socket.on("user-disconnected-call", (id) => {
          if (peers.current[id]) peers.current[id].close();
          setRemoteStreams(p => { const n = { ...p }; delete n[id]; return n; });
        });

        socket.on("syncMedia", (data) => {
            isRemoteUpdate.current = true;
            setIsSyncing(true);
            setActiveMedia(data);
            setTimeout(() => setIsSyncing(false), 1000);
        });

        socket.on("reaction", (emoji) => {
            const id = Date.now() + Math.random();
            setReactions(p => [...p, { id, emoji, x: Math.random() * 80 + 10 }]);
            setTimeout(() => setReactions(p => p.filter(r => r.id !== id)), 3000);
        });

        const handleBlur = () => !isAdmin && setIsFocused(false);
        const handleFocus = () => setIsFocused(true);
        window.addEventListener("blur", handleBlur);
        window.addEventListener("focus", handleFocus);
        const wmInterval = setInterval(() => setWatermarkPos({ x: Math.random() * 80, y: Math.random() * 80 }), 8000);

        socket.emit("getMediaState", roomId);

        const handleContextMenu = (e) => e.preventDefault();
        document.addEventListener("contextmenu", handleContextMenu);

        return () => {
          window.removeEventListener("blur", handleBlur);
          window.removeEventListener("focus", handleFocus);
          document.removeEventListener("contextmenu", handleContextMenu);
          clearInterval(wmInterval);
        };
      } catch (err) { console.error("Media init failed", err); }
    };
    initMedia();
    return () => {
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (peerRef.current) peerRef.current.destroy();
      socket.off("user-connected-call"); socket.off("user-disconnected-call");
      socket.off("syncMedia"); socket.off("reaction");
    };
  }, [roomId, socket, userName, isAdmin, localStream]);

  useEffect(() => {
    if (!mediaRef.current || !activeMedia || isRemoteUpdate.current) return;
    const applySync = async () => {
      try {
        const v = mediaRef.current;
        if (Math.abs(v.currentTime - activeMedia.time) > 2) v.currentTime = activeMedia.time;
        if (activeMedia.playing && v.paused) await v.play();
        else if (!activeMedia.playing && !v.paused) v.pause();
      } catch (e) {}
    };
    applySync();
    const t = setTimeout(() => { isRemoteUpdate.current = false; }, 800);
    return () => clearTimeout(t);
  }, [activeMedia]);

  const handleStartWatch = () => {
    if (!watchUrl) return;
    const data = { url: watchUrl, playing: true, time: 0, type: "url" };
    setActiveMedia(data);
    socket.emit("syncMedia", data);
  };

  const handleLocalFile = (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        setActiveMedia({ url, playing: true, time: 0, type: "local", name: file.name });
        socket.emit("syncMedia", { url: null, playing: true, time: 0, type: "local", name: file.name });
    }
  };

  const handleClearMedia = () => {
      if (!isAdmin) return;
      setActiveMedia(null);
      socket.emit("syncMedia", null);
  };

  const handleMediaAction = (action) => {
    if (!mediaRef.current || isRemoteUpdate.current) return;
    const data = { url: activeMedia?.url, playing: action === "play", time: mediaRef.current.currentTime, sender: userName };
    setActiveMedia(data);
    socket.emit("syncMedia", data);
  };

  const startScreenShare = async () => {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { 
                cursor: "always",
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30, max: 60 }
            },
            audio: true
        });

        const videoTrack = screenStream.getVideoTracks()[0];
        // Optimize for static content clarity (text/code)
        if ('contentHint' in videoTrack) {
            videoTrack.contentHint = 'detail';
        }

        if (myVideoRef.current) myVideoRef.current.srcObject = screenStream;

        // Replace track for all active calls to prevent hanging/reconnection issues
        Object.values(peers.current).forEach(call => {
            const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack);
        });

        videoTrack.onended = () => {
            stopScreenShare();
        };
    } catch (err) {
        console.error("Screen share failed", err);
        toast.error("Failed to start screen share");
    }
  };

  const stopScreenShare = async () => {
    try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        
        if (myVideoRef.current) myVideoRef.current.srcObject = videoStream;
        setLocalStream(videoStream);

        Object.values(peers.current).forEach(call => {
            const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack);
        });
    } catch (err) {
        console.error("Failed to revert to camera", err);
    }
  };

  const toggleRecording = () => {
    if (!isAdmin) return;
    if (isRecording) { recorderRef.current.stop(); setIsRecording(false); }
    else {
        const stream = mediaRef.current?.captureStream() || localStream;
        const rec = new MediaRecorder(stream);
        recordedChunks.current = [];
        rec.ondataavailable = (e) => recordedChunks.current.push(e.data);
        rec.onstop = () => {
            const blob = new Blob(recordedChunks.current, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `Recording_${Date.now()}.webm`; a.click();
        };
        rec.start(); recorderRef.current = rec; setIsRecording(true);
        toast.info("⏺ Recording Started");
    }
  };

  const sendReaction = (emoji) => {
    socket.emit("reaction", emoji);
    const id = Date.now() + Math.random();
    setReactions(p => [...p, { id, emoji, x: Math.random() * 80 + 10 }]);
    setTimeout(() => setReactions(p => p.filter(r => r.id !== id)), 3000);
  };

  return (
    <MeetingOverlay>
      <MeetingHeader>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <div style={{ width: 12, height: 12, background: "#ff4757", borderRadius: "50%", boxShadow: "0 0 10px #ff4757" }} />
          <h2 style={{ margin: 0 }}>Social Stage: {roomId}</h2>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <WatchInput placeholder="Enter Video URL..." value={watchUrl} onChange={(e) => setWatchUrl(e.target.value)} />
          <CircleButton onClick={handleStartWatch} title="Play URL"><FaTv /></CircleButton>
          <label><CircleButton as="span" title="Select File"><FaFolderOpen /><input type="file" hidden accept="video/*" onChange={handleLocalFile} /></CircleButton></label>
          {isAdmin && <CircleButton onClick={handleClearMedia} title="Clear Stage"><FaPause /></CircleButton>}
          <CircleButton active onClick={onClose}><FaPhoneSlash /></CircleButton>
        </div>
      </MeetingHeader>

      <ContentLayout isAdmin={isAdmin}>
        <MainStage>
          {!isAdmin && <PrivacyGuard show={!isFocused}><h3>Privacy Guard Active</h3><p>Screenshots and captures are restricted.</p></PrivacyGuard>}
          <Watermark x={watermarkPos.x} y={watermarkPos.y}>{userName} | {new Date().toLocaleTimeString()} | CONFIDENTIAL</Watermark>
          {reactions.map(r => (
            <div key={r.id} style={{ position: "absolute", bottom: 0, left: `${r.x}%`, fontSize: "2.5rem", animation: "floatUp 3s ease-out forwards", zIndex: 100 }}>{r.emoji}</div>
          ))}
          {isSyncing && <div style={{ position: "absolute", top: 20, right: 20, color: "#4CAF50", display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.6)", padding: "8px 15px", borderRadius: "10px", backdropFilter: "blur(5px)" }}><FaSync style={{ animation: "spin 1s linear infinite" }} /> Real-time Syncing...</div>}
          
          {focusedPeerId ? (
              <div style={{ width: "100%", height: "100%", position: "relative" }}>
                 <video autoPlay playsInline ref={el => { if (el) el.srcObject = focusedPeerId === "local" ? localStream : remoteStreams[focusedPeerId]?.stream; }} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                 <div style={{ position: "absolute", top: 20, left: 20, background: "rgba(0,0,0,0.6)", padding: "5px 15px", borderRadius: 20, display: "flex", alignItems: "center", gap: 10 }}>
                    <span>Pinned: {focusedPeerId === "local" ? "You" : remoteStreams[focusedPeerId]?.name}</span>
                    <button onClick={() => setFocusedPeerId(null)} style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}>✕</button>
                 </div>
              </div>
          ) : activeMedia ? (
            <div key={activeMedia.url} style={{ width: "100%", height: "100%" }}>
               {activeMedia.url?.includes("youtu") ? (
                  <iframe title="YouTube Video" src={`https://www.youtube.com/embed/${activeMedia.url.includes("youtu.be") ? activeMedia.url.split("/").pop() : activeMedia.url.split("v=")[1]?.split("&")[0]}`} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen />
               ) : (
                 <video ref={mediaRef} src={activeMedia.url} style={{ width: "100%", height: "100%" }} onPlay={() => handleMediaAction("play")} onPause={() => handleMediaAction("pause")} />
               )}
            </div>
          ) : (
            <div style={{ opacity: 0.2 }}><FaTv size={100} /></div>
          )}
        </MainStage>

        <ParticipantGrid>
          <VideoTile isTalking={speakingPeers.local}><video ref={myVideoRef} autoPlay muted playsInline /><NameTag>{userName} (You) <FaThumbtack size={10} style={{ cursor: 'pointer' }} onClick={() => setFocusedPeerId("local")} /></NameTag></VideoTile>
          {Object.entries(remoteStreams).map(([id, info]) => (
            <VideoTile key={id} isTalking={speakingPeers[id]}><video autoPlay playsInline ref={el => { if (el) el.srcObject = info.stream; }} /><NameTag>{info.name} <FaThumbtack size={10} style={{ cursor: 'pointer' }} onClick={() => setFocusedPeerId(id)} /></NameTag></VideoTile>
          ))}
        </ParticipantGrid>
      </ContentLayout>

      <ControlBar>
        <CircleButton active={isMuted} onClick={() => { localStream.getAudioTracks()[0].enabled = isMuted; setIsMuted(!isMuted); }}><FaMicrophone /></CircleButton>
        <CircleButton active={isVideoOff} onClick={() => { localStream.getVideoTracks()[0].enabled = isVideoOff; setIsVideoOff(!isVideoOff); }}><FaVideo /></CircleButton>
        <CircleButton onClick={startScreenShare} title="Share Screen"><FaDesktop /></CircleButton>
        {isAdmin && <CircleButton active={isRecording} onClick={toggleRecording} title="Record"><FaRecordVinyl /></CircleButton>}
        <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.1)", margin: "0 10px" }} />
        {["❤️", "🔥", "👏", "😂"].map(e => <CircleButton key={e} onClick={() => sendReaction(e)}>{e}</CircleButton>)}
      </ControlBar>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes floatUp { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-700px) scale(2.5); opacity: 0; } }
      `}</style>
    </MeetingOverlay>
  );
}
