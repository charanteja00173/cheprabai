import React from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const Container = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #121212;
  color: #fff;
`;

const CardsGrid = styled.div`
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
`;

const Card = styled.div`
  background: #1f1f1f;
  padding: 40px 60px;
  border-radius: 14px;
  text-align: center;
  font-size: 1.2rem;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;

  &:hover {
    transform: scale(1.05);
    background: #292929;
  }
`;

export default function Home() {
  const navigate = useNavigate();

  return (
    <Container>
      <h2>Welcome!</h2>
      <CardsGrid>
        <Card onClick={() => navigate("/chat")}>Chat Room</Card>
        <Card onClick={() => navigate("/call/123")}>Video Call</Card>
        <Card onClick={() => navigate("/live-stream")}>Live Stream</Card>
      </CardsGrid>
    </Container>
  );
}
