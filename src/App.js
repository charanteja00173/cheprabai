import React from 'react';
import { ThemeProvider } from 'styled-components';
import { darkTheme } from './theme';
import { GlobalStyle } from './globalStyles';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
// import { FaSun, FaMoon } from 'react-icons/fa';
import ChatRoom from './components/Chat';
import styled from 'styled-components';
import VideoCall from './components/VideoCall';
import LiveStream from './components/LiveStream';

// const ThemeToggle = styled.button`
//   position: fixed;
//   top: 20px;
//   right: 20px;
//   background: transparent;
//   border: none;
//   color: ${({ theme }) => theme.primaryColor};
//   font-size: 1.8rem;
//   display: flex;
//   align-items: center;
//   justify-content: center;
//   padding: 5px;
//   border-radius: 50%;
//   transition: color 0.3s ease, transform 0.3s ease;
//   cursor: pointer;

//   &:hover {
//     transform: scale(1.1);
//   }
// `;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: ${({ theme }) => theme.background};
`;

const App = () => {
  // const [isDarkMode, setIsDarkMode] = useState(true);

  // const toggleTheme = () => {
  //   setIsDarkMode(!isDarkMode);
  // };

  return (
    <ThemeProvider theme={darkTheme}>
      <GlobalStyle />
      <AppContainer>
        {/* <ThemeToggle onClick={toggleTheme} aria-label="Toggle Theme" >
          {isDarkMode ? <FaSun /> : <FaMoon />}
        </ThemeToggle> */}
        <Router>
          <Routes>
            <Route path="/" element={<ChatRoom />} />
            <Route path="/call" element={<VideoCall />} />
            <Route path="/live-stream" element={<LiveStream />} />
          </Routes>
        </Router>
      </AppContainer>
    </ThemeProvider>
  );
};

export default App;
