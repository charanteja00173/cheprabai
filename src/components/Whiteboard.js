import React, { useCallback, useRef, useEffect } from "react";
import { Tldraw } from "@tldraw/tldraw";
import styled from "styled-components";
import { FaTimes, FaExpand, FaCompress, FaTrash } from "react-icons/fa";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${(props) => (props.$isFullScreen ? "0" : "40px")};
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: 0;
    background: var(--chakra-colors-bg);
    backdrop-filter: none;
  }
`;

const WhiteboardContainer = styled.div`
  position: relative;
  width: ${(props) => (props.$isFullScreen ? "100%" : "90%")};
  max-width: ${(props) => (props.$isFullScreen ? "100%" : "1600px")};
  height: ${(props) => (props.$isFullScreen ? "100dvh" : "85dvh")};
  background: var(--chakra-colors-surface);
  border-radius: ${(props) => (props.$isFullScreen ? "0" : "clamp(12px, 2vw, 16px)")};
  box-shadow: ${(props) => (props.$isFullScreen ? "none" : "0 25px 50px -12px rgba(0, 0, 0, 0.7)")};
  border: ${(props) => (props.$isFullScreen ? "none" : "1px solid rgba(255, 255, 255, 0.1)")};
  padding: ${(props) => (props.$isFullScreen ? "0" : "clamp(16px, 3vw, 24px)")};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 768px) {
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
  border-radius: ${(props) => (props.$isFullScreen ? "0" : "clamp(8px, 1.5vw, 12px)")};
  overflow: hidden;
  border: ${(props) => (props.$isFullScreen ? "none" : "1px solid rgba(255, 255, 255, 0.08)")};
  background: var(--chakra-colors-bg);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex: 1;
  box-sizing: border-box;
  
  /* Override TLDraw variables to pull UI away from the extreme edges so it isn't clipped by rounded corners */
  --tl-padding: 8px;

  @media (max-width: 768px) {
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

  @media (max-width: 768px) {
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
  background: ${(props) => (props.$danger ? "rgba(255, 71, 87, 0.1)" : "rgba(255, 255, 255, 0.08)")};
  color: ${(props) => (props.$danger ? "#ff4757" : "#fff")};
  border: 1px solid ${(props) => (props.$danger ? "rgba(255, 71, 87, 0.25)" : "rgba(255, 255, 255, 0.15)")};
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
    background: rgba(20, 20, 20, 0.95);
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
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  &:hover::after {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }

  &:hover {
    background: ${(props) => (props.$danger ? "#ff4757" : "rgba(255, 255, 255, 0.1)")};
    color: var(--chakra-colors-textPrimary);
    transform: translateY(-2px);
  }
`;

export default function Whiteboard({ socket, roomId, onClose, isAdmin }) {
  const appRef = useRef(null);
  const isSyncing = useRef(false);
  const isInteracting = useRef(false);
  const [isFullScreen, setIsFullScreen] = React.useState(false);

  const handleClearBoard = useCallback(() => {
    if (!appRef.current) return;
    if (window.confirm("Are you sure you want to clear the entire whiteboard for everyone?")) {
      // Create empty state structures required by TLDraw to fully clear the board
      const emptyState = { shapes: {}, bindings: {}, assets: {} };
      appRef.current.replacePageContent(emptyState.shapes, emptyState.bindings, emptyState.assets);

      // Emit the exact same empty state to instantly clear all connected clients
      socket.emit("excalidrawUpdate", { roomId, elements: emptyState });
    }
  }, [socket, roomId]);

  const handleMount = useCallback(
    (app) => {
      appRef.current = app;

      socket.on("excalidrawUpdate", (state) => {
        if (!appRef.current || isInteracting.current || isSyncing.current) return;

        try {
          isSyncing.current = true;
          const { elements } = state;
          if (elements && elements.shapes) {
            appRef.current.replacePageContent(
              elements.shapes,
              elements.bindings || {},
              elements.assets || {}
            );
          }
        } catch (e) {
        } finally {
          setTimeout(() => { isSyncing.current = false; }, 50);
        }
      });
    },
    [socket]
  );

  useEffect(() => {
    const handleGlobalPointerUp = () => { isInteracting.current = false; };
    window.addEventListener("pointerup", handleGlobalPointerUp);

    socket.on("excalidrawUpdate", (elements) => {
      if (!appRef.current || isInteracting.current || isSyncing.current) return;

      try {
        isSyncing.current = true;
        if (elements && elements.shapes) {
          appRef.current.replacePageContent(
            elements.shapes,
            elements.bindings || {},
            elements.assets || {}
          );
        }
      } catch (e) {
      } finally {
        setTimeout(() => { isSyncing.current = false; }, 100);
      }
    });

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      socket.off("excalidrawUpdate");
    };
  }, [socket]);

  const lastEmit = useRef(0);
  const handleChange = useCallback(
    (app) => {
      if (isSyncing.current) return;

      // Throttle to 60fps for "Completely Realtime" feel
      const now = Date.now();
      if (now - lastEmit.current < 16) return;
      lastEmit.current = now;

      try {
        const shapesMap = {};
        const bindingsMap = {};
        const assetsMap = {};

        // Version-agnostic normalization
        const shapes = app.shapes;
        const bindings = app.bindings;
        const assets = app.assets;

        if (Array.isArray(shapes)) shapes.forEach(s => shapesMap[s.id] = s);
        else Object.assign(shapesMap, shapes || {});

        if (Array.isArray(bindings)) bindings.forEach(b => bindingsMap[b.id] = b);
        else Object.assign(bindingsMap, bindings || {});

        if (Array.isArray(assets)) assets.forEach(a => assetsMap[a.id] = a);
        else Object.assign(assetsMap, assets || {});

        socket.emit("excalidrawUpdate", {
          roomId,
          elements: JSON.parse(JSON.stringify({
            shapes: shapesMap,
            bindings: bindingsMap,
            assets: assetsMap
          }))
        });
      } catch (e) {
      }
    },
    [socket, roomId]
  );

  return (
    <Overlay $isFullScreen={isFullScreen} onClick={onClose}>
      <WhiteboardContainer $isFullScreen={isFullScreen} onClick={(e) => e.stopPropagation()}>
        {!isFullScreen && (
          <ModalHeader>
            <HeaderTitle>🎨 <span className="hide-mobile">Collaborative</span> Whiteboard</HeaderTitle>
            <HeaderActions>
              {isAdmin && (
                <IconButton onClick={handleClearBoard} title="Clear Board for Everyone">
                  <FaTrash />
                </IconButton>
              )}
              <IconButton onClick={() => setIsFullScreen(true)} title="Expand to Fullscreen">
                <FaExpand />
              </IconButton>
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
            <IconButton onClick={() => setIsFullScreen(false)} title="Exit Fullscreen">
              <FaCompress />
            </IconButton>
            <IconButton $danger onClick={onClose} title="Close Whiteboard">
              <FaTimes />
            </IconButton>
          </div>
        )}

        <CanvasWrapper
          isFullScreen={isFullScreen}
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
