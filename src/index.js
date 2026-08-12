import "./devConsoleFilter";
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

if (process.env.NODE_ENV === "production") {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

// Disable right-click context menu
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Disable dev tools keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // F12
  if (e.key === "F12") {
    e.preventDefault();
    return false;
  }
  // Ctrl+Shift+I / Cmd+Option+I (Inspect)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "i") {
    e.preventDefault();
    return false;
  }
  // Ctrl+Shift+J / Cmd+Option+J (Console)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "j") {
    e.preventDefault();
    return false;
  }
  // Ctrl+Shift+C / Cmd+Option+C (Element picker)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") {
    e.preventDefault();
    return false;
  }
  // Ctrl+U / Cmd+U (View Source)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
    e.preventDefault();
    return false;
  }
});

// Disable drag-to-select text on entire page
document.addEventListener("selectstart", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  e.preventDefault();
});

/* ================= GLOBAL ERROR BOUNDARY ================= */
window.addEventListener("error", (e) => {
  console.error("Global error:", e.error || e.message, e.filename, e.lineno, e.colno, e.error);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled rejection:", e.reason);
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);
