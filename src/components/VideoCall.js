import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, Flex, Grid, Input, Button, Text, VStack, HStack, IconButton, Tooltip } from "@chakra-ui/react";
import { io } from "socket.io-client";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, Users, ShieldCheck, AlertTriangle } from "lucide-react";

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
      <Flex h="100%" w="100%" alignItems="center" justifyContent="center" px={4}>
        <Box p={{ base: 6, md: 10 }} bg="var(--chakra-colors-glassBg)" backdropFilter="blur(24px)" borderRadius="3xl" border="1px solid var(--chakra-colors-border)" w={{ base: "100%", md: "400px" }} textAlign="center" boxShadow="0 25px 50px rgba(0,0,0,0.5)">
          <Box display="inline-flex" bg="rgba(0,191,165,0.1)" p={4} borderRadius="full" mb={4}>
            <ShieldCheck size={40} color="var(--chakra-colors-brandPrimary)" />
          </Box>
          <Text fontSize="2xl" fontWeight="bold" letterSpacing="-0.5px" mb={2}>Secure Video Call</Text>
          <Text color="var(--chakra-colors-textSecondary)" fontSize="sm" mb={6}>Join an encrypted peer-to-peer room</Text>
          <VStack spacing={4}>
            <Input placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} size="lg" borderRadius="xl" />
            <Input placeholder="Meeting ID" value={room} onChange={e => setRoom(e.target.value)} size="lg" borderRadius="xl" />
            <Button w="100%" size="lg" borderRadius="xl" bg="var(--chakra-colors-brandPrimary)" color="white" _hover={{ bg: "var(--chakra-colors-brandHover)", transform: "translateY(-2px)", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }} onClick={joinRoom} mt={2}>
              Join Secure Meeting
            </Button>
          </VStack>
        </Box>
      </Flex>
    );
  }

  return (
    <Flex h="100%" w="100%" direction={{ base: "column", md: "row" }} bg="var(--chakra-colors-bg)">
      {/* Video Stage */}
      <Flex flex={1} direction="column" p={4}>
        <Flex justifyContent="space-between" alignItems="center" mb={4} p={3} bg="var(--chakra-colors-surface)" borderRadius="xl" border="1px solid var(--chakra-colors-border)">
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
          <Box position="relative" borderRadius="xl" overflow="hidden" bg="black" border="1px solid var(--chakra-colors-border)">
            <video ref={localRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
            <Box position="absolute" bottom={4} left={4} bg="rgba(0,0,0,0.6)" px={3} py={1} borderRadius="md" backdropFilter="blur(4px)">
              <Text fontSize="sm" color="white" fontWeight="bold">{name} (You)</Text>
            </Box>
          </Box>
          {Object.entries(peers).map(([id, { stream, name }]) => (
            <Box key={id} position="relative" borderRadius="xl" overflow="hidden" bg="black" border="1px solid var(--chakra-colors-border)">
              <video id={"video-" + id} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <Box position="absolute" bottom={4} left={4} bg="rgba(0,0,0,0.6)" px={3} py={1} borderRadius="md" backdropFilter="blur(4px)">
                <Text fontSize="sm" color="white" fontWeight="bold">{name}</Text>
              </Box>
            </Box>
          ))}
        </Grid>

        {/* Controls */}
        <Flex justify="center" align="center" gap={{ base: 3, md: 4 }} mt={4} p={{ base: 2, md: 4 }} bg="var(--chakra-colors-surface)" borderRadius="xl" border="1px solid var(--chakra-colors-border)">
          <IconButton icon={muted ? <MicOff /> : <Mic />} isRound size={{ base: "md", md: "lg" }} bg={muted ? "red.500" : "var(--chakra-colors-surfaceHover)"} color="white" onClick={toggleMute} _hover={{ bg: muted ? "red.600" : "var(--chakra-colors-border)" }} aria-label={muted ? "Unmute" : "Mute"} />
          <IconButton icon={videoOff ? <VideoOff /> : <Video />} isRound size={{ base: "md", md: "lg" }} bg={videoOff ? "red.500" : "var(--chakra-colors-surfaceHover)"} color="white" onClick={toggleVideo} _hover={{ bg: videoOff ? "red.600" : "var(--chakra-colors-border)" }} aria-label={videoOff ? "Turn Video On" : "Turn Video Off"} />
          <IconButton icon={<PhoneOff />} isRound size={{ base: "md", md: "lg" }} bg="red.500" color="white" onClick={() => window.location.reload()} _hover={{ bg: "red.600" }} aria-label="End Call" />
        </Flex>
      </Flex>

      {/* Side Panel */}
      <Flex w={{ base: "100%", md: "350px" }} direction="column" borderLeft="1px solid var(--chakra-colors-border)" bg="var(--chakra-colors-surface)">
        <Box p={4} borderBottom="1px solid var(--chakra-colors-border)">
          <Text fontWeight="bold">Meeting Chat</Text>
        </Box>
        <Flex flex={1} direction="column" p={4} overflowY="auto" gap={3}>
          {messages.map((m, i) => (
            <Flex key={i} direction="column" align={m.userName === name ? "flex-end" : "flex-start"}>
              <Text fontSize="xs" color="var(--chakra-colors-textSecondary)" mb={1}>{m.userName}</Text>
              <Box bg={m.userName === name ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-surfaceHover)"} color={m.userName === name ? "white" : "var(--chakra-colors-textPrimary)"} px={4} py={2} borderRadius="xl" maxW="90%">
                <Text fontSize="sm">{m.text}</Text>
              </Box>
            </Flex>
          ))}
        </Flex>
        <Flex p={4} borderTop="1px solid var(--chakra-colors-border)" gap={2}>
          <Input placeholder="Type a message..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} bg="var(--chakra-colors-bg)" border="none" />
          <IconButton icon={<Send size={18} />} bg="var(--chakra-colors-brandPrimary)" color="white" _hover={{ bg: "var(--chakra-colors-brandHover)" }} onClick={sendMessage} />
        </Flex>
      </Flex>
    </Flex>
  );
}
