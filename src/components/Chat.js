import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import styled from 'styled-components';
import { FaPaperPlane, FaVideo, FaPhoneAlt } from 'react-icons/fa';
import { CiStreamOn } from "react-icons/ci";
import { useMediaQuery } from 'react-responsive';
import image from '../logo192.png';
import { Link } from 'react-router-dom';
import notificationSound from '../assets/iphone-sms.mp3';

const socket = io('https://cheprabai-t7os4lzd.b4a.run/');

const SECURITY_CODE = ['@HelloWorld@'];

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0px;
  background: ${({ theme }) => theme.chatBackground};
  overflow: hidden;
  @media (max-width: 600px) {
    padding: 5px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  background: ${({ theme }) => theme.primaryColor};
  color: ${({ theme }) => theme.timestampColor};
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  position: relative;

  @media (max-width: 600px) {
    padding: 5px;
  }
`;

const Avatar = styled.img`
  border-radius: 50%;
  width: 2rem; 
  height: 2rem;
  margin-right: 10px;
`;

const RoomActions = styled.div`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 10px;
`;

const ActionButton = styled.button`
  background: ${({ theme }) => theme.primaryColor};
  border: none;
  border-radius: 50%;
  padding: 10px;
  color: ${({ theme }) => theme.secondaryColor};
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s, transform 0.2s;

  &:hover {
    background: ${({ theme }) => theme.primaryHoverColor};
    transform: scale(1.1);
  }
`;

const MessageContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: ${({ theme }) => theme.messageBackground};
  display: flex;
  flex-direction: column;

  @media (max-width: 600px) {
    padding: 10px;
  }
`;

const MessageBubble = styled.div`
  max-width: ${({ issystem }) => (issystem ? '100%' : '75%')};
  padding: 10px 15px;
  margin-bottom: 10px;
  border-radius: 12px;
  background: ${({ isSender, issystem, theme }) =>
    issystem ? '#f8d7da' : isSender ? theme.primaryHoverColor : theme.primaryColor};
  color: ${({ isSender, issystem }) =>
    issystem ? '#721c24' : isSender ? '#0b0c10' : '#ffffff'};
  align-self: ${({ isSender, issystem }) =>
    issystem ? 'center' : isSender ? 'flex-end' : 'flex-start'};
  position: relative;
  box-shadow: ${({ issystem, theme }) =>
    issystem ? '0px 0px 8px #f5c6cb' : `0px 0px 8px ${theme.primaryHoverColor}`};
  word-wrap: break-word;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.02);
  }
`;

const Timestamp = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.timestampColor};
  position: absolute;
  bottom: -18px;
  right: 12px;
`;

const MessageInputContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  border-top: 1px solid ${({ theme }) => theme.borderColor};
  background: ${({ theme }) => theme.chatBackground};

  @media (max-width: 600px) {
    padding: 5px;
  }
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 12px;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 20px;
  margin-right: 10px;
  font-size: 1rem;
  outline: none;
  background: ${({ theme }) => theme.primaryColor};
  color: ${({ theme }) => theme.secondaryColor};
  transition: border-color 0.3s, box-shadow 0.3s;

  @media (max-width: 600px) {
    padding: 8px;
    font-size: 0.9rem;
  }
`;

const FileInput = styled.input`
  display: none;
`;

// const FileUploadLabel = styled.label`
//   cursor: pointer;
//   margin-right: 10px;
//   color: ${({ theme }) => theme.primaryHoverColor};
//   font-size: 1.5rem;

//   &:hover {
//     color: ${({ theme }) => theme.primaryColor};
//   }
// `;

const SendButton = styled.button`
  padding: 12px;
  background: ${({ theme }) => theme.primaryHoverColor};
  color: #0b0c10;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.3s ease, transform 0.2s ease-in-out;

  &:hover {
    background: ${({ theme }) => theme.primaryHoverColor};
    transform: scale(1.1);
  }
`;

const JoinRoomContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: ${({ theme }) => theme.secondaryColor};
  padding: 20px;

  h2 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    text-transform: uppercase;
    color: ${({ theme }) => theme.primaryHoverColor};
    letter-spacing: 2px;

    @media (max-width: 600px) {
      font-size: 2rem;
    }
  }
`;

const GlowingInput = styled.input`
  width: 100%;
  max-width: 300px;
  padding: 12px;
  margin-bottom: 15px;
  border: 2px solid ${({ theme }) => theme.borderColor};
  border-radius: 25px;
  outline: none;
  font-size: 1rem;
  color: ${({ theme }) => theme.secondaryColor};
  background: ${({ theme }) => theme.primaryColor};
  transition: border-color 0.3s, box-shadow 0.3s;
  box-shadow: 0px 0px 8px ${({ theme }) => theme.borderColor};

  &:focus {
    border-color: ${({ theme }) => theme.primaryHoverColor};
    box-shadow: 0px 0px 12px ${({ theme }) => theme.primaryHoverColor};
  }

  @media (max-width: 600px) {
    max-width: 90%;
    padding: 10px;
    font-size: 0.9rem;
  }
`;

const JoinButton = styled.button`
  padding: 12px 25px;
  background: ${({ theme }) => theme.primaryHoverColor};
  color: #0b0c10;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  font-size: 1.1rem;
  text-transform: uppercase;
  transition: background 0.3s, transform 0.2s ease-in-out;
  box-shadow: 0px 0px 8px ${({ theme }) => theme.primaryHoverColor};

  &:hover {
    background: ${({ theme }) => theme.primaryHoverColor};
    transform: scale(1.05);
  }

  @media (max-width: 600px) {
    padding: 10px 20px;
    font-size: 1rem;
  }
`;

const ErrorMessage = styled.div`
  color: red;
  margin: 10px;
  font-size: 0.9rem;
`;

const ChatRoom = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  // const [users, setUsers] = useState([]);
  const [securityCode, setSecurityCode] = useState(''); 
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [joined, setJoined] = useState(false);
  const isSmall = useMediaQuery({ query: '(max-width: 768px)' });

  const audioRef = React.useRef(new Audio(notificationSound));

  useEffect(() => {
    if (joined) {
      socket.emit('joinRoom', { roomId, userName });

      const handleNewMessage = (msg) => {
        setMessages((prev) => [...prev, msg]);
        if (msg.userName !== userName) {
          audioRef.current.play().catch(err => console.error("Error playing sound:", err));
      }
      };

      const handleUserLeft = ({ userName }) => {
        // setUsers((prev) => prev.filter((user) => user !== userName));
        setMessages((prev) => [
          ...prev,
          { text: `${userName} left the room`, userName: 'System', timestamp: new Date().toLocaleTimeString() },
        ]);
      };

      socket.on('newMessage', handleNewMessage);
      socket.on('userJoined', ({ userName }) => {
        // setUsers((prev) => [...prev, userName]);
        setMessages((prev) => [
          ...prev,
          { text: `${userName} joined the room`, userName: 'System', timestamp: new Date().toLocaleTimeString() },
        ]);
      });
      socket.on('userLeft', handleUserLeft);
      socket.on('fileReceived', (fileData) => setMessages((prev) => [...prev, fileData]));

      return () => {
        socket.off('newMessage', handleNewMessage);
        socket.off('userJoined');
        socket.off('userLeft', handleUserLeft);
        socket.off('fileReceived');
      };
    }
  }, [roomId, userName, joined]);

  const handleJoinRoom = () => {
    if (!roomId.trim() || !userName.trim()) {
      setErrorMessage('Please enter both room number and your name.');
      return;
    }

    if (!SECURITY_CODE.includes(securityCode)) {
      setErrorMessage('Invalid security code. Please try again.');
      return;
    }

    setJoined(true);
    setErrorMessage('');
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      const msg = { text: message, userName, timestamp: new Date().toLocaleTimeString() };
      socket.emit('sendMessage', { roomId, msg });
      setMessage('');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && roomId && userName) {
      const reader = new FileReader();
      reader.onload = () => {
        const fileData = {
          text: `${userName} sent a file: ${file.name}`,
          file: reader.result,
          userName,
          timestamp: new Date().toLocaleTimeString(),
        };
        socket.emit('sendFile', { roomId, fileData });
      };
      reader.readAsDataURL(file);
    }
  };

  if (!joined) {
    return (
      <ChatContainer>
        <JoinRoomContainer>
          <h2>Join Chat Room</h2>
          <GlowingInput
            placeholder="Enter Room Number"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <GlowingInput
            placeholder="Enter Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
            <GlowingInput
            placeholder="Enter Security Code" 
            value={securityCode}
            onChange={(e) => setSecurityCode(e.target.value)}
          />
          {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
          <JoinButton onClick={handleJoinRoom}>Join</JoinButton>
        </JoinRoomContainer>
      </ChatContainer>
    );
  }

  const actionItems = [
    { icon: <FaVideo />, path: '/call' },
    { icon: <FaPhoneAlt />, path: '/call' },
    { icon: <CiStreamOn />, path: '/live-stream' },
  ];


//   const renderMessage = (msg = {}) => {
//     const { file = {}, text = "Text Message", userName, isSender, timestamp } = msg;
//     const { url, name, type } = file;

//     const urls = {
//         image: 'https://cdn.prod.website-files.com/62d84e447b4f9e7263d31e94/6399a4d27711a5ad2c9bf5cd_ben-sweet-2LowviVHZ-E-unsplash-1.jpeg',
//         video: 'https://cdn.artstation.com/p/video_sources/002/148/208/bullrun01-b.mp4',
//         audio: 'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3',
//         pdf: 'https://ia904501.us.archive.org/4/items/rich-dad-poor-dad_202106/Rich%20Dad%20Poor%20Dad.pdf',
//         ppt: '',
//         gif: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWRibGFwd3lrZjNhdmEzMjJqdTV0MmR2OGh0emhtbm5lN3RweG5wciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hoYYHtlt1EIVMJkE5t/giphy.gif',
//     };

//     const bubbleStyle = {
//         display: 'flex',
//         flexDirection: 'column',
//         alignItems: isSender ? 'flex-end' : 'flex-start',
//         // margin: '10px 0',
//     };

//     const messageBubbleStyle = {
//         backgroundColor: isSender ? '#e1ffc7' : '#f1f1f1',
//         borderRadius: '15px',
//         padding: '15px 20px',
//         maxWidth: '75%',
//         position: 'relative',
//         boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
//         border: `1px solid ${isSender ? '#e1ffc7' : '#d1d1d1'}`,
//         transition: 'transform 0.2s, box-shadow 0.2s',
//     };

//     const messageTextStyle = {
//         margin: 0,
//         color: '#333',
//         fontSize: '15px',
//         lineHeight: '1.5',
//         wordWrap: 'break-word',
//         fontFamily: '"Helvetica Neue", Arial, sans-serif',
//     };

//     const mediaStyle = {
//         maxWidth: '100%',
//         borderRadius: '8px',
//         margin: '5px 0',
//         transition: 'transform 0.2s',
//     };

//     const timestampStyle = {
//         fontSize: '12px',
//         color: '#999',
//         marginTop: '5px',
//         alignSelf: isSender ? 'flex-end' : 'flex-start',
//         fontStyle: 'italic',
//     };

//     return (
//         <div style={bubbleStyle}>
//             <div
//                 style={messageBubbleStyle}
//                 onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)'}
//                 onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)'}
//             >
//                 <p style={messageTextStyle}>{text}</p>
//                     <>
//                         <img src={urls.image} alt={name || "Image"} style={mediaStyle} />
//                         <video controls src={urls.video} style={mediaStyle}>Your browser does not support the video tag.</video>
//                         <audio controls src={urls.audio} style={{ width: '100%', margin: '5px 0' }}>Your browser does not support the audio element.</audio>
//                         <iframe src={urls.pdf} style={{ width: '100%', height: '300px', borderRadius: '8px', margin: '5px 0' }} title={name || "PDF Document"}></iframe>
//                         <iframe src={urls.ppt} style={{ width: '100%', height: '300px', borderRadius: '8px', margin: '5px 0' }} title={name || "PowerPoint Presentation"}></iframe>
//                         <img src={urls.gif} alt={name || "GIF"} style={mediaStyle} />
//                         <a
//                             href={url}
//                             target="_blank"
//                             rel="noopener noreferrer"
//                             download={name || "Download File"}
//                             style={{ display: 'block', marginTop: '5px', color: '#007bff', textDecoration: 'underline', fontWeight: 'bold', fontSize: '14px' }}
//                         >
//                             {name || "Download File"}
//                         </a>
//                     </>
//             </div>
//             <span style={timestampStyle}>
//                 {timestamp}
//             </span>
//         </div>
//     );
// };


  
  return (
    <ChatContainer>
      <Header>
        <Avatar src={image}/>
        <span>Room: {roomId}</span>
        <RoomActions>
          {actionItems.map((item, index) => (
            <Link key={index} to={item.path}>
              <ActionButton>{item.icon}</ActionButton>
            </Link>
          ))}
        </RoomActions>
      </Header>
      <MessageContainer>
        {messages.map((msg, index) => (
          <MessageBubble
          key={index}
          isSender={msg.userName === userName}
          issystem={msg.userName === 'System'}
          style={{margin:isSmall? '3.5% 0%': '1% 0%'}}
        >
            {msg.userName === 'System' ? (
              <>
                {msg.text}
                <Timestamp>{msg.timestamp}</Timestamp>
              </>
            ) : (
              <>
                {msg.file ? (
                  <>
                    <strong>{msg.userName} uploaded:</strong>
                    <br />
                    <a href={msg.file.url} target="_blank" rel="noopener noreferrer">
                      {msg.file.name}
                    </a>
                    <Timestamp>{msg.timestamp}</Timestamp>
                  </>
                ) : (
                  <>
                    <strong>{msg.userName}:</strong> {msg.text}
                    <Timestamp>{msg.timestamp}</Timestamp>
                  </>
                )}
              </>
            )}
          </MessageBubble>
        ))}
      </MessageContainer>
      <MessageInputContainer>
        {/* <FileUploadLabel htmlFor="file-input">
          <FaFileUpload />
        </FileUploadLabel> */}
        <FileInput id="file-input" type="file" onChange={handleFileUpload} />
        <MessageInput
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <SendButton onClick={handleSendMessage}><FaPaperPlane /></SendButton>
      </MessageInputContainer>
    </ChatContainer>
  );
};

export default ChatRoom;
