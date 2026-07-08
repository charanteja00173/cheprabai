import React from "react";
import { ThemeManagerProvider } from "./context/ThemeContext";
import { GlobalStyle } from "./globalStyles";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import ChatRoom from "./components/Chat";

const App = () => {

  return (
    <ThemeManagerProvider>
      <GlobalStyle />
      <Router>
        <Routes>
          <Route path="/" element={<ChatRoom />} />
          <Route path="*" element={<ChatRoom />} />
        </Routes>
      </Router>
    </ThemeManagerProvider>
  );
};

export default App;
