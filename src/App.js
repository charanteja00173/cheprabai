import React from "react";
import { ThemeManagerProvider } from "./context/ThemeContext";
import { GlobalStyle } from "./globalStyles";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import ChatRoom from "./components/Chat";
import AdminDashboard from "./components/AdminDashboard";

const App = () => {

  return (
    <ThemeManagerProvider>
      <GlobalStyle />
      <Router>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/" element={<ChatRoom />} />
          <Route path="*" element={<ChatRoom />} />
        </Routes>
      </Router>
    </ThemeManagerProvider>
  );
};

export default App;
