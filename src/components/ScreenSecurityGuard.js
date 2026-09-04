import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function ScreenSecurityGuard({ children }) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [blackoutFlash, setBlackoutFlash] = useState(false);

  useEffect(() => {
    let flashTimer = null;
    let clipboardLockUntil = 0;

    // Brief full-blackout so anything captured mid-attempt shows black.
    const triggerBlackout = () => {
      setBlackoutFlash(true);
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => setBlackoutFlash(false), 900);
    };

    // Best-effort: poison the OS clipboard so a PrintScreen capture gets nothing useful.
    const poisonClipboard = () => {
      clipboardLockUntil = Date.now() + 4000;
      const poison = () => {
        try {
          navigator.clipboard?.writeText(
            "🔒 [CHEPRABAI] Protected content — screenshots are not allowed."
          );
        } catch (e) {}
      };
      poison();
      setTimeout(poison, 350);
    };

    const announceAttempt = (source) => {
      triggerBlackout();
      poisonClipboard();
      window.dispatchEvent(new CustomEvent("anonchat:screenshot-attempt", { detail: { source } }));
      toast.error("🔒 Screenshots & recording are disabled for security.", { toastId: "sec-shot" });
    };

    // 1. Block right-click context menu globally
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // 2. Intercept every key path a browser can actually see.
    //    NOTE: OS-level captures (Win+Shift+S, macOS system shortcuts, phone recorders)
    //    never reach the page — deterrence for those is handled by watermarks in-call.
    const handleKeyDown = (e) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // PrintScreen key (Windows / Linux) — also fires on some snip tools
      if (key === "printscreen" || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        announceAttempt("printscreen");
        return false;
      }

      // Mac screenshot combos that DO reach the page (browser must be focused)
      if (e.metaKey && e.shiftKey && (key === "3" || key === "4" || key === "5" || key === "6")) {
        e.preventDefault();
        e.stopPropagation();
        announceAttempt("mac-shortcut");
        return false;
      }

      // Snipping Tool / Edge web capture: Ctrl/Cmd + Shift + S
      if (isCmdOrCtrl && e.shiftKey && key === "s") {
        e.preventDefault();
        e.stopPropagation();
        announceAttempt("snip");
        return false;
      }

      // Print dialog: Ctrl/Cmd + P
      if (isCmdOrCtrl && key === "p") {
        e.preventDefault();
        e.stopPropagation();
        toast.error("🔒 Printing is disabled for security.", { toastId: "sec-print" });
        return false;
      }

      // Save page: Ctrl/Cmd + S
      if (isCmdOrCtrl && !e.shiftKey && key === "s") {
        e.preventDefault();
        e.stopPropagation();
        toast.error("🔒 Saving the page is disabled for security.", { toastId: "sec-save" });
        return false;
      }

      // DevTools: F12 / Cmd+Opt+I / Ctrl+Shift+I / Cmd+Opt+C / Ctrl+Shift+C
      const devtools =
        key === "f12" ||
        (isCmdOrCtrl && e.shiftKey && (key === "i" || key === "c" || key === "j")) ||
        (e.metaKey && e.altKey && (key === "i" || key === "c" || key === "j"));
      if (devtools) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      return undefined;
    };

    // While the clipboard lock is active, keep re-poisoning so delayed pastes get junk
    const clipboardGuard = setInterval(() => {
      if (Date.now() < clipboardLockUntil) {
        try {
          navigator.clipboard?.writeText("🔒 [CHEPRABAI] Protected content.");
        } catch (err) {}
      }
    }, 500);

    // 3. Auto-blackout when the window loses focus or is hidden
    const handleBlur = () => {
      if (window.__anonchatScreenSharing) return;
      setIsBlurred(true);
    };
    const handleFocus = () => setIsBlurred(false);
    const handleVisibilityChange = () => {
      if (document.hidden && !window.__anonchatScreenSharing) setIsBlurred(true);
      else setIsBlurred(false);
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyDown, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Print blackout — printing the page produces a warning page instead of content
    const styleEl = document.createElement("style");
    styleEl.id = "anonchat-print-guard";
    styleEl.textContent = `
      @media print {
        .screen-protected-content { display: none !important; }
        body::after {
          content: "🔒 Printing this page is disabled.";
          display: flex; align-items: center; justify-content: center;
          height: 100vh; font-size: 28px; font-weight: 700;
        }
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyDown, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(clipboardGuard);
      if (flashTimer) clearTimeout(flashTimer);
      document.getElementById("anonchat-print-guard")?.remove();
    };
  }, []);

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%" }}>
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

      {/* Instant black frame on any capture attempt the page can see */}
      {blackoutFlash && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000000, background: "#000" }} />
      )}

      {/* Shield overlay while unfocused / hidden */}
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
            Screen content is hidden while the window is not focused to protect against unauthorized screenshots &amp; screen recording.
          </p>
        </div>
      )}
    </div>
  );
}
