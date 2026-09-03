import React, { useCallback, useRef, useEffect } from "react";
import { Excalidraw, exportToBlob, exportToSvg, restoreElements, hashElementsVersion } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import styled from "styled-components";
import { FaTimes, FaExpand, FaCompress, FaTrash, FaPaintBrush, FaDownload } from "react-icons/fa";
import { toast } from "react-toastify";
import { BREAKPOINTS, useIsMobile } from "../hooks/useIsMobile";

/* Overlay: fixed full-screen modal unless embedded inside another surface. */
const Overlay = styled.div`
  position: ${(props) => (props.$embedded ? "absolute" : "fixed")};
  inset: 0;
  z-index: ${(props) => (props.$embedded ? "auto" : "9999")};
  background: ${(props) => (props.$embedded ? "transparent" : "rgba(0, 0, 0, 0.6)")};
  backdrop-filter: ${(props) => (props.$embedded ? "none" : "blur(8px)")};
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${(props) => (props.$isFullScreen && props.$isMobile ? "0" : props.$embedded ? "10px" : "40px")};
  box-sizing: border-box;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    padding: ${(props) => (props.$embedded ? "8px" : "0")};
    background: ${(props) => (props.$embedded ? "transparent" : "var(--chakra-colors-bg)")};
    backdrop-filter: none;
  }
`;

/* Container: centers the board and sizes it responsively. */
const WhiteboardContainer = styled.div`
  position: relative;
  width: ${(props) => (props.$embedded || (props.$isFullScreen && props.$isMobile)) ? "100%" : "90%"};
  max-width: ${(props) => (props.$embedded ? "none" : props.$isFullScreen && props.$isMobile ? "100%" : "1600px")};
  height: ${(props) => (props.$embedded ? "100%" : props.$isFullScreen && props.$isMobile ? "100dvh" : "85dvh")};
  background: var(--chakra-colors-surface);
  border-radius: ${(props) => (props.$embedded ? "14px" : props.$isFullScreen && props.$isMobile ? "0" : "clamp(12px, 2vw, 16px)")};
  box-shadow: ${(props) => (props.$embedded ? "0 18px 50px rgba(0,0,0,.45)" : props.$isFullScreen && props.$isMobile ? "none" : "var(--chakra-shadows-cardShadowHover)")};
  border: ${(props) => (props.$embedded ? "1px solid var(--chakra-colors-border)" : props.$isFullScreen && props.$isMobile ? "none" : "1px solid var(--chakra-colors-border)")};
  padding: ${(props) => (props.$isFullScreen && props.$isMobile ? "0" : "clamp(16px, 3vw, 24px)")};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: ${BREAKPOINTS.lg}px) {
    width: 100%;
    max-width: 100%;
    height: 100dvh;
    padding: clamp(8px, 2vw, 12px);
    border-radius: 0;
    border: none;
    box-shadow: none;
  }
`;

/* Canvas wrapper hosts the Excalidraw canvas. */
const CanvasWrapper = styled.div`
  width: 100%;
  min-height: 0;
  position: relative;
  border-radius: ${(props) => (props.$isFullScreen && props.$isMobile ? "0" : "clamp(8px, 1.5vw, 12px)")};
  overflow: hidden;
  border: ${(props) => (props.$isFullScreen && props.$isMobile ? "none" : "1px solid var(--chakra-colors-border)")};
  background: var(--chakra-colors-bg);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex: 1;
  box-sizing: border-box;

  .excalidraw {
    --color-primary: var(--chakra-colors-brand, #6366f1);
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    border-radius: 12px;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(12px, 2vw, 20px);
  padding: 0 clamp(4px, 1vw, 12px);
  position: relative;
  z-index: 100;
`;

const HeaderTitle = styled.h2`
  margin: 0;
  color: var(--chakra-colors-textPrimary);
  font-size: clamp(1rem, 2vw, 1.25rem);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: clamp(6px, 1vw, 10px);
  letter-spacing: 0.2px;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    .hide-mobile {
      display: none;
    }
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: clamp(6px, 1.5vw, 12px);
`;

const IconButton = styled.button`
  background: ${(props) => (props.$danger ? "var(--chakra-colors-dangerBg)" : "var(--chakra-colors-badgeBg)")};
  color: ${(props) => (props.$danger ? "var(--chakra-colors-danger)" : "var(--chakra-colors-textPrimary)")};
  border: 1px solid ${(props) => (props.$danger ? "var(--chakra-colors-dangerBorder)" : "var(--chakra-colors-border)")};
  width: clamp(36px, 4vw, 44px);
  height: clamp(36px, 4vw, 44px);
  border-radius: clamp(8px, 1.5vw, 12px);
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  position: relative;

  &::after {
    content: attr(title);
    position: absolute;
    bottom: -36px;
    left: 50%;
    transform: translateX(-50%) translateY(-5px);
    background: var(--chakra-colors-surface);
    color: var(--chakra-colors-textPrimary);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
    pointer-events: none;
    z-index: 10001;
    border: 1px solid var(--chakra-colors-border);
    box-shadow: var(--chakra-shadows-cardShadow);
  }

  &:hover::after {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }

  &:hover {
    background: ${(props) => (props.$danger ? "var(--chakra-colors-dangerHover)" : "var(--chakra-colors-surfaceHover)")};
    color: ${(props) => (props.$danger ? "var(--chakra-colors-onDanger)" : "var(--chakra-colors-textPrimary)")};
    transform: translateY(-2px);
  }

  @media (max-width: ${BREAKPOINTS.lg}px) {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    font-size: 0.95rem;
  }

  @media (max-width: ${BREAKPOINTS.xs}px) {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    font-size: 0.9rem;
  }
`;

/* Small inline export menu shared by the header and the fullscreen dock. */
function ExportMenu({ onPick }) {
  const optionStyle = {
    padding: "10px 16px",
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.2s",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        marginTop: 8,
        background: "rgba(20, 20, 20, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
        zIndex: 20000,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(10px)",
      }}
    >
      {["png", "svg"].map((fmt) => (
        <button
          key={fmt}
          onClick={() => onPick(fmt)}
          style={{ ...optionStyle, borderTop: fmt === "svg" ? "1px solid rgba(255,255,255,0.08)" : "none" }}
          onMouseEnter={(e) => { e.target.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={(e) => { e.target.style.background = "none"; }}
        >
          Export as {fmt.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* Trigger a browser download from a blob/string. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function Whiteboard({ socket, roomId, onClose, isAdmin, embedded = false }) {
  const apiRef = useRef(null);
  const isSyncing = useRef(false);
  const lastBroadcastHash = useRef("");
  const broadcastTimer = useRef(null);
  const filesRef = useRef({});
  const [isFullScreen, setIsFullScreen] = React.useState(false);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const isMobile = useIsMobile();

  /* ── Debounce + dedupe local edits, then broadcast the whole scene ── */
  const scheduleBroadcast = useCallback(
    (elements, appState, files) => {
      const hash = hashElementsVersion(elements);
      if (hash === lastBroadcastHash.current) return;
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
      broadcastTimer.current = setTimeout(() => {
        lastBroadcastHash.current = hash;
        filesRef.current = files || filesRef.current;
        socket.emit("excalidrawUpdate", {
          roomId,
          elements: restoreElements(elements, null),
          appState,
          files: filesRef.current || {},
        });
      }, 250);
    },
    [socket, roomId]
  );

  const handleChange = useCallback(
    (elements, appState, files) => {
      if (isSyncing.current) return;
      scheduleBroadcast(elements, appState, files);
    },
    [scheduleBroadcast]
  );

  /* ── Capture the imperative API on mount and request current state ── */
  const handleApiReady = useCallback(
    (api) => {
      apiRef.current = api;
      socket.emit("request-whiteboard-state", { roomId });
    },
    [socket, roomId]
  );

  /* ── Socket listeners: apply remote changes, answer state requests ── */
  useEffect(() => {
    const onRemoteUpdate = (payload) => {
      const api = apiRef.current;
      if (!api) return;
      // The backend relays `excalidrawUpdate` as either the whole payload
      // object ({ elements, appState, files }) or just the elements array.
      const elements = Array.isArray(payload) ? payload : payload?.elements;
      if (!elements) return;
      const hash = hashElementsVersion(elements);
      if (hash === lastBroadcastHash.current) return;
      const files = (payload && payload.files) ? payload.files : filesRef.current;
      isSyncing.current = true;
      try {
        api.updateScene({
          elements: restoreElements(elements, null),
          appState: (payload && payload.appState) || {},
          files,
          commitToHistory: false,
        });
      } catch {
        // Ignore mid-interaction race; the next event re-syncs.
      } finally {
        setTimeout(() => { isSyncing.current = false; }, 150);
      }
    };

    const handleRequestState = ({ requesterId }) => {
      const api = apiRef.current;
      if (!api) return;
      try {
        const elements = api.getSceneElements();
        socket.emit("send-whiteboard-state", {
          to: requesterId,
          elements: restoreElements(elements, null),
          appState: {},
          files: filesRef.current || {},
        });
      } catch {
        // Ignore.
      }
    };

    const onReconnect = () => {
      if (apiRef.current && socket.connected) {
        socket.emit("request-whiteboard-state", { roomId });
      }
    };

    socket.on("excalidrawUpdate", onRemoteUpdate);
    socket.on("request-whiteboard-state", handleRequestState);
    socket.on("connect", onReconnect);

    return () => {
      socket.off("excalidrawUpdate", onRemoteUpdate);
      socket.off("request-whiteboard-state", handleRequestState);
      socket.off("connect", onReconnect);
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
    };
  }, [socket, roomId]);

  /* ── Clear the board for everyone ── */
  const handleClearBoard = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    isSyncing.current = true;
    lastBroadcastHash.current = "";
    api.updateScene({ elements: [], commitToHistory: false });
    filesRef.current = {};
    socket.emit("excalidrawUpdate", {
      roomId,
      elements: [],
      appState: {},
      files: {},
    });
    setTimeout(() => { isSyncing.current = false; }, 150);
  }, [socket, roomId]);

  /* ── Export the visible board to PNG/SVG ── */
  const handleExport = useCallback(
    async (format) => {
      const api = apiRef.current;
      setShowExportMenu(false);
      if (!api) return;
      try {
        const elements = restoreElements(api.getSceneElements(), null);
        if (elements.length === 0) {
          toast.info("Whiteboard is empty.");
          return;
        }
        if (format === "svg") {
          const svg = await exportToSvg({
            elements,
            files: filesRef.current || null,
            appState: { exportBackground: true },
            exportPadding: 16,
          });
          const svgStr = new XMLSerializer().serializeToString(svg);
          downloadBlob(new Blob([svgStr], { type: "image/svg+xml" }), `whiteboard-${Date.now()}.svg`);
        } else {
          const blob = await exportToBlob({
            elements,
            files: filesRef.current || null,
            mimeType: "image/png",
            appState: { exportBackground: true, exportWithDarkMode: false, exportScale: 2 },
            exportPadding: 16,
          });
          downloadBlob(blob, `whiteboard-${Date.now()}.png`);
        }
        toast.success(`Exported as ${format.toUpperCase()}`);
      } catch {
        toast.error("Failed to export image.");
      }
    },
    []
  );

  const renderHeaderButtons = (floating) => (
    <div
      style={
        floating
          ? {
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10000,
              display: "flex",
              gap: "10px",
              background: "rgba(20, 20, 20, 0.8)",
              padding: "8px 12px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            }
          : { position: "relative", display: "flex", alignItems: "center", gap: "12px" }
      }
    >
      {isAdmin && (
        <IconButton onClick={handleClearBoard} title="Clear Board for Everyone">
          <FaTrash />
        </IconButton>
      )}
      <IconButton onClick={() => setShowExportMenu((prev) => !prev)} title="Export Board">
        <FaDownload />
      </IconButton>
      {showExportMenu && (
        <div
          style={
            floating
              ? { left: "50%", transform: "translateX(-50%)" }
              : { right: 0 }
          }
        >
          <ExportMenu onPick={handleExport} />
        </div>
      )}
      {floating ? (
        <IconButton onClick={() => setIsFullScreen(false)} title="Exit Fullscreen">
          <FaCompress />
        </IconButton>
      ) : (
        isMobile && (
          <IconButton onClick={() => setIsFullScreen(true)} title="Expand to Fullscreen">
            <FaExpand />
          </IconButton>
        )
      )}
      <IconButton $danger onClick={onClose} title="Close Whiteboard">
        <FaTimes />
      </IconButton>
    </div>
  );

  return (
    <Overlay $embedded={embedded} $isFullScreen={isFullScreen} $isMobile={isMobile} onClick={embedded ? undefined : onClose}>
      <WhiteboardContainer $embedded={embedded} $isFullScreen={isFullScreen} $isMobile={isMobile} onClick={(e) => e.stopPropagation()}>
        {!isFullScreen && (
          <ModalHeader>
            <HeaderTitle>
              <FaPaintBrush style={{ flexShrink: 0 }} /> <span className="hide-mobile">Collaborative</span> Whiteboard
            </HeaderTitle>
            <HeaderActions>{renderHeaderButtons(false)}</HeaderActions>
          </ModalHeader>
        )}

        {isFullScreen && renderHeaderButtons(true)}

        <CanvasWrapper $isFullScreen={isFullScreen} $isMobile={isMobile}>
          <Excalidraw
            excalidrawAPI={handleApiReady}
            onChange={handleChange}
            theme="dark"
            initialData={{ elements: [], appState: { viewBackgroundColor: "#15171c" } }}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                toggleTheme: false,
              },
            }}
          />
        </CanvasWrapper>
      </WhiteboardContainer>
    </Overlay>
  );
}
