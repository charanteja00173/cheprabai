import React from "react";
import { ThemeManagerProvider } from "./context/ThemeContext";
import { GlobalStyle } from "./globalStyles";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import ChatRoom from "./components/Chat";
import VideoCall from "./components/VideoCall";
import LiveStream from "./components/LiveStream";
import ThemeSwitcher from "./components/ThemeSwitcher";

const App = () => {
  return (
    <ThemeManagerProvider>
      <GlobalStyle />
      <ThemeSwitcher />
      <Router>
        <Routes>
          <Route path="/" element={<ChatRoom />} />
          <Route path="/call" element={<VideoCall />} />
          <Route path="/live-stream" element={<LiveStream />} />
        </Routes>
      </Router>
    </ThemeManagerProvider>
  );
};

export default App;
