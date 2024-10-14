import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaPhoneAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { CiStreamOn } from 'react-icons/ci';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const VideoContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #000;
`;

const Header = styled.div`
  padding: 15px;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const HeaderLink = styled(Link)`
  color: white;
  text-decoration: none; /* Remove underline */
  display: flex;
  align-items: center;

  &:hover {
    text-decoration: none; /* Ensure no underline on hover */
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;

  & > img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 10px;
    border: 2px solid rgba(255, 255, 255, 0.5);
  }
`;

const VideoWrapper = styled.div`
  display: flex;
  flex: 1;
  position: relative;
`;

const RemoteVideo = styled.video`
  flex: 1;
  background: black;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
`;

const LocalVideo = styled.video`
  position: absolute;
  width: 150px;
  height: 150px;
  bottom: 20px;
  right: 20px;
  border-radius: 10px;
  border: 2px solid white;
`;

const VideoOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  cursor: pointer;
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  padding: 15px;
  background: rgba(0, 0, 0, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const ControlButton = styled.button`
  background: none;
  color: white;
  border: none;
  padding: 10px;
  cursor: pointer;
  font-size: 1.5rem;
  transition: transform 0.2s, color 0.2s;

  &:hover {
    transform: scale(1.1);
    color: #34b7f1;
  }
`;

const Toast = styled.div`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  animation: ${fadeIn} 0.5s ease-out forwards;
  opacity: 0;
  transition: opacity 0.5s ease-out;

  &.show {
    opacity: 1;
  }
`;

const VideoCall = ({
  user = { name: "Ram", img: "https://i.pravatar.cc/150?img=1" },
  remoteUser = { name: "Alex", img: "https://i.pravatar.cc/150?img=2" }
}) => {
  const [toastMessage, setToastMessage] = useState('');
  const [mute, setMute] = useState(false);
  const [normalCall, setNormalCall] = useState(false);
  const [showingRemote, setShowingRemote] = useState(true);

  const handleButtonClick = (action) => {
    setToastMessage(action);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const toggleVideoView = () => {
    setShowingRemote(!showingRemote);
  };

  return (
    <VideoContainer>
      <Header>
        <HeaderLink
          onClick={() => handleButtonClick('Live Stream!')}
          to='/live-stream'
        >
          <CiStreamOn size={20} style={{ marginRight: '5%' }} color="#ffcc00" />
          Live Stream
        </HeaderLink>
        <UserInfo>
          {normalCall ? (
            <>
              <FaPhoneAlt style={{ marginRight: '10px' }} /> Normal Call
            </>
          ) : (
            <>
              <FaVideo style={{ marginRight: '10px' }} /> Video Call
            </>
          )}
        </UserInfo>
        <HeaderLink
          onClick={() => handleButtonClick('Call Ended!')}
          to='/'
          style={{ color: '#ff4d4f' }}
        >
          End Call
        </HeaderLink>
      </Header>
      <VideoWrapper style={{ height: '75%' }}>
        {showingRemote ? (
          <>
            <RemoteVideo autoPlay playsInline />
            <VideoOverlay onClick={toggleVideoView}>
              <UserInfo>
                <img src={remoteUser.img} alt={remoteUser.name} />
                <span>{remoteUser.name}</span>
              </UserInfo>
            </VideoOverlay>
            <LocalVideo autoPlay playsInline />
            <VideoOverlay style={{ justifyContent: 'flex-end', alignItems: 'flex-end', bottom: '75px', right: '50px' }} onClick={toggleVideoView}>
              <UserInfo>
                <img src={user.img} alt={user.name} />
                <span>{user.name}</span>
              </UserInfo>
            </VideoOverlay>
          </>
        ) : (
          <>
            <LocalVideo autoPlay playsInline />
            <VideoOverlay onClick={toggleVideoView}>
              <UserInfo>
                <img src={user.img} alt={user.name} />
                <span>{user.name}</span>
              </UserInfo>
            </VideoOverlay>
            <RemoteVideo autoPlay playsInline style={{ flex: 1 }} />
            <VideoOverlay style={{ justifyContent: 'flex-end', alignItems: 'flex-end', bottom: '75px', right: '50px' }} onClick={toggleVideoView}>
              <UserInfo>
                <img src={remoteUser.img} alt={remoteUser.name} />
                <span>{remoteUser.name}</span>
              </UserInfo>
            </VideoOverlay>
          </>
        )}
      </VideoWrapper>
      <Controls>
        <ControlButton title={mute ? "Unmute" : "Mute"} onClick={() => {
          setMute(!mute);
          handleButtonClick(mute ? 'Unmuted' : 'Muted');
        }}>
          {mute ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </ControlButton>
        <ControlButton title={normalCall ? "Video Call" : "Normal Call"} onClick={() => {
          setNormalCall(!normalCall);
          handleButtonClick(normalCall ? 'shifted to video call' : 'shifted to normal call');
        }}>
          {normalCall ? <FaVideo /> : <FaPhoneAlt />}
        </ControlButton>
      </Controls>
      {toastMessage && <Toast className={toastMessage ? 'show' : ''}>{toastMessage}</Toast>}
    </VideoContainer>
  );
};

export default VideoCall;