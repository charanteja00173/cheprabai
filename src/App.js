import React from "react";
import { ThemeManagerProvider } from "./context/ThemeContext";
import "./globalStyles.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import ChatRoom from "./components/Chat";
import AdminDashboard from "./components/AdminDashboard";
import ErrorBoundary from "./components/ErrorBoundary";
import ScreenSecurityGuard from "./components/ScreenSecurityGuard";

const App = () => {

  return (
    <ScreenSecurityGuard>
      <ThemeManagerProvider>
        <ErrorBoundary>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/room/:roomId" element={<ChatRoom />} />
              <Route path="/" element={<ChatRoom />} />
              <Route path="*" element={<ChatRoom />} />
            </Routes>
          </Router>
        </ErrorBoundary>
      </ThemeManagerProvider>
    </ScreenSecurityGuard>
  );
};

export default App;
