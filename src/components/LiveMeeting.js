import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { FaMicrophone, FaVideo, FaPhoneSlash, FaSync, FaDesktop, FaFolderOpen, FaRecordVinyl, FaThumbtack, FaThLarge, FaCompress, FaExpand } from "react-icons/fa";
import { Peer } from "peerjs";
import { toast } from "react-toastify";

const MeetingOverlay = styled.div`
  position: fixed;
  inset: 40px;
  z-index: 10005;
  background: rgba(10, 10, 15, 0.45);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  display: flex;
  flex-direction: column;
  color: white;
  padding: 24px;
  overflow: hidden;
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 50px 100px rgba(0, 0, 0, 0.85),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  @media (max-width: 768px) {
    inset: 0;
    border-radius: 0;
    padding: 12px 10px;
    background: #000;
  }
`;

const MeetingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  width: 100%;
  height: 54px;
  flex-shrink: 0;
  padding: 0 12px;
`;

const ContentLayout = styled.div`
  display: flex;
  flex: 1;
  gap: 20px;
  min-height: 0;
  ${props => !props.$isAdmin && `
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
  background: rgba(0, 0, 0, 0.6);
  border-radius: 28px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 30px 60px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
`;

const ParticipantGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  overflow-y: auto;
  padding-right: 8px;

  @media (max-width: 1024px) {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 12px 4px;
    max-height: 150px;
    gap: 12px;
    &::-webkit-scrollbar { display: none; }
  }
`;

const VideoTile = styled.div`
  background: rgba(20, 20, 25, 0.4);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 16/9;
  border: 1px solid ${props => props.$isTalking ? "var(--chakra-colors-brandPrimary)" : "rgba(255,255,255,0.06)"};
  box-shadow: ${props => props.$isTalking 
    ? "0 0 20px rgba(0, 191, 165, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)" 
    : "0 8px 24px rgba(0, 0, 0, 0.3)"};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  flex-shrink: 0;

  @media (max-width: 1024px) {
    width: clamp(130px, 35vw, 170px);
  }

  &:hover {
    transform: translateY(-2px);
    border-color: var(--chakra-colors-brandPrimary);
    box-shadow: 
      0 12px 30px rgba(0, 0, 0, 0.45),
      0 0 15px var(--chakra-colors-brandGlow);
  }

  &:hover .pin-overlay {
    opacity: 1;
  }
  
  video { 
    width: 100%; 
    height: 100%; 
    object-fit: cover; 
  }
`;

const PinOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
  z-index: 10;
`;

const PinButton = styled.div`
  background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: all;
  transform: translateY(8px);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  ${VideoTile}:hover & {
    transform: translateY(0);
  }
`;

const NameTag = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(15, 15, 20, 0.75);
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  gap: 6px;

  @media (max-width: 768px) {
    font-size: 0.65rem;
    padding: 3px 8px;
    bottom: 6px;
    left: 6px;
  }
`;

const ControlBar = styled.div`
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(15, 15, 20, 0.55);
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px 20px;
  z-index: 500;
  box-shadow: 
    0 20px 45px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(15, 15, 20, 0.65);
    bottom: 32px;
    box-shadow: 
      0 25px 50px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 768px) {
    bottom: 12px;
    padding: 6px 12px;
    gap: 8px;
    width: 95%;
    max-width: 95%;
    overflow-x: auto;
    justify-content: safe center;
    border-radius: 16px;
    &::-webkit-scrollbar { display: none; }
    -ms-overflow-style: none;
    scrollbar-width: none;
    white-space: nowrap;
  }
`;

const CircleButton = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 1px solid ${props => props.$active ? "rgba(255, 71, 87, 0.5)" : "rgba(255, 255, 255, 0.06)"};
  background: ${props => props.$active ? "#ff4757" : "rgba(255, 255, 255, 0.04)"};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 38px;
    height: 38px;
    font-size: 0.95rem;
    border-radius: 10px;
  }

  &:hover { 
    transform: translateY(-2px); 
    background: ${props => props.$active ? "#ff6b81" : "rgba(255, 255, 255, 0.1)"};
    border-color: ${props => props.$active ? "rgba(255, 71, 87, 0.8)" : "var(--chakra-colors-brandPrimary)"};
    box-shadow: ${props => props.$active ? "none" : "0 0 10px var(--chakra-colors-brandGlow)"};
  }
  
  &:active {
    transform: translateY(0);
  }
`;



const PrivacyGuard = styled.div`
  position: absolute;
  inset: 0;
  z-index: 200;
  background: #000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: white;
  opacity: ${props => props.show ? 1 : 0};
  pointer-events: ${props => props.show ? "all" : "none"};
  transition: opacity 0.3s ease;
  user-select: none;

  h3 { font-size: 1.5rem; margin-bottom: 10px; }
  p { font-size: 1rem; opacity: 0.7; }

  @media (max-width: 768px) {
    h3 { font-size: 1.1rem; }
    p { font-size: 0.8rem; }
  }

  &::before {
      content: "";
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(45deg, #000, #000 10px, #111 10px, #111 20px);
      opacity: 0.9;
  }
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
  const [activeMedia, setActiveMedia] = useState(null);
  const [speakingPeers, setSpeakingPeers] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [isFocused, setIsFocused] = useState(true);
  const [watermarkPos, setWatermarkPos] = useState({ x: 10, y: 10 });
  const [focusedPeerId, setFocusedPeerId] = useState(null);
  const [myPeerId, setMyPeerId] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef();
  const peerRef = useRef(null);
  const myVideoRef = useRef();
  const mediaRef = useRef();
  const isRemoteUpdate = useRef(false);
  const peers = useRef({});
  const recorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const localStreamRef = useRef(null);

  useEffect(() => {
    const backendUrl = new URL(process.env.REACT_APP_SOCKET_ENDPOINT || "https://cheprabai-backend.onrender.com");

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        const peer = new Peer(undefined, {
          path: "/peerjs",
          host: backendUrl.hostname,
          port: backendUrl.port || (backendUrl.protocol === "https:" ? 443 : 80),
          secure: backendUrl.protocol === "https:",
        });

        peer.on("open", (id) => {
          setMyPeerId(id);
          socket.emit("join-call", { roomId, peerId: id, userName });
        });

        peer.on("call", (call) => {
          call.answer(localStreamRef.current);
          call.on("stream", (rem) => {
            setRemoteStreams(p => {
              const existingName = p[call.peer]?.name || "Participant";
              return { ...p, [call.peer]: { stream: rem, name: existingName } };
            });
          });
          // CRITICAL: Save incoming call to peers ref for screenshare support
          peers.current[call.peer] = call;
        });

        peerRef.current = peer;

        socket.on("existing-callers", (callers) => {
          // Store their names in state, but DO NOT call them. They will receive 'user-connected-call' and call us.
          callers.forEach(({ peerId, name }) => {
            setRemoteStreams(p => ({ ...p, [peerId]: { stream: p[peerId]?.stream || null, name } }));
          });
        });

        socket.on("user-connected-call", ({ peerId, name }) => {
          // Pre-populate name in state
          setRemoteStreams(p => ({ ...p, [peerId]: { stream: p[peerId]?.stream || null, name } }));

          if (localStreamRef.current && peerRef.current) {
            const call = peerRef.current.call(peerId, localStreamRef.current);
            call.on("stream", (rem) => {
              setRemoteStreams(p => ({ ...p, [peerId]: { stream: rem, name } }));
              toast.info(`${name} joined the stage`);
            });
            peers.current[peerId] = call;
          }
        });

        // Basic Audio Activity Detection
        if (localStreamRef.current) {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(localStreamRef.current);
          const analyzer = audioContext.createAnalyser();
          analyzer.fftSize = 512;
          source.connect(analyzer);
          const data = new Uint8Array(analyzer.frequencyBinCount);

          const checkVolume = () => {
            analyzer.getByteFrequencyData(data);
            const volume = data.reduce((a, b) => a + b) / data.length;
            const isTalking = volume > 30; // Threshold
            setSpeakingPeers(p => {
                if (p.local === isTalking) return p;
                return { ...p, local: isTalking };
            });
            requestAnimationFrame(checkVolume);
          };
          checkVolume();
        }

        socket.on("user-disconnected-call", (id) => {
          if (peers.current[id]) peers.current[id].close();
          setRemoteStreams(p => {
            const n = { ...p };
            delete n[id];
            return n;
          });
        });

        socket.on("screenshare-started", ({ peerId }) => {
        setFocusedPeerId(peerId);
        toast.info("Someone is sharing their screen");
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

        socket.emit("getMediaState", roomId);
      } catch (err) {
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
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerRef.current) peerRef.current.destroy();
      socket.off("user-connected-call");
      socket.off("existing-callers");
      socket.off("user-disconnected-call");
      socket.off("syncMedia");
      socket.off("reaction");
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("contextmenu", handleContextMenu);
      clearInterval(wmInterval);
    };
  }, [roomId, socket, userName, isAdmin]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Meeting in progress. Leaving will disconnect you from the call. Continue?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!mediaRef.current || !activeMedia) return;
    
    const v = mediaRef.current;
    
    // Always sync time if drift is significant
    if (Math.abs(v.currentTime - activeMedia.time) > 1.2) {
        v.currentTime = activeMedia.time;
    }

    // Handle Play/Pause sync
    const handleSync = async () => {
        try {
            if (activeMedia.playing && v.paused) {
                // Try playing. If blocked, try muted as fallback
                await v.play().catch(async () => {
                    v.muted = true;
                    await v.play();
                    toast.info("Click anywhere to enable audio");
                });
            } else if (!activeMedia.playing && !v.paused) {
                v.pause();
            }
        } catch (e) {
        }
    };

    if (isRemoteUpdate.current) {
        handleSync();
        // Reset flag after a delay to allow state stabilization
        const t = setTimeout(() => { isRemoteUpdate.current = false; }, 1200);
        return () => clearTimeout(t);
    }
  }, [activeMedia]);

  // Heartbeat Sync to handle drift
  useEffect(() => {
      if (!isAdmin || !activeMedia || !activeMedia.playing || !mediaRef.current) return;
      const interval = setInterval(() => {
          if (mediaRef.current && !isRemoteUpdate.current) {
              socket.emit("syncMedia", { 
                  ...activeMedia, 
                  time: mediaRef.current.currentTime, 
                  heartbeat: true 
              });
          }
      }, 5000);
      return () => clearInterval(interval);
  }, [isAdmin, activeMedia, socket]);



  const handleLocalFile = (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        setActiveMedia({ url, playing: true, time: 0, type: "local", name: file.name });
        socket.emit("syncMedia", { url: null, playing: true, time: 0, type: "local", name: file.name });
    }
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
    if (!mediaRef.current || isRemoteUpdate.current) return;
    const data = { 
      url: activeMedia?.url, 
      playing: action === "play" || (action === "seek" && !mediaRef.current.paused), 
      time: mediaRef.current.currentTime, 
      sender: userName 
    };
    setActiveMedia(data);
    socket.emit("syncMedia", data);
  };

  const startScreenShare = async () => {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            toast.error("Screen sharing is not supported on this device or browser.");
            return;
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { 
                cursor: "always",
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 24, max: 30 } // Optimized for stability
            },
            audio: true
        });

        const videoTrack = screenStream.getVideoTracks()[0];
        // Optimize for static content clarity (text/code)
        if ('contentHint' in videoTrack) {
            videoTrack.contentHint = 'detail';
        }

        if (myVideoRef.current) myVideoRef.current.srcObject = screenStream;

        // Replace track and apply bitrate constraints for performance
        Object.values(peers.current).forEach(async (call) => {
            if (call.peerConnection) {
                const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                    
                    // Bandwidth Optimization: Cap at 2.5Mbps for smooth 1080p
                    const params = sender.getParameters();
                    if (!params.encodings) params.encodings = [{}];
                    params.encodings[0].maxBitrate = 2500000; 
                    sender.setParameters(params).catch(e => {});
                }
            }
        });

        // Update local UI and Notify others
        setFocusedPeerId("local");
        socket.emit("screenshare-started", { roomId, peerId: myPeerId });

        videoTrack.onended = () => {
            stopScreenShare();
        };
    } catch (err) {
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
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
        }
        setIsRecording(false);
        return;
    }

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            toast.error("Screen recording is not supported on your browser (e.g., older mobile Safari).");
            return;
        }

        // Capture screen with system audio
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true
        });

        const tracks = [...displayStream.getVideoTracks()];
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();

        // Mix screen audio
        if (displayStream.getAudioTracks().length > 0) {
            const displayAudioSource = audioContext.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks()));
            displayAudioSource.connect(destination);
        }

        // Mix local microphone audio
        if (localStream && localStream.getAudioTracks().length > 0) {
            const micAudioSource = audioContext.createMediaStreamSource(new MediaStream(localStream.getAudioTracks()));
            micAudioSource.connect(destination);
        }

        const mixedStream = new MediaStream([
            ...tracks,
            ...destination.stream.getTracks()
        ]);

        let options = {};
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            options = { mimeType: 'video/webm;codecs=vp9,opus' };
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            options = { mimeType: 'video/webm;codecs=vp8,opus' };
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            options = { mimeType: 'video/webm' };
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            options = { mimeType: 'video/mp4' };
        }

        const rec = new MediaRecorder(mixedStream, options);
        recordedChunks.current = [];
        rec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) recordedChunks.current.push(e.data);
        };
        rec.onstop = () => {
            const ext = options.mimeType && options.mimeType.includes('mp4') ? 'mp4' : 'webm';
            const blob = new Blob(recordedChunks.current, { type: options.mimeType || "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `Meeting_Recording_${Date.now()}.${ext}`; a.click();

            // Clean up
            displayStream.getTracks().forEach(track => track.stop());
            if (audioContext.state !== 'closed') audioContext.close();
            setIsRecording(false);
        };

        // Stop recording when user clicks "Stop Sharing" on browser banner
        displayStream.getVideoTracks()[0].onended = () => {
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop();
            }
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

  return (
    <MeetingOverlay ref={containerRef}>
      <MeetingHeader>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div className="live-pulse" style={{ width: 8, height: 8, background: "#ff4757", borderRadius: "50%", flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Social Stage</h2>
        </div>
        <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.08)", padding: "4px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)", alignItems: "center" }}>
          <CircleButton 
            style={{ width: 32, height: 32, fontSize: "0.8rem" }}
            onClick={toggleFullscreen} 
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen Mode"}
          >
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </CircleButton>
          <CircleButton 
            style={{ width: 32, height: 32, fontSize: "0.8rem" }}
            active={!showGrid} 
            onClick={() => setShowGrid(!showGrid)} 
            title={showGrid ? "Switch to Theater Mode (Hide Grid)" : "Switch to Grid Mode (Show Participants)"}
          >
            <FaThLarge />
          </CircleButton>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
          <CircleButton $active={true} onClick={onClose} title="Leave Meeting">
            <FaPhoneSlash />
          </CircleButton>
        </div>
      </MeetingHeader>

      <ContentLayout $isAdmin={isAdmin}>
        <MainStage style={{ flex: showGrid ? 3 : 10 }}>
          {!isAdmin && <PrivacyGuard show={!isFocused}><h3>Privacy Guard Active</h3><p>Screenshots and captures are restricted.</p></PrivacyGuard>}
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 60, fontSize: "0.6rem", opacity: 0.3, color: "var(--chakra-colors-textPrimary)" }}>
              ID: {myPeerId || "Connecting..."}
          </div>
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
                    <button onClick={() => setFocusedPeerId(null)} style={{ background: "none", border: "none", color: "var(--chakra-colors-textPrimary)", cursor: "pointer" }}>✕</button>
                 </div>
              </div>
          ) : activeMedia ? (
            <div key={activeMedia.url} style={{ width: "100%", height: "100%" }}>
               {activeMedia.url?.includes("youtu") ? (
                  <iframe title="YouTube Video" src={`https://www.youtube.com/embed/${activeMedia.url.includes("youtu.be") ? activeMedia.url.split("/").pop() : activeMedia.url.split("v=")[1]?.split("&")[0]}`} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen />
                ) : (
                 <video 
                   ref={mediaRef} 
                   src={activeMedia.url} 
                   controls 
                   playsInline
                   style={{ width: "100%", height: "100%" }} 
                   onPlay={() => handleMediaAction("play")} 
                   onPause={() => handleMediaAction("pause")}
                   onSeeked={() => handleMediaAction("seek")}
                 />
               )}
            </div>
          ) : (
            <div style={{ opacity: 0.2 }}><FaDesktop size={100} /></div>
          )}
        </MainStage>

        {showGrid && (
        <ParticipantGrid>
          <VideoTile $isTalking={speakingPeers.local} onClick={() => setFocusedPeerId("local")}>
            <video ref={myVideoRef} autoPlay muted playsInline />
            <PinOverlay className="pin-overlay">
                <PinButton><FaThumbtack /> Pin to Stage</PinButton>
            </PinOverlay>
            <NameTag>
                {userName} (You) {focusedPeerId === "local" && "(Sharing)"}
                <FaThumbtack 
                    size={14} 
                    style={{ cursor: 'pointer', color: focusedPeerId === "local" ? "var(--chakra-colors-brandPrimary)" : "inherit" }} 
                />
            </NameTag>
          </VideoTile>
          {Object.entries(remoteStreams).map(([id, info]) => (
            <VideoTile key={id} $isTalking={speakingPeers[id]} onClick={() => setFocusedPeerId(id)}>
              <video autoPlay playsInline ref={el => { if (el) el.srcObject = info.stream; }} />
              <PinOverlay className="pin-overlay">
                  <PinButton><FaThumbtack /> Pin to Stage</PinButton>
              </PinOverlay>
              <NameTag>
                {info.name} 
                <FaThumbtack 
                    size={14} 
                    style={{ cursor: 'pointer', color: focusedPeerId === id ? "var(--chakra-colors-brandPrimary)" : "inherit" }} 
                />
              </NameTag>
            </VideoTile>
          ))}
        </ParticipantGrid>
        )}
      </ContentLayout>

      <ControlBar>
        <CircleButton $active={isMuted} onClick={() => { if (localStream) { localStream.getAudioTracks()[0].enabled = isMuted; setIsMuted(!isMuted); } }} title={isMuted ? "Unmute Microphone" : "Mute Microphone"}><FaMicrophone /></CircleButton>
        <CircleButton $active={isVideoOff} onClick={() => { if (localStream) { localStream.getVideoTracks()[0].enabled = isVideoOff; setIsVideoOff(!isVideoOff); } }} title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}><FaVideo /></CircleButton>
        <CircleButton onClick={startScreenShare} title="Share Your Screen with Others"><FaDesktop /></CircleButton>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center", borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "10px", marginLeft: "5px" }}>
            <label><CircleButton as="span" title="Broadcast a Video File from your computer"><FaFolderOpen /><input type="file" hidden accept="video/*" onChange={handleLocalFile} /></CircleButton></label>
            <CircleButton 
                $active={isRecording} 
                onClick={toggleRecording} 
                title={isRecording ? "Stop and Save Recording" : "Start Recording this Session"}
                style={{ background: isRecording ? "#ff4757" : "transparent", borderColor: isRecording ? "#ff4757" : "rgba(255,71,87,0.3)" }}
            >
                <FaRecordVinyl color={isRecording ? "white" : "#ff4757"} />
            </CircleButton>
        </div>
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", margin: "0 5px", flexShrink: 0 }} />
        {["❤️", "👏", "😂"].map(e => <CircleButton key={e} onClick={() => sendReaction(e)} title={`Send ${e} reaction`} style={{ background: "transparent", border: "none" }}>{e}</CircleButton>)}
      </ControlBar>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes floatUp { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-700px) scale(2.5); opacity: 0; } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(255, 71, 87, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); } }
        .live-pulse { animation: pulse 2s infinite; }
        video { -webkit-user-select: none; -webkit-touch-callout: none; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </MeetingOverlay>
  );
}
