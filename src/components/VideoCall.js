// File: src/App.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import styled from "styled-components";
import { io } from "socket.io-client";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPaperPlane,
  FaUsers,
  FaPhoneSlash,
} from "react-icons/fa";

/* ================= SOCKET ================= */
const socket = io(process.env.REACT_APP_SOCKET_ENDPOINT || "http://localhost:4000");

/* ================= STYLES ================= */
const App = styled.div`height:100vh; background:#020617; color:white; display:flex;`;
const Lobby = styled.div`margin:auto; padding:30px; border-radius:12px; width:350px; text-align:center; background:#020617;`;
const Input = styled.input`width:100%; padding:12px; margin:10px 0; border-radius:8px; border:none;`;
const Button = styled.button`width:100%; padding:12px; background:#38bdf8; border:none; border-radius:8px; cursor:pointer;`;
const Layout = styled.div`flex:1; display:grid; grid-template-columns:220px 1fr 280px;`;
const Panel = styled.div`border-right:1px solid #111; display:flex; flex-direction:column;`;
const Stage = styled.div`flex:1; display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; padding:12px;`;
const VideoCard = styled.div`background:black; border-radius:12px; overflow:hidden; position:relative;`;
const Video = styled.video`width:100%; height:100%; object-fit:cover;`;
const NameTag = styled.div`position:absolute; bottom:8px; left:8px; color:#38bdf8; font-weight:bold; text-shadow:1px 1px 4px black;`;
const Footer = styled.div`height:80px; display:flex; justify-content:center; align-items:center; gap:14px; border-top:1px solid #111;`;
const Btn = styled.button`width:48px; height:48px; border-radius:50%; border:none; background:${({danger})=>danger?"#ef4444":"#38bdf8"}; cursor:pointer;`;
const ChatList = styled.div`flex:1; padding:10px; overflow-y:auto;`;
const ChatBox = styled.div`height:60px; display:flex; gap:8px; padding:8px;`;
const ChatInput = styled.input`flex:1; border-radius:6px; border:none; padding:8px;`;

/* ================= APP ================= */
export default function AppMain() {
  const localRef = useRef(null);
  const streamRef = useRef(null);
  const peersRef = useRef({}); // { socketId: RTCPeerConnection }

  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");

  const [users, setUsers] = useState([]); // online users
  const [peers, setPeers] = useState({}); // { socketId: { stream, name } }
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

    const handleOffer = useCallback(async ({ from, offer, name: userName }) => {
    if(!peersRef.current[from]) createPeer(from, userName, false);
    const pc = peersRef.current[from];
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("webrtc-answer", { to: from, answer: pc.localDescription });
  }, [createPeer]);

  const handleAnswer = useCallback(async ({ from, answer }) => {
    const pc = peersRef.current[from];
    if(!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleIce = useCallback(async ({ from, candidate }) => {
    if(!peersRef.current[from]) return;
    await peersRef.current[from].addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  /* ================= LOCAL VIDEO ================= */
  useEffect(() => {
    if (localRef.current && streamRef.current) localRef.current.srcObject = streamRef.current;
  }, []);

  /* ================= JOIN ROOM ================= */
  const joinRoom = async () => {
    if (!name || !room) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
      streamRef.current = stream;
      setJoined(true);
      socket.emit("joinRoom", { roomId: room, userName: name });
    } catch {
      alert("Allow Camera & Microphone access");
    }
  };

  /* ================= WEBRTC ================= */
  const createPeer = useCallback((id, userName, initiator) => {
    if (peersRef.current[id]) return;

    const pc = new RTCPeerConnection({ iceServers:[{ urls:"stun:stun.l.google.com:19302" }] });

    // add local tracks
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

    pc.onicecandidate = e => {
      if(e.candidate) socket.emit("webrtc-ice",{ to:id, candidate:e.candidate });
    };

    if (initiator) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", { to: id, offer, name });
      });
    }
    peersRef.current[id] = pc;
  }, [name]);

  const removePeer = (id) => {
    if (peersRef.current[id]) {
      peersRef.current[id].close();
      delete peersRef.current[id];
    }
    setPeers(p => { const n = { ...p }; delete n[id]; return n; });
  };

  /* ================= SOCKET ================= */
  useEffect(() => {
    socket.on("presence", ({ online }) => {
      setUsers(online);
      // create peers for all existing users except self
      online.forEach(u => {
        if(u.id !== socket.id && !peersRef.current[u.id]){
          createPeer(u.id, u.name, true); // initiator true for new peer
        }
      });
    });

    socket.on("newMessage", (msg)=>setMessages(m => [...m, msg]));

    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice", handleIce);

    socket.on("user-left", ({ id }) => removePeer(id));

    return () => socket.removeAllListeners();
  }, [handleOffer, handleAnswer, handleIce, createPeer]);
  /* ================= CONTROLS ================= */
  const toggleMute = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if(track) track.enabled = muted;
    setMuted(!muted);
  };

  const toggleVideo = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if(track) track.enabled = videoOff;
    setVideoOff(!videoOff);
  };

  /* ================= CHAT ================= */
  const sendMessage = () => {
    if(!text.trim()) return;
    socket.emit("sendMessage",{ text, userName:name, ts:Date.now() });
    setText("");
  };

  useEffect(() => {
  Object.entries(peers).forEach(([id, { stream }]) => {
    const videoEl = document.getElementById("video-" + id);
    if (videoEl) videoEl.srcObject = stream;
  });
}, [peers]);


  /* ================= UI ================= */
  if(!joined) return (
    <App>
      <Lobby>
        <h2>Join Meeting</h2>
        <Input placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/>
        <Input placeholder="Room" value={room} onChange={e=>setRoom(e.target.value)}/>
        <Button onClick={joinRoom}>Join</Button>
      </Lobby>
    </App>
  );

  return (
    <App>
      <Layout>
        {/* USERS */}
        <Panel>
          <h4 style={{padding:10}}><FaUsers/> Users</h4>
          <ChatList>
            <div>🟢 You ({name})</div>
            {users.map(u => u.id!==socket.id && <div key={u.id}>🟢 {u.name}</div>)}
          </ChatList>
        </Panel>

        {/* VIDEO */}
        <Panel style={{borderRight:"none"}}>
          <Stage>
            <VideoCard>
              <Video ref={localRef} autoPlay muted playsInline/>
              <NameTag>{name} (You)</NameTag>
            </VideoCard>

            {Object.entries(peers).map(([id,{stream,name}])=>(
              <VideoCard key={id}>
                <Video id={"video-" + id} autoPlay playsInline />
                <NameTag>{name}</NameTag>
              </VideoCard>
            ))}
          </Stage>

          <Footer>
            <Btn onClick={toggleMute}>{muted?<FaMicrophoneSlash/>:<FaMicrophone/>}</Btn>
            <Btn onClick={toggleVideo}>{videoOff?<FaVideoSlash/>:<FaVideo/>}</Btn>
            <Btn danger onClick={()=>window.location.reload()}><FaPhoneSlash/></Btn>
          </Footer>
        </Panel>

        {/* CHAT */}
        <Panel>
          <h4 style={{padding:10}}>Chat</h4>
          <ChatList>
            {messages.map((m,i)=><div key={i}><b>{m.userName}:</b> {m.text}</div>)}
          </ChatList>
          <ChatBox>
            <ChatInput value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendMessage()}/>
            <Btn onClick={sendMessage}><FaPaperPlane/></Btn>
          </ChatBox>
        </Panel>
      </Layout>
    </App>
  );
}
