// App.js - Main Application Entry
import React, { useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { lightTheme, darkTheme } from './theme';
import { GlobalStyle } from './globalStyles';
import { FaSun, FaMoon } from 'react-icons/fa';
import ChatRoom from './components/Chat';
import styled from 'styled-components';

const ThemeToggle = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.primaryColor};
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  border-radius: 50%;
  transition: color 0.3s ease, transform 0.3s ease;
  cursor: pointer;

  &:hover {
    transform: scale(1.1);
  }
`;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: ${({ theme }) => theme.background};
`;

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <GlobalStyle />
      <AppContainer>
        <ThemeToggle onClick={toggleTheme} aria-label="Toggle Theme">
          {isDarkMode ? <FaSun /> : <FaMoon />}
        </ThemeToggle>
        <ChatRoom />
      </AppContainer>
    </ThemeProvider>
  );
};

export default App;
