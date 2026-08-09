import React, { useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { FaCog, FaTimes } from "react-icons/fa";
import { useThemeManager } from "../context/ThemeContext";
import { THEMES, FONTS } from "../theme";

const SettingsButton = styled.button`
  background: none;
  border: none;
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  font-size: 1.1rem;
  opacity: 0.7;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-badgeBorder);
  flex-shrink: 0;

  &:hover {
    opacity: 1;
    background: var(--chakra-colors-surfaceHover);
    border-color: var(--chakra-colors-brandPrimary);
    transform: rotate(45deg) scale(1.05);
    box-shadow: 0 0 12px var(--chakra-colors-brandGlow);
  }

  @media (max-width: 480px) {
    width: 30px;
    height: 30px;
    font-size: 0.85rem;
    border-radius: 8px;
  }

  @media (max-width: 375px) {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
    border-radius: 7px;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const scaleUp = keyframes`
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(8, 8, 12, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  animation: ${fadeIn} 0.2s ease-out;
`;

const Modal = styled.div`
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-border);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: 24px;
  padding: clamp(20px, 5vw, 28px);
  width: 90%;
  max-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 
    0 4px 30px rgba(0, 0, 0, 0.15),
    0 30px 70px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 var(--chakra-colors-borderSubtle);
  box-sizing: border-box;
  animation: ${scaleUp} 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

  @media (max-width: 400px) {
    width: 95%;
    padding: 16px;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--chakra-colors-textPrimary);
`;

const CloseButton = styled.button`
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-badgeBorder);
  color: var(--chakra-colors-textSecondary);
  cursor: pointer;
  font-size: 1rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  width: 36px;
  height: 36px;
  justify-content: center;

  &:hover {
    color: var(--chakra-colors-textPrimary);
    background: var(--chakra-colors-surfaceHover);
    border-color: var(--chakra-colors-brandPrimary);
    transform: scale(1.05);
  }
`;

const SectionLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--chakra-colors-textSecondary);
  margin-bottom: 12px;
  opacity: 0.8;
`;

const OptionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 24px;

  @media (max-width: 400px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`;

const ThemeOption = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  min-height: 80px;
  border-radius: 16px;
  border: 1px solid ${(p) => (p.$active ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-border)")};
  background: ${(p) => (p.$active ? "var(--chakra-colors-badgeBg)" : "var(--chakra-colors-bg)")};
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.88rem;
  box-sizing: border-box;
  width: 100%;
  box-shadow: ${(p) => (p.$active ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "none")};

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    transform: translateY(-2px);
    border-color: ${(p) => (p.$active ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-brandSecondary)")};
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
`;

const ThemeColorsPreview = styled.div`
  display: flex;
  gap: 4px;
  width: 100%;
  height: 10px;
  margin-top: auto;
`;

const PreviewColorBlock = styled.div`
  flex: 1;
  height: 100%;
  border-radius: 4px;
  background: ${(p) => p.$color};
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

const FontOption = styled.button`
  padding: 12px 14px;
  min-height: 48px;
  border-radius: 14px;
  border: 1px solid ${(p) => (p.$active ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-border)")};
  background: ${(p) => (p.$active ? "var(--chakra-colors-badgeBg)" : "var(--chakra-colors-bg)")};
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.88rem;
  font-family: ${(p) => p.$font};
  font-weight: ${(p) => (p.$active ? "700" : "500")};
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  box-sizing: border-box;

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    transform: translateY(-2px);
    border-color: ${(p) => (p.$active ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-brandSecondary)")};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const ThemeSwitcher = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    activeThemeKey,
    activeFontKey,
    changeTheme,
    changeFont,
    availableThemes,
    availableFonts,
  } = useThemeManager();

  return (
    <>
      <SettingsButton onClick={() => setIsOpen(true)} title="Settings">
        <FaCog />
      </SettingsButton>

      {isOpen && createPortal(
        <Overlay onClick={() => setIsOpen(false)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle><FaCog style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> Settings</ModalTitle>
              <CloseButton onClick={() => setIsOpen(false)}>
                <FaTimes />
              </CloseButton>
            </ModalHeader>

            <SectionLabel>Theme</SectionLabel>
            <OptionGrid>
              {availableThemes.map((key) => {
                const themeDef = THEMES[key];
                return (
                  <ThemeOption
                    key={key}
                    $active={activeThemeKey === key}
                    onClick={() => changeTheme(key)}
                  >
                    <span style={{ fontWeight: activeThemeKey === key ? "600" : "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "left" }}>
                      {themeDef.name}
                    </span>
                    <ThemeColorsPreview>
                      <PreviewColorBlock $color={themeDef.colors.primary} />
                      <PreviewColorBlock $color={themeDef.colors.secondary} />
                      <PreviewColorBlock $color={themeDef.colors.accent} />
                    </ThemeColorsPreview>
                  </ThemeOption>
                );
              })}
            </OptionGrid>

            <SectionLabel>Font</SectionLabel>
            <OptionGrid>
              {availableFonts.map((key) => {
                const fontDef = FONTS[key];
                return (
                  <FontOption
                    key={key}
                    $active={activeFontKey === key}
                    $font={fontDef.body}
                    onClick={() => changeFont(key)}
                  >
                    {fontDef.name}
                  </FontOption>
                );
              })}
            </OptionGrid>
          </Modal>
        </Overlay>,
        document.body
      )}
    </>
  );
};

export default ThemeSwitcher;
