import React from "react";
import { ThemeManagerProvider } from "./context/ThemeContext";
import { GlobalStyle } from "./globalStyles";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import ChatRoom from "./components/Chat";
import VideoCall from "./components/VideoCall";
import LiveStream from "./components/LiveStream";
import ThemeSwitcher from "./components/ThemeSwitcher";

const App = () => {
  console.log("ChatRoom:", typeof ChatRoom);
  console.log("VideoCall:", typeof VideoCall);
  console.log("LiveStream:", typeof LiveStream);
  console.log("ThemeSwitcher:", typeof ThemeSwitcher);
  console.log("ThemeManagerProvider:", typeof ThemeManagerProvider);
  console.log("GlobalStyle:", typeof GlobalStyle);
  console.log("Router:", typeof Router);
  console.log("Routes:", typeof Routes);
  console.log("Route:", typeof Route);
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
