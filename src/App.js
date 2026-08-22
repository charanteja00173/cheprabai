import React, { lazy, Suspense } from "react";
import { ThemeManagerProvider } from "./context/ThemeContext";
import "./globalStyles.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import ChatRoom from "./components/Chat";
import ErrorBoundary from "./components/ErrorBoundary";
import ScreenSecurityGuard from "./components/ScreenSecurityGuard";

/* Admin panel ships in its own chunk — main bundle stays lean for chat users */
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));

const App = () => {

  return (
    <ScreenSecurityGuard>
      <ThemeManagerProvider>
        <ErrorBoundary>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/room/:roomId" element={<ChatRoom />} />
                <Route path="/" element={<ChatRoom />} />
                <Route path="*" element={<ChatRoom />} />
              </Routes>
            </Suspense>
          </Router>
        </ErrorBoundary>
      </ThemeManagerProvider>
    </ScreenSecurityGuard>
  );
};

export default App;
