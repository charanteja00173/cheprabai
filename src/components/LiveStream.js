import React, { useState } from 'react';
import styled from 'styled-components';
import { FaMicrophone, FaMicrophoneSlash, FaTrashAlt } from 'react-icons/fa';
import { CiStreamOn } from 'react-icons/ci';
import { Link } from 'react-router-dom';

const colors = {
  background: '#0b0c1f',  // Dark blue background
  header: '#1f1f2c',      // Darker shade for header
  cardBackground: '#292b40', // Card background color
  cardHover: '#3b3f5c',   // Card hover color
  participantName: 'rgba(255, 255, 255, 0.85)', // Participant name color
  controlButtonBackground: 'rgba(255, 255, 255, 0.2)', // Control button background
  controlButtonHover: 'rgba(255, 255, 255, 0.3)', // Control button hover
  controlOverlay: 'rgba(0, 0, 0, 0.5)', // Control overlay background
};

const StreamContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${colors.background};
  color: white;
`;

const Header = styled.div`
  padding: 15px 20px;
  background-color: ${colors.header};
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.2rem;
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
`;

const HeaderLink = styled(Link)`
  color: white;
  text-decoration: none;
  display: flex;
  align-items: center;

  &:hover {
    text-decoration: none;
  }
`;

const HeaderIcon = styled(CiStreamOn)`
  margin-right: 8px;
  color: #ffcc00;
`;

const StreamGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 15px;
  background: #181818;
  border-radius: 10px;
  margin: 10px;
  padding: 10px;
  overflow-y: auto; /* Enable vertical scrolling */
`;

const VideoStream = styled.div`
  background: ${colors.cardBackground};
  border-radius: 10px;
  height: 250px; /* Fixed height for cards */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start; /* Align items to the top */
  color: #ccc;
  font-weight: bold;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden; /* Prevent overflow of child elements */
  transition: background 0.3s;

  &:hover {
    background: ${colors.cardHover}; /* Slightly lighter background on hover */
  }
`;

const ParticipantImage = styled.img`
  width: 100%;
  height: 100%; /* Fixed height for image */
  object-fit: cover; /* Maintain aspect ratio */
  border-radius: 10px 10px 0 0;
`;

const ParticipantName = styled.div`
  padding: 10px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 0 0 10px 10px;
  width: 100%;
  text-align: center;
  position: absolute;
  bottom: 0; /* Position name at the bottom of the card */
  color: ${colors.participantName};
`;

const ControlsOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0; /* Hidden by default */
  transition: opacity 0.3s;
  background: ${colors.controlOverlay}; /* Background for the controls */

  ${VideoStream}:hover & {
    opacity: 1; /* Show on hover */
  }
`;

const ControlButton = styled.button`
  background: ${colors.controlButtonBackground};
  color: white;
  border: none;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  margin: 5px;
  display: flex;
  align-items: center;

  &:hover {
    background: ${colors.controlButtonHover};
  }
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
  gap: 20px;
`;

const LiveStream = () => {
  const [participants, setParticipants] = useState([]);

  const addParticipant = () => {
    const newParticipantId = participants.length + 1;
    const newParticipant = {
      id: newParticipantId,
      name: `Participant ${newParticipantId}`,
      img: `https://i.pravatar.cc/150?img=${newParticipantId}`,
      isMuted: false,
    };
    setParticipants((prev) => [...prev, newParticipant]);
  };

  const removeParticipant = (id) => {
    setParticipants((prev) => prev.filter((participant) => participant.id !== id));
  };

  const toggleMute = (id) => {
    setParticipants((prev) =>
      prev.map((participant) =>
        participant.id === id ? { ...participant, isMuted: !participant.isMuted } : participant
      )
    );
  };

  return (
    <StreamContainer>
      <Header>
        <HeaderLink to='/call'>
          <span style={{ color: 'green', textTransform:'none' }}>Video Call</span>
        </HeaderLink>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <HeaderIcon size={24} /> Live Stream
        </span>
        <HeaderLink to='/' style={{ color: '#ff4d4f' }}>
          End Stream
        </HeaderLink>
      </Header>
      <StreamGrid>
        {participants.map((participant) => (
          <VideoStream key={participant.id}>
            <ParticipantImage src={participant.img} alt={participant.name} />
            <ParticipantName>{participant.name}</ParticipantName>
            <ControlsOverlay>
              <ControlButton onClick={() => toggleMute(participant.id)}>
                {participant.isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                {participant.isMuted ? 'Unmute' : 'Mute'}
              </ControlButton>
              <ControlButton onClick={() => removeParticipant(participant.id)}>
                <FaTrashAlt /> Delete
              </ControlButton>
            </ControlsOverlay>
          </VideoStream>
        ))}
      </StreamGrid>
      <Controls>
        <ControlButton onClick={addParticipant}>Add Participant</ControlButton>
      </Controls>
    </StreamContainer>
  );
};

export default LiveStream;
