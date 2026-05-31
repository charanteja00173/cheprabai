import React, { Suspense } from "react";
import { ThemeManagerProvider } from "./context/ThemeContext";
import { GlobalStyle } from "./globalStyles";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import ChatRoom from "./components/Chat";
import UnifiedWorkspace from "./components/UnifiedWorkspace";

// Lazy-load heavy route components to reduce initial bundle size
const VideoCall = React.lazy(() => import("./components/VideoCall"));
const LiveStream = React.lazy(() => import("./components/LiveStream"));

const LazyFallback = () => (
  <div style={{
    display: "flex", justifyContent: "center", alignItems: "center",
    height: "100vh", background: "var(--chakra-colors-bg, #0a0a0a)",
    color: "var(--chakra-colors-textPrimary, #fff)", fontSize: "1.1rem",
    fontFamily: "system-ui, sans-serif"
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 24, height: 24, border: "3px solid rgba(255,255,255,0.2)",
        borderTop: "3px solid var(--chakra-colors-brandPrimary, #00BFA5)",
        borderRadius: "50%", animation: "spin 0.8s linear infinite"
      }} />
      Loading…
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const App = () => {

  return (
    <ThemeManagerProvider>
      <GlobalStyle />
      <Router>
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route element={<UnifiedWorkspace />}>
              <Route path="/" element={<ChatRoom />} />
              <Route path="/call" element={<VideoCall />} />
              <Route path="/live-stream" element={<LiveStream />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </ThemeManagerProvider>
  );
};

export default App;
