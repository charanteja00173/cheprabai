import React, { createContext, useContext, useState, useEffect } from "react";
import { ChakraProvider, useColorMode } from "@chakra-ui/react";
import { THEMES, FONTS, createAppTheme } from "../theme";
import { socket } from "../socket";

const ThemeContext = createContext();

export const useThemeManager = () => useContext(ThemeContext);

function ColorModeSyncer({ activeThemeKey }) {
  const { colorMode, setColorMode } = useColorMode();

  useEffect(() => {
    const theme = THEMES[activeThemeKey] || THEMES.default;
    const isLightTheme = activeThemeKey === "arcticWhite" || activeThemeKey === "pearl" || !!theme.isLightOnly;
    const targetMode = isLightTheme ? "light" : "dark";
    if (colorMode !== targetMode) {
      setColorMode(targetMode);
    }
  }, [activeThemeKey, colorMode, setColorMode]);

  return null;
}

export const ThemeManagerProvider = ({ children }) => {
  const [activeThemeKey, setActiveThemeKey] = useState("default");
  const [activeFontKey, setActiveFontKey] = useState("inter");

  // Generate dynamic Chakra theme
  const chakraTheme = createAppTheme(activeThemeKey, activeFontKey);

  useEffect(() => {
    // Listen for room-theme-changed events from the backend
    socket.on("room-theme-changed", (data) => {
      if (data && data.theme) {
        setActiveThemeKey(data.theme);
      }
    });

    return () => {
      socket.off("room-theme-changed");
    };
  }, []);

  const changeTheme = (themeKey) => {
    setActiveThemeKey(themeKey);
    // Optionally emit to sync room theme
    socket.emit("set-room-theme", { theme: themeKey });
  };

  const changeFont = (fontKey) => {
    setActiveFontKey(fontKey);
  };

  return (
    <ThemeContext.Provider value={{
      activeThemeKey,
      activeFontKey,
      changeTheme,
      changeFont,
      availableThemes: Object.keys(THEMES),
      availableFonts: Object.keys(FONTS)
    }}>
      <ChakraProvider theme={chakraTheme}>
        <ColorModeSyncer activeThemeKey={activeThemeKey} />
        {children}
      </ChakraProvider>
    </ThemeContext.Provider>
  );
};

