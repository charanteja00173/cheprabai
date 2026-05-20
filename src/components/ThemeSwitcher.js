import React, { useState } from "react";
import styled from "styled-components";
import { FaCog, FaTimes } from "react-icons/fa";
import { useThemeManager } from "../context/ThemeContext";
import { THEMES, FONTS } from "../theme";

const SettingsButton = styled.button`
  background: none;
  border: none;
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  font-size: 1.2rem;
  opacity: 0.6;
  transition: all 0.2s;
  display: flex;
  align-items: center;

  &:hover {
    opacity: 1;
    transform: scale(1.1);
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
`;

const Modal = styled.div`
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 16px;
  padding: 24px;
  width: 90%;
  max-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: var(--chakra-colors-textPrimary);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: var(--chakra-colors-textSecondary);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.2s;

  &:hover {
    color: var(--chakra-colors-textPrimary);
  }
`;

const SectionLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--chakra-colors-textSecondary);
  margin-bottom: 10px;
`;

const OptionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 20px;
`;

const ThemeOption = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid ${(p) => (p.$active ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-border)")};
  background: ${(p) => (p.$active ? "var(--chakra-colors-surfaceHover)" : "transparent")};
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  font-weight: ${(p) => (p.$active ? "600" : "400")};

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    transform: translateY(-1px);
  }
`;

const ColorDot = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${(p) => p.color};
  flex-shrink: 0;
`;

const FontOption = styled.button`
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid ${(p) => (p.$active ? "var(--chakra-colors-brandPrimary)" : "var(--chakra-colors-border)")};
  background: ${(p) => (p.$active ? "var(--chakra-colors-surfaceHover)" : "transparent")};
  color: var(--chakra-colors-textPrimary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  font-family: ${(p) => p.$font};
  font-weight: ${(p) => (p.$active ? "600" : "400")};
  text-align: left;

  &:hover {
    background: var(--chakra-colors-surfaceHover);
    transform: translateY(-1px);
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

      {isOpen && (
        <Overlay onClick={() => setIsOpen(false)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>⚙️ Settings</ModalTitle>
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
                    <ColorDot color={themeDef.colors.primary} />
                    {themeDef.name}
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
        </Overlay>
      )}
    </>
  );
};

export default ThemeSwitcher;
