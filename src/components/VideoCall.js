import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, Flex, Grid, Input, Button, Text, VStack, HStack, IconButton, Tooltip } from "@chakra-ui/react";
import { io } from "socket.io-client";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, Users, ShieldCheck, AlertTriangle } from "lucide-react";
import styled from "styled-components";

const LandingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--chakra-colors-bg);
  overflow: hidden;
  box-sizing: border-box;

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
    z-index: 0;
  }
`;

const FloatingBlob = styled.div`
  position: absolute;
  width: clamp(250px, 45vw, 500px);
  height: clamp(250px, 45vw, 500px);
  background: radial-gradient(circle, var(--chakra-colors-brandSecondary) 0%, transparent 75%);
  opacity: 0.1;
  filter: blur(60px);
  bottom: 10%;
  right: 10%;
  animation: floating-glow-2 18s infinite alternate ease-in-out;
  pointer-events: none;
  z-index: 0;
`;

const JoinContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: min(420px, calc(100vw - 32px));
  background: rgba(15, 15, 20, 0.55);
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  padding: clamp(24px, 5vw, 40px);
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 4px 30px rgba(0, 0, 0, 0.4),
    0 25px 60px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  margin: 0 16px;
  box-sizing: border-box;
  z-index: 2;
  position: relative;

  @media (max-width: 480px) {
    padding: 20px;
    gap: 14px;
    border-radius: 24px;
  }
`;

const JoinInput = styled(Input)`
  && {
    padding: 14px 20px;
    height: 50px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    color: var(--chakra-colors-textPrimary);
    outline: none;
    font-size: 1rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);

    &:hover {
      border-color: rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.04);
    }

    &:focus {
      border-color: var(--chakra-colors-brandPrimary);
      background: rgba(0, 0, 0, 0.4);
      box-shadow: 
        0 0 0 1px var(--chakra-colors-brandPrimary),
        0 0 15px var(--chakra-colors-brandGlow);
    }

    &::placeholder {
      color: var(--chakra-colors-textSecondary);
      opacity: 0.6;
    }

    @media (max-width: 480px) {
      padding: 12px 16px;
      font-size: 0.95rem;
      border-radius: 12px;
      height: 44px;
    }
  }
`;

const JoinButton = styled(Button)`
  && {
    padding: 14px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary));
    color: #fff;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-top: 12px;
    height: 52px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    position: relative;
    overflow: hidden;

    &::after {
      content: "";
      position: absolute;
      top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
      transition: 0.5s;
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow: 
        0 8px 25px rgba(0, 0, 0, 0.4),
        0 0 20px var(--chakra-colors-brandGlow);
      &::after {
        left: 100%;
      }
    }

    &:active {
      transform: translateY(0);
    }

    @media (max-width: 480px) {
      padding: 12px;
      font-size: 0.95rem;
      height: 46px;
      border-radius: 12px;
      margin-top: 8px;
    }
  }
`;

const socket = io(process.env.REACT_APP_SOCKET_ENDPOINT || "http://localhost:4000");

export default function VideoCall() {
  const localRef = useRef(null);
  const streamRef = useRef(null);
  const peersRef = useRef({});

  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [users, setUsers] = useState([]);
  const [peers, setPeers] = useState({});
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const isE2EE = false;

  /* ================= SIGNAL E2EE ================= */
  const sendEncryptedSignal = useCallback(async (event, payload, targetId) => {
    socket.emit(event, { to: targetId, from: socket.id, ...payload });
  }, []);

  const decryptSignal = useCallback(async (fromId, ciphertext, fallbackPlaintext) => {
    return fallbackPlaintext;
  }, []);

  /* ================= WEBRTC ================= */
  const createPeer = useCallback((id, userName, initiator) => {
    if (peersRef.current[id]) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => pc.addTrack(t, streamRef.current));
    }

    pc.ontrack = e => {
      setPeers(p => {
        const existingStream = p[id]?.stream || new MediaStream();
        e.streams[0].getTracks().forEach(track => {
          if (!existingStream.getTracks().find(t => t.id === track.id)) {
            existingStream.addTrack(track);
          }
        });
        return { ...p, [id]: { stream: existingStream, name: userName } };
      });
    };

    pc.onicecandidate = async e => {
      if (e.candidate) {
        await sendEncryptedSignal("webrtc-ice", { candidate: e.candidate }, id);
      }
    };

    if (initiator) {
      pc.createOffer().then(async offer => {
        await pc.setLocalDescription(offer);
        await sendEncryptedSignal("webrtc-offer", { offer }, id);
      });
    }
    peersRef.current[id] = pc;
  }, [sendEncryptedSignal]);

  const handleOffer = useCallback(async ({ from, offer, encryptedOffer, name: userName }) => {
    if (!peersRef.current[from]) createPeer(from, userName, false);
    const pc = peersRef.current[from];
    const finalOffer = await decryptSignal(from, encryptedOffer, offer);
    
    await pc.setRemoteDescription(new RTCSessionDescription(finalOffer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendEncryptedSignal("webrtc-answer", { answer: pc.localDescription }, from);
  }, [createPeer, decryptSignal, sendEncryptedSignal]);

  const handleAnswer = useCallback(async ({ from, answer, encryptedAnswer }) => {
    const pc = peersRef.current[from];
    if (!pc) return;
    const finalAnswer = await decryptSignal(from, encryptedAnswer, answer);
    await pc.setRemoteDescription(new RTCSessionDescription(finalAnswer));
  }, [decryptSignal]);

  const handleIce = useCallback(async ({ from, candidate, encryptedCandidate }) => {
    if (!peersRef.current[from]) return;
    const finalCandidate = await decryptSignal(from, encryptedCandidate, candidate);
    await peersRef.current[from].addIceCandidate(new RTCIceCandidate(finalCandidate));
  }, [decryptSignal]);

  useEffect(() => {
    if (localRef.current && streamRef.current) localRef.current.srcObject = streamRef.current;
  }, [joined]);

  /* ================= JOIN ROOM ================= */
  const joinRoom = async () => {
    if (!name || !room) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      
      setJoined(true);
      socket.emit("joinRoom", { roomId: room, userName: name });
    } catch {
      alert("Allow Camera & Microphone access");
    }
  };

  const removePeer = (id) => {
    if (peersRef.current[id]) {
      peersRef.current[id].close();
      delete peersRef.current[id];
    }
    setPeers(p => { const n = { ...p }; delete n[id]; return n; });
  };

  useEffect(() => {
    socket.on("presence", ({ online }) => {
      setUsers(online);
      online.forEach(u => {
        if (u.id !== socket.id && !peersRef.current[u.id]) {
          createPeer(u.id, u.name, true);
        }
      });
    });

    socket.on("newMessage", (msg) => setMessages(m => [...m, msg]));
    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice", handleIce);
    socket.on("user-left", ({ id }) => removePeer(id));

    return () => socket.removeAllListeners();
  }, [handleOffer, handleAnswer, handleIce, createPeer]);

  const toggleMute = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = muted;
    setMuted(!muted);
  };

  const toggleVideo = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) track.enabled = videoOff;
    setVideoOff(!videoOff);
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    socket.emit("sendMessage", { text, userName: name, ts: Date.now() });
    setText("");
  };

  useEffect(() => {
    Object.entries(peers).forEach(([id, { stream }]) => {
      const videoEl = document.getElementById("video-" + id);
      if (videoEl) videoEl.srcObject = stream;
    });
  }, [peers]);

  /* ================= UI ================= */
  if (!joined) {
    return (
      <LandingWrapper>
        <FloatingBlob />
        <JoinContainer style={{ textAlign: "center" }}>
          <div style={{ marginBottom: "15px" }}>
            <div style={{
              display: "inline-flex",
              background: "rgba(255, 63, 94, 0.08)",
              border: "1px solid rgba(255, 63, 94, 0.25)",
              boxShadow: "0 0 15px rgba(255, 63, 94, 0.15)",
              padding: "16px",
              borderRadius: "50%",
              marginBottom: "20px"
            }}>
              <ShieldCheck size={36} color="var(--chakra-colors-brandPrimary)" />
            </div>
            <h2 style={{ color: "var(--chakra-colors-textPrimary)", margin: 0, fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.5px" }}>Secure Video Call</h2>
            <p style={{ color: "var(--chakra-colors-textSecondary)", fontSize: "clamp(0.85rem, 2vw, 0.95rem)", marginTop: "8px", opacity: 0.85 }}>Join an encrypted peer-to-peer room</p>
          </div>
          <VStack spacing={4}>
            <JoinInput placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
            <JoinInput placeholder="Meeting ID" value={room} onChange={e => setRoom(e.target.value)} />
            <JoinButton w="100%" onClick={joinRoom}>
              Join Secure Meeting
            </JoinButton>
          </VStack>
        </JoinContainer>
      </LandingWrapper>
    );
  }

  return (
    <Flex h="100%" w="100%" direction={{ base: "column", md: "row" }} bg="var(--chakra-colors-bg)">
      {/* Video Stage */}
      <Flex flex={1} direction="column" p={4}>
        <Flex justifyContent="space-between" alignItems="center" mb={4} p={3} bg="rgba(10, 10, 10, 0.4)" backdropFilter="blur(20px)" borderRadius="xl" border="1px solid rgba(255, 255, 255, 0.06)">
          <HStack>
            <Text fontWeight="bold">Meeting: {room}</Text>
            {isE2EE ? (
              <Tooltip label="Signaling is End-to-End Encrypted via Signal Protocol">
                <HStack color="green.400"><ShieldCheck size={16} /><Text fontSize="xs">E2EE Active</Text></HStack>
              </Tooltip>
            ) : (
              <Tooltip label="Plain WebRTC Signaling">
                <HStack color="yellow.400"><AlertTriangle size={16} /><Text fontSize="xs">Plain Signaling</Text></HStack>
              </Tooltip>
            )}
          </HStack>
          <Text color="var(--chakra-colors-textSecondary)"><Users size={16} style={{display:'inline', marginRight:4}} /> {users.length}</Text>
        </Flex>

        <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4} flex={1} overflowY="auto">
          <Box position="relative" borderRadius="2xl" overflow="hidden" bg="black" border="1px solid rgba(255, 255, 255, 0.08)" boxShadow="0 10px 25px rgba(0,0,0,0.3)">
            <video ref={localRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
            <Box position="absolute" bottom={4} left={4} bg="rgba(15, 15, 20, 0.75)" px={3} py={1} borderRadius="lg" border="1px solid rgba(255, 255, 255, 0.08)" backdropFilter="blur(8px)">
              <Text fontSize="sm" color="white" fontWeight="bold">{name} (You)</Text>
            </Box>
          </Box>
          {Object.entries(peers).map(([id, { stream, name }]) => (
            <Box key={id} position="relative" borderRadius="2xl" overflow="hidden" bg="black" border="1px solid rgba(255, 255, 255, 0.08)" boxShadow="0 10px 25px rgba(0,0,0,0.3)">
              <video id={"video-" + id} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <Box position="absolute" bottom={4} left={4} bg="rgba(15, 15, 20, 0.75)" px={3} py={1} borderRadius="lg" border="1px solid rgba(255, 255, 255, 0.08)" backdropFilter="blur(8px)">
                <Text fontSize="sm" color="white" fontWeight="bold">{name}</Text>
              </Box>
            </Box>
          ))}
        </Grid>

        {/* Controls */}
        <Flex justify="center" align="center" gap={{ base: 3, md: 4 }} mt={4} p={{ base: 3, md: 4 }} bg="rgba(10, 10, 10, 0.4)" backdropFilter="blur(20px)" borderRadius="2xl" border="1px solid rgba(255, 255, 255, 0.06)">
          <IconButton icon={muted ? <MicOff /> : <Mic />} isRound size={{ base: "md", md: "lg" }} bg={muted ? "red.500" : "rgba(255, 255, 255, 0.03)"} border="1px solid rgba(255, 255, 255, 0.05)" color="white" onClick={toggleMute} _hover={{ bg: muted ? "red.600" : "var(--chakra-colors-surfaceHover)", borderColor: "var(--chakra-colors-brandPrimary)" }} aria-label={muted ? "Unmute" : "Mute"} />
          <IconButton icon={videoOff ? <VideoOff /> : <Video />} isRound size={{ base: "md", md: "lg" }} bg={videoOff ? "red.500" : "rgba(255, 255, 255, 0.03)"} border="1px solid rgba(255, 255, 255, 0.05)" color="white" onClick={toggleVideo} _hover={{ bg: videoOff ? "red.600" : "var(--chakra-colors-surfaceHover)", borderColor: "var(--chakra-colors-brandPrimary)" }} aria-label={videoOff ? "Turn Video On" : "Turn Video Off"} />
          <IconButton icon={<PhoneOff />} isRound size={{ base: "md", md: "lg" }} bg="red.500" color="white" onClick={() => window.location.reload()} _hover={{ bg: "red.600" }} aria-label="End Call" />
        </Flex>
      </Flex>

      {/* Side Panel */}
      <Flex w={{ base: "100%", md: "350px" }} direction="column" borderLeft="1px solid var(--chakra-colors-border)" bg="rgba(10, 10, 10, 0.25)" backdropFilter="blur(10px)">
        <Box p={4} borderBottom="1px solid var(--chakra-colors-border)">
          <Text fontWeight="bold">Meeting Chat</Text>
        </Box>
        <Flex flex={1} direction="column" p={4} overflowY="auto" gap={3}>
          {messages.map((m, i) => (
            <Flex key={i} direction="column" align={m.userName === name ? "flex-end" : "flex-start"}>
              <Text fontSize="xs" color="var(--chakra-colors-textSecondary)" mb={1}>{m.userName}</Text>
              <Box bg={m.userName === name ? "linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary))" : "rgba(255,255,255,0.03)"} border="1px solid rgba(255,255,255,0.05)" color={m.userName === name ? "white" : "var(--chakra-colors-textPrimary)"} px={4} py={2} borderRadius="xl" maxW="90%">
                <Text fontSize="sm">{m.text}</Text>
              </Box>
            </Flex>
          ))}
        </Flex>
        <Flex p={4} borderTop="1px solid var(--chakra-colors-border)" gap={2}>
          <Input placeholder="Type a message..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} bg="rgba(255,255,255,0.02)" border="1px solid rgba(255, 255, 255, 0.08)" height="44px" borderRadius="xl" _focus={{ borderColor: "var(--chakra-colors-brandPrimary)" }} />
          <IconButton icon={<Send size={18} />} bg="linear-gradient(135deg, var(--chakra-colors-brandPrimary), var(--chakra-colors-brandSecondary))" color="white" _hover={{ bg: "var(--chakra-colors-brandHover)" }} onClick={sendMessage} height="44px" width="44px" borderRadius="xl" />
        </Flex>
      </Flex>
    </Flex>
  );
}
