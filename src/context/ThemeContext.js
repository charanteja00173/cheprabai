import React, { createContext, useContext, useState, useEffect } from "react";
import { THEMES, FONTS, createAppTheme } from "../theme";
import { socket } from "../socket";

const ThemeContext = createContext();

export const useThemeManager = () => useContext(ThemeContext);

export const ThemeManagerProvider = ({ children }) => {
  const [activeThemeKey, setActiveThemeKey] = useState("default");
  const [activeFontKey, setActiveFontKey] = useState("inter");

  // Inject themes directly onto the root DOM element
  useEffect(() => {
    try {
      const themeProperties = createAppTheme(activeThemeKey, activeFontKey);
      if (themeProperties) {
        Object.entries(themeProperties).forEach(([key, value]) => {
          document.documentElement.style.setProperty(key, value);
        });
        
        // Announce color mode as data-theme attribute on root
        const theme = THEMES[activeThemeKey] || THEMES.default;
        const isLightTheme = activeThemeKey === "arcticWhite" || activeThemeKey === "pearl" || !!theme.isLightOnly;
        document.documentElement.setAttribute("data-theme", isLightTheme ? "light" : "dark");
        document.documentElement.style.colorScheme = isLightTheme ? "light" : "dark";
      }
    } catch (err) {
      console.error("Error setting custom theme properties:", err);
    }
  }, [activeThemeKey, activeFontKey]);

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
      {children}
    </ThemeContext.Provider>
  );
};


