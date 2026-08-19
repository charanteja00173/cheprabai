import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function ScreenSecurityGuard({ children }) {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    // 1. Prevent Right-Click Context Menu globally
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // 2. Intercept Key Combinations for Screenshots, Snipping, Printing & DevTools
    const handleKeyDown = (e) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // PrintScreen key (Windows / Linux)
      if (key === "printscreen" || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText("");
          }
        } catch (err) {}
        toast.error("🔒 Screenshots are disabled for security.", { toastId: "sec-ps" });
        return false;
      }

      // Mac Screenshot Shortcuts: Cmd + Shift + 3, Cmd + Shift + 4, Cmd + Shift + 5
      if (e.metaKey && isShift && (key === "3" || key === "4" || key === "5")) {
        e.preventDefault();
        e.stopPropagation();
        toast.error("🔒 Screenshots are disabled for security.", { toastId: "sec-mac" });
        return false;
      }

      // Windows Snipping Tool / Edge Screenshot: Ctrl + Shift + S / Cmd + Shift + S
      if (isCmdOrCtrl && isShift && key === "s") {
        e.preventDefault();
        e.stopPropagation();
        toast.error("🔒 Snipping tool is disabled for security.", { toastId: "sec-snip" });
        return false;
      }

      // Print shortcut: Ctrl + P / Cmd + P
      if (isCmdOrCtrl && key === "p") {
        e.preventDefault();
        e.stopPropagation();
        toast.error("🔒 Printing page is disabled for security.", { toastId: "sec-print" });
        return false;
      }

      // Save page shortcut: Ctrl + S / Cmd + S
      if (isCmdOrCtrl && key === "s" && !isShift) {
        e.preventDefault();
        e.stopPropagation();
        toast.error("🔒 Saving page is disabled for security.", { toastId: "sec-save" });
        return false;
      }

      // DevTools Inspection: F12 or Cmd+Alt+I / Ctrl+Shift+I
      if (key === "f12" || (isCmdOrCtrl && isShift && key === "i") || (e.metaKey && e.altKey && key === "i")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 3. Auto-blur/Blackout when window loses focus (protects against background screen recorders & OS app switcher)
    const handleBlur = () => {
      setIsBlurred(true);
    };

    const handleFocus = () => {
      setIsBlurred(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
      }
    };

    // Attach global listeners
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyDown, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyDown, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%" }}>
      {/* Content wrapper with CSS protection */}
      <div
        className="screen-protected-content"
        style={{
          filter: isBlurred ? "blur(40px) brightness(0.2)" : "none",
          transition: "filter 0.15s ease",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
        }}
      >
        {children}
      </div>

      {/* Security Overlay when window loses focus or recording is attempted */}
      {isBlurred && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "#06070c",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            color: "#ffffff",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
            }}
          >
            🔒
          </div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>
            Protected Content Shield
          </h2>
          <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.6, maxWidth: 360, lineHeight: 1.5 }}>
            Screen content is hidden while window is unfocused to protect against unauthorized screenshots & screen recording.
          </p>
        </div>
      )}
    </div>
  );
}
