import React from "react";
import { ThemeManagerProvider } from "./context/ThemeContext";
import { GlobalStyle } from "./globalStyles";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import ChatRoom from "./components/Chat";
import UnifiedWorkspace from "./components/UnifiedWorkspace";

const App = () => {

  return (
    <ThemeManagerProvider>
      <GlobalStyle />
      <Router>
        <Routes>
          <Route element={<UnifiedWorkspace />}>
            <Route path="/" element={<ChatRoom />} />
          </Route>
          <Route path="*" element={<ChatRoom />} />
        </Routes>
      </Router>
    </ThemeManagerProvider>
  );
};

export default App;
