import React, { useCallback, useRef, useEffect } from "react";
import { Tldraw } from "@tldraw/tldraw";
import styled from "styled-components";
import { FaTimes, FaExpand, FaCompress, FaTrash, FaPaintBrush, FaDownload } from "react-icons/fa";
import { toast } from "react-toastify";
import { BREAKPOINTS, useIsMobile } from "../hooks/useIsMobile";

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
  
  /* Override TLDraw variables to pull UI away from the extreme edges so it isn't clipped by rounded corners */
  --tl-padding: 8px;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    border-radius: 12px;
    --tl-padding: 4px;
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
  background: ${(props) => (props.$danger ? "rgba(255, 71, 87, 0.1)" : "var(--chakra-colors-badgeBg)")};
  color: ${(props) => (props.$danger ? "#ff4757" : "var(--chakra-colors-textPrimary)")};
  border: 1px solid ${(props) => (props.$danger ? "rgba(255, 71, 87, 0.25)" : "var(--chakra-colors-border)")};
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
    background: ${(props) => (props.$danger ? "#ff4757" : "var(--chakra-colors-surfaceHover)")};
    color: var(--chakra-colors-textPrimary);
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

export default function Whiteboard({ socket, roomId, onClose, isAdmin, embedded = false }) {
  const appRef = useRef(null);
  const isSyncing = useRef(false);
  const isInteracting = useRef(false);
  const [isFullScreen, setIsFullScreen] = React.useState(false);
  const isMobile = useIsMobile();
  const [showExportMenu, setShowExportMenu] = React.useState(false);

  /* ── Content-hash dedup: prevents the infinite echo loop ── */
  const lastEmittedHash = useRef("");

  /** Lightweight hash of a shapes record for dedup comparison. */
  const hashContent = useCallback((shapesMap) => {
    try {
      const ids = Object.keys(shapesMap).sort();
      // Include shape count + sorted IDs + a few mutable props per shape for fast comparison
      return ids.map(id => {
        const s = shapesMap[id];
        return `${id}:${s.point?.[0]|0},${s.point?.[1]|0}:${s.rotation|0}:${s.size?.[0]|0},${s.size?.[1]|0}`;
      }).join("|");
    } catch { return ""; }
  }, []);

  const handleExport = useCallback(async (format) => {
    if (!appRef.current) return;
    try {
      const shapeIds = appRef.current.shapes.map(s => s.id);
      if (shapeIds.length === 0) {
        toast.info("Whiteboard is empty.");
        return;
      }
      await appRef.current.exportImage(format, {
        ids: shapeIds,
        scale: 2
      });
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (e) {
      toast.error("Failed to export image.");
    }
    setShowExportMenu(false);
  }, []);

  const handleClearBoard = useCallback(() => {
    if (!appRef.current) return;
    const emptyState = { shapes: {}, bindings: {}, assets: {} };
    isSyncing.current = true;
    appRef.current.replacePageContent(emptyState.shapes, emptyState.bindings, emptyState.assets);
    isSyncing.current = false;
    lastEmittedHash.current = "";
    socket.emit("excalidrawUpdate", { roomId, elements: emptyState });
  }, [socket, roomId]);

  /* ── Single mount handler — stores the app ref (NO socket listener here) ── */
  const handleMount = useCallback(
    (app) => {
      appRef.current = app;
    },
    []
  );

  /* ── Request current whiteboard state on mount ── */
  useEffect(() => {
    socket.emit("request-whiteboard-state", { roomId });
  }, [socket, roomId]);

  /* ── Single socket listener registered in useEffect (avoids duplicate) ── */
  useEffect(() => {
    const handleGlobalPointerUp = () => { isInteracting.current = false; };
    window.addEventListener("pointerup", handleGlobalPointerUp);

    const onRemoteUpdate = (elements) => {
      if (!appRef.current || isInteracting.current) return;

      try {
        if (elements && elements.shapes) {
          // Content-hash dedup: skip if we already have this exact state
          const hash = hashContent(elements.shapes);
          if (hash && hash === lastEmittedHash.current) return;

          isSyncing.current = true;
          lastEmittedHash.current = hash;

          appRef.current.replacePageContent(
            elements.shapes,
            elements.bindings || {},
            elements.assets || {}
          );
        }
      } catch (e) {
        // Silently ignore shape-application errors
      } finally {
        // Synchronous reset — all onChange triggers from replacePageContent
        // fire synchronously in the same JS tick, so this is safe.
        isSyncing.current = false;
      }
    };

    const handleRequestState = ({ requesterId }) => {
      if (appRef.current) {
        const shapes = appRef.current.shapes || [];
        const bindings = (typeof appRef.current.getBindings === "function") ? appRef.current.getBindings() : (appRef.current.bindings || []);
        const assets = appRef.current.assets || [];

        const shapesMap = {};
        const bindingsMap = {};
        const assetsMap = {};
        if (Array.isArray(shapes)) shapes.forEach(s => { shapesMap[s.id] = s; });
        else Object.assign(shapesMap, shapes);
        if (Array.isArray(bindings)) bindings.forEach(b => { bindingsMap[b.id] = b; });
        else Object.assign(bindingsMap, bindings);
        if (Array.isArray(assets)) assets.forEach(a => { assetsMap[a.id] = a; });
        else Object.assign(assetsMap, assets);

        socket.emit("send-whiteboard-state", {
          to: requesterId,
          elements: {
            shapes: shapesMap,
            bindings: bindingsMap,
            assets: assetsMap
          }
        });
      }
    };

    socket.on("excalidrawUpdate", onRemoteUpdate);
    socket.on("request-whiteboard-state", handleRequestState);

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      socket.off("excalidrawUpdate", onRemoteUpdate);
      socket.off("request-whiteboard-state", handleRequestState);
    };
  }, [socket, hashContent, roomId]);

  const lastEmitTime = useRef(0);
  const handleChange = useCallback(
    (app) => {
      if (isSyncing.current) return;

      const now = Date.now();
      // Throttle only when actively drawing to protect network;
      // always allow the final stroke updates to pass through so drawings are complete.
      if (isInteracting.current && (now - lastEmitTime.current < 33)) {
        return;
      }
      lastEmitTime.current = now;

      try {
        const shapesMap = {};
        const bindingsMap = {};
        const assetsMap = {};

        // TldrawApp v1: app.shapes → TDShape[], app.getBindings() → TDBinding[], app.assets → TDAsset[]
        const shapes = app.shapes || [];
        const bindings = (typeof app.getBindings === "function") ? app.getBindings() : (app.bindings || []);
        const assets = app.assets || [];

        if (Array.isArray(shapes)) shapes.forEach(s => { shapesMap[s.id] = s; });
        else Object.assign(shapesMap, shapes);

        if (Array.isArray(bindings)) bindings.forEach(b => { bindingsMap[b.id] = b; });
        else Object.assign(bindingsMap, bindings);

        if (Array.isArray(assets)) assets.forEach(a => { assetsMap[a.id] = a; });
        else Object.assign(assetsMap, assets);

        // Content-hash dedup: skip emit if shapes haven't actually changed
        const hash = hashContent(shapesMap);
        if (hash === lastEmittedHash.current) return;
        lastEmittedHash.current = hash;

        socket.emit("excalidrawUpdate", {
          roomId,
          elements: JSON.parse(JSON.stringify({
            shapes: shapesMap,
            bindings: bindingsMap,
            assets: assetsMap
          }))
        });
      } catch (e) {
        // Silently ignore serialization errors
      }
    },
    [socket, roomId, hashContent]
  );

  return (
    <Overlay $embedded={embedded} $isFullScreen={isFullScreen} $isMobile={isMobile} onClick={embedded ? undefined : onClose}>
      <WhiteboardContainer $embedded={embedded} $isFullScreen={isFullScreen} $isMobile={isMobile} onClick={(e) => e.stopPropagation()}>
        {!isFullScreen && (
          <ModalHeader>
            <HeaderTitle><FaPaintBrush style={{ flexShrink: 0 }} /> <span className="hide-mobile">Collaborative</span> Whiteboard</HeaderTitle>
            <HeaderActions>
              {isAdmin && (
                <IconButton onClick={handleClearBoard} title="Clear Board for Everyone">
                  <FaTrash />
                </IconButton>
              )}
              <div style={{ position: "relative" }}>
                <IconButton onClick={() => setShowExportMenu(prev => !prev)} title="Export Board">
                  <FaDownload />
                </IconButton>
                {showExportMenu && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 8,
                    background: "rgba(20, 20, 20, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: 12,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                    zIndex: 20000,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    backdropFilter: "blur(10px)"
                  }}>
                    <button
                      onClick={() => handleExport("png")}
                      style={{
                        padding: "10px 16px",
                        background: "none",
                        border: "none",
                        color: "#fff",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.2s",
                        whiteSpace: "nowrap"
                      }}
                      onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.08)"}
                      onMouseLeave={e => e.target.style.background = "none"}
                    >
                      Export as PNG
                    </button>
                    <button
                      onClick={() => handleExport("svg")}
                      style={{
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
                        borderTop: "1px solid rgba(255,255,255,0.08)"
                      }}
                      onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.08)"}
                      onMouseLeave={e => e.target.style.background = "none"}
                    >
                      Export as SVG
                    </button>
                  </div>
                )}
              </div>
              {isMobile && (
                <IconButton onClick={() => setIsFullScreen(true)} title="Expand to Fullscreen">
                  <FaExpand />
                </IconButton>
              )}
              <IconButton $danger onClick={onClose} title="Close Whiteboard">
                <FaTimes />
              </IconButton>
            </HeaderActions>
          </ModalHeader>
        )}

        {/* If in fullscreen, float the controls directly over the canvas in a centered dock */}
        {isFullScreen && (
          <div style={{
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
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
          }}>
            {isAdmin && (
              <IconButton onClick={handleClearBoard} title="Clear Board for Everyone">
                <FaTrash />
              </IconButton>
            )}
            <div style={{ position: "relative" }}>
              <IconButton onClick={() => setShowExportMenu(prev => !prev)} title="Export Board">
                <FaDownload />
              </IconButton>
              {showExportMenu && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  marginTop: 8,
                  background: "rgba(20, 20, 20, 0.95)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 12,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                  zIndex: 20000,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  backdropFilter: "blur(10px)"
                }}>
                  <button
                    onClick={() => handleExport("png")}
                    style={{
                      padding: "10px 16px",
                      background: "none",
                      border: "none",
                      color: "#fff",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.2s",
                      whiteSpace: "nowrap"
                    }}
                    onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.08)"}
                    onMouseLeave={e => e.target.style.background = "none"}
                  >
                    Export as PNG
                  </button>
                  <button
                    onClick={() => handleExport("svg")}
                    style={{
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
                      borderTop: "1px solid rgba(255,255,255,0.08)"
                    }}
                    onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.08)"}
                    onMouseLeave={e => e.target.style.background = "none"}
                  >
                    Export as SVG
                  </button>
                </div>
              )}
            </div>
            <IconButton onClick={() => setIsFullScreen(false)} title="Exit Fullscreen">
              <FaCompress />
            </IconButton>
            <IconButton $danger onClick={onClose} title="Close Whiteboard">
              <FaTimes />
            </IconButton>
          </div>
        )}

        <CanvasWrapper
          $isFullScreen={isFullScreen}
          $isMobile={isMobile}
          onPointerDown={() => { isInteracting.current = true; }}
          onPointerUp={() => { isInteracting.current = false; }}
          onPointerLeave={() => { isInteracting.current = false; }}
        >
          <Tldraw
            onMount={handleMount}
            onChange={handleChange}
            darkMode={true}
            showMenu={false}
            showPages={false}
          />
        </CanvasWrapper>
      </WhiteboardContainer>
    </Overlay>
  );
}
