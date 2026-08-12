import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Security code validation is handled server-side to support per-room passwords

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #121212;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 320px;
`;

const Input = styled.input`
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

const Button = styled.button`
  padding: 12px;
  border-radius: 25px;
  border: none;
  background: #00bfa5;
  color: #000;
  font-weight: bold;
  cursor: pointer;
`;

export default function Login() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!securityCode.trim()) {
      toast.error("Please enter a security code.");
      return;
    }

    // Pass roomId and userName via state
    navigate("/home", { state: { roomId, userName } });
  };

  return (
    <>
      <ToastContainer position="top-center" />
      <Container>
        <Card>
          <h2 style={{ color: "#fff", textAlign: "center" }}>Login</h2>
          <Input
            placeholder="Room"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <Input
            placeholder="Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <Input
            placeholder="Security Code"
            value={securityCode}
            onChange={(e) => setSecurityCode(e.target.value)}
          />
          <Button onClick={handleJoin}>Join</Button>
        </Card>
      </Container>
    </>
  );
}
