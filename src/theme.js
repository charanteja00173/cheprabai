import { extendTheme } from "@chakra-ui/react";

/* ----------------------------------
   PREMIUM THEMES CONFIG
----------------------------------- */
export const THEMES = {
  default: {
      name: "OLED Midnight (Void)",
    colors: {
      primary: "#F43F5E",      // Crimson Red
      secondary: "#E11D48",    // Intense Rose
      accent: "#FB7185",       // Soft Rose Accent
      hover: "#E11D48",
      glow: "rgba(244, 63, 94, 0.25)",
      lightBg: "#FFF1F2",      // Gorgeous soft rose white background for light mode
      darkBg: "#000000",       // Pure OLED black for dark mode
      lightSurface: "#FFFFFF",
      darkSurface: "#09090B",
      lightSurfaceHover: "#FFE4E6",
      darkSurfaceHover: "#18181B",
    }
  },
  emerald: {
    name: "Emerald Aurora",
    colors: {
      primary: "#10B981",      // Emerald Green
      secondary: "#06B6D4",    // Cyan
      accent: "#3B82F6",       // Blue
      hover: "#059669",        // Dark Emerald Hover
      glow: "rgba(16, 185, 129, 0.15)",
      lightBg: "#F0FDF4",
      darkBg: "#022C22",
      lightSurface: "#FFFFFF",
      darkSurface: "#064E3B",
      lightSurfaceHover: "#DCFCE7",
      darkSurfaceHover: "#047857",
    }
  },
  amber: {
    name: "Solar Amber",
    colors: {
      primary: "#F59E0B",      // Amber Gold
      secondary: "#D97706",    // Orange
      accent: "#EC4899",       // Rose Pink
      hover: "#D97706",        // Orange Hover
      glow: "rgba(245, 158, 11, 0.15)",
      lightBg: "#FFFBEB",
      darkBg: "#120E08",
      lightSurface: "#FFFFFF",
      darkSurface: "#1F160C",
      lightSurfaceHover: "#FEF3C7",
      darkSurfaceHover: "#2D1E10",
    }
  },
  oceanic: {
    name: "Oceanic Glacier",
    colors: {
      primary: "#0EA5E9",      // Sky Blue
      secondary: "#6366F1",    // Indigo
      accent: "#10B981",       // Mint
      hover: "#0284C7",        // Sky Blue Hover
      glow: "rgba(14, 165, 233, 0.15)",
      lightBg: "#F0F9FF",
      darkBg: "#010614",
      lightSurface: "#FFFFFF",
      darkSurface: "#0B132B",
      lightSurfaceHover: "#E0F2FE",
      darkSurfaceHover: "#1C2541",
    }
  },
  rose: {
    name: "Luxury Burgundy",
    colors: {
      primary: "#BE185D",      // Burgundy
      secondary: "#F43F5E",    // Coral
      accent: "#10B981",       // Emerald
      hover: "#9D174D",
      glow: "rgba(190, 24, 93, 0.15)",
      lightBg: "#FFF5F5",
      darkBg: "#18040C",
      lightSurface: "#FFFFFF",
      darkSurface: "#270815",
      lightSurfaceHover: "#FFE4E6",
      darkSurfaceHover: "#3A0D1F",
    }
  },
  midnight: {
    name: "Amethyst Cyberpunk",
    colors: {
      primary: "#8B5CF6",      // Vivid Amethyst Purple
      secondary: "#EC4899",    // Orchid Pink/Magenta
      accent: "#F59E0B",       // Electric Amber Gold
      hover: "#7C3AED",        // Deep Amethyst Hover
      glow: "rgba(139, 92, 246, 0.15)",
      lightBg: "#F8FAFC",
      darkBg: "#030712",
      lightSurface: "#FFFFFF",
      darkSurface: "#0B0F19",
      lightSurfaceHover: "#F1F5F9",
      darkSurfaceHover: "#151B2E",
    }
  },
  synthwave: {
    name: "Cyber Retro Synth",
    colors: {
      primary: "#FF007F",      // Neon Pink
      secondary: "#00F0FF",    // Neon Cyan
      accent: "#FFB300",       // Neon Yellow Accent
      hover: "#E0006C",
      glow: "rgba(255, 0, 127, 0.2)",
      lightBg: "#FFF1F2",
      darkBg: "#120924",       // Cosmic Purple
      lightSurface: "#FFFFFF",
      darkSurface: "#1D0E3A",
      lightSurfaceHover: "#FFE4E6",
      darkSurfaceHover: "#2A1454",
    }
  },
  nordic: {
    name: "Frosty Nord",
    colors: {
      primary: "#88C0D0",      // Frost Blue
      secondary: "#81A1C1",    // Ice Blue
      accent: "#A3BE8C",       // Moss/Sage Green Accent
      hover: "#5E81AC",
      glow: "rgba(136, 192, 208, 0.15)",
      lightBg: "#F8FAFC",
      darkBg: "#2E3440",       // Polar Night
      lightSurface: "#FFFFFF",
      darkSurface: "#3B4252",
      lightSurfaceHover: "#E5E9F0",
      darkSurfaceHover: "#434C5E",
    }
  },
  forest: {
    name: "Forest Zen",
    colors: {
      primary: "#606C38",      // Moss Green
      secondary: "#DDA15E",    // Warm Sand Gold
      accent: "#BC6C25",       // Earthy Amber Accent
      hover: "#4F592E",
      glow: "rgba(96, 108, 56, 0.15)",
      lightBg: "#FEFAE0",      // Soft Cream
      darkBg: "#121A0F",       // Forest Shadow
      lightSurface: "#FFFFFF",
      darkSurface: "#1B2717",
      lightSurfaceHover: "#F4EBC1",
      darkSurfaceHover: "#273821",
    }
  },
  dracula: {
    name: "Vampire Gothic",
    colors: {
      primary: "#BD93F9",      // Dracula Purple
      secondary: "#FF79C6",    // Vampire Pink
      accent: "#50FA7B",       // Ghastly Green Accent
      hover: "#AA7FF0",
      glow: "rgba(189, 147, 249, 0.2)",
      lightBg: "#F3F0FA",
      darkBg: "#1E1F29",       // Gothic Dark
      lightSurface: "#FFFFFF",
      darkSurface: "#282A36",
      lightSurfaceHover: "#E8E2F7",
      darkSurfaceHover: "#343746",
    }
  },
  platinum: {
    name: "Monochrome Platinum",
    colors: {
      primary: "#64748B",      // Slate Grey
      secondary: "#334155",    // Dark Slate
      accent: "#0F172A",       // Pitch Charcoal Accent
      hover: "#475569",
      glow: "rgba(100, 116, 139, 0.15)",
      lightBg: "#F8FAFC",
      darkBg: "#0F172A",
      lightSurface: "#FFFFFF",
      darkSurface: "#1E293B",
      lightSurfaceHover: "#F1F5F9",
      darkSurfaceHover: "#334155",
    }
  },
  prudhvi: {
    name: "Prudhvi Navy",
    colors: {
      primary: "#1E3A8A",      // Navy Blue
      secondary: "#0F172A",    // Dark Slate/Grey
      accent: "#64748B",       // Cool Slate Grey Accent
      hover: "#1D4ED8",        // Bright Navy Hover
      glow: "rgba(30, 58, 138, 0.18)",
      lightBg: "#FFFFFF",      // Pure White Background
      darkBg: "#0B0F19",       // Dark Grey/Navy
      lightSurface: "#F8FAFC", // Sleek White-slate surface
      darkSurface: "#1E293B",  // Dark Grey surface
      lightSurfaceHover: "#E2E8F0",
      darkSurfaceHover: "#334155",
    }
  }
};

/* ----------------------------------
   PREMIUM FONTS CONFIG
----------------------------------- */
export const FONTS = {
  inter: {
    name: "Inter (Modern Clean)",
    heading: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`,
    body: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`,
  },
  outfit: {
    name: "Outfit (Elegant Rounded)",
    heading: `'Outfit', system-ui, -apple-system, sans-serif`,
    body: `'Outfit', system-ui, -apple-system, sans-serif`,
  },
  spaceGrotesk: {
    name: "Space Grotesk (Cyberpunk Tech)",
    heading: `'Space Grotesk', system-ui, -apple-system, sans-serif`,
    body: `'Space Grotesk', system-ui, -apple-system, sans-serif`,
  },
  lora: {
    name: "Lora & Inter (Editorial Serif)",
    heading: `'Lora', Georgia, serif`,
    body: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`,
  },
  jetbrains: {
    name: "JetBrains Mono (Developer Mono)",
    heading: `'JetBrains Mono', monospace`,
    body: `'JetBrains Mono', monospace`,
  },
  plusJakarta: {
    name: "Plus Jakarta Sans (Sleek Geometric)",
    heading: `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`,
    body: `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`,
  },
  syne: {
    name: "Syne (Avant-Garde Art)",
    heading: `'Syne', system-ui, -apple-system, sans-serif`,
    body: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`,
  },
  playfair: {
    name: "Playfair Display (Luxury Editorial)",
    heading: `'Playfair Display', Georgia, serif`,
    body: `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`,
  },
  manrope: {
    name: "Manrope (Minimalist Tech)",
    heading: `'Manrope', system-ui, -apple-system, sans-serif`,
    body: `'Manrope', system-ui, -apple-system, sans-serif`,
  },
  cinzel: {
    name: "Cinzel (Classic Roman Luxury)",
    heading: `'Cinzel', Georgia, serif`,
    body: `'Urbanist', system-ui, -apple-system, sans-serif`,
  },
  urbanist: {
    name: "Urbanist (High-Fashion Geometric)",
    heading: `'Urbanist', system-ui, -apple-system, sans-serif`,
    body: `'Urbanist', system-ui, -apple-system, sans-serif`,
  },
  prudhvi: {
    name: "Prudhvi (Montserrat & Lato)",
    heading: `'Montserrat', sans-serif`,
    body: `'Lato', sans-serif`,
  }
};

/* ----------------------------------
   DYNAMIC THEME CREATOR
----------------------------------- */
export function createAppTheme(themeKey = "default", fontKey = "inter") {
  const activeTheme = THEMES[themeKey] || THEMES.default;
  const activeFont = FONTS[fontKey] || FONTS.inter;
  const isDarkOnly = activeTheme.isDarkOnly || false;

  const config = {
    initialColorMode: isDarkOnly ? "dark" : "dark",
    useSystemColorMode: isDarkOnly ? false : true,
  };

  const colors = {
    brand: {
      primary: activeTheme.colors.primary,
      secondary: activeTheme.colors.secondary,
      accent: activeTheme.colors.accent,
      hover: activeTheme.colors.hover,
      glow: activeTheme.colors.glow,
    },
    light: {
      bg: isDarkOnly ? activeTheme.colors.darkBg : activeTheme.colors.lightBg,
      surface: isDarkOnly ? activeTheme.colors.darkSurface : activeTheme.colors.lightSurface,
      surfaceHover: isDarkOnly ? activeTheme.colors.darkSurfaceHover : activeTheme.colors.lightSurfaceHover,
      card: isDarkOnly ? `rgba(${hexToRgb(activeTheme.colors.darkSurface)}, 0.65)` : activeTheme.colors.lightSurface,
      border: isDarkOnly ? `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.09)` : `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.08)`,
      borderSubtle: isDarkOnly ? `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.04)` : `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.04)`,
      textPrimary: isDarkOnly ? "#F9FAFB" : "#0F172A",
      textSecondary: isDarkOnly ? "#E5E7EB" : "#475569",
      textMuted: isDarkOnly ? "#9CA3AF" : "#64748B",
    },
    dark: {
      bg: activeTheme.colors.darkBg,
      surface: activeTheme.colors.darkSurface,
      surfaceHover: activeTheme.colors.darkSurfaceHover,
      card: `rgba(${hexToRgb(activeTheme.colors.darkSurface)}, 0.65)`,
      border: `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.09)`,
      borderSubtle: `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.04)`,
      textPrimary: "#F9FAFB",
      textSecondary: "#E5E7EB",
      textMuted: "#9CA3AF",
    },
  };

  return extendTheme({
    config,
    colors,
    semanticTokens: {
      colors: {
        bg: { default: "light.bg", _dark: "dark.bg" },
        surface: { default: "light.surface", _dark: "dark.surface" },
        surfaceHover: { default: "light.surfaceHover", _dark: "dark.surfaceHover" },
        cardBg: { default: "light.card", _dark: "dark.card" },
        border: { default: "light.border", _dark: "dark.border" },
        borderSubtle: { default: "light.borderSubtle", _dark: "dark.borderSubtle" },
        textPrimary: { default: "light.textPrimary", _dark: "dark.textPrimary" },
        textSecondary: { default: "light.textSecondary", _dark: "dark.textSecondary" },
        textMuted: { default: "light.textMuted", _dark: "dark.textMuted" },
        brandPrimary: { default: "brand.primary", _dark: "brand.primary" },
        brandSecondary: { default: "brand.secondary", _dark: "brand.secondary" },
        brandAccent: { default: "brand.accent", _dark: "brand.accent" },
        brandHover: { default: "brand.hover", _dark: "brand.hover" },
        brandGlow: { default: "brand.glow", _dark: "brand.glow" },
        glassBg: {
          default: `rgba(${hexToRgb(activeTheme.colors.lightSurface)}, 0.75)`,
          _dark: `rgba(${hexToRgb(activeTheme.colors.darkBg)}, 0.75)`
        },
        badgeBg: {
          default: `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.06)`,
          _dark: `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.12)`
        },
        badgeBorder: {
          default: `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.12)`,
          _dark: `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.2)`
        },
        featuredBg: {
          default: `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.02)`,
          _dark: `rgba(${hexToRgb(activeTheme.colors.primary)}, 0.04)`
        },
      },
      shadows: {
        cardShadow: { default: "card", _dark: "card-dark" },
        cardShadowHover: { default: "card-hover", _dark: "card-dark-hover" },
        glowShadow: { default: "glow", _dark: "glow-lg" },
      }
    },
    fonts: {
      heading: activeFont.heading,
      body: activeFont.body,
      mono: `'JetBrains Mono', 'Fira Code', monospace`,
    },
    styles: {
      global: {
        body: {
          bg: "bg",
          color: "textPrimary",
          lineHeight: "1.7",
          letterSpacing: "0.01em",
          transition: "background-color 0.3s ease, color 0.3s ease",
          overflowX: "hidden",
        },
        "h1, h2, h3, h4, h5, h6": {
          fontWeight: "700",
          letterSpacing: "-0.025em",
        },
        "::-webkit-scrollbar": { width: "8px" },
        "::-webkit-scrollbar-track": { background: "bg" },
        "::-webkit-scrollbar-thumb": { background: "borderSubtle", borderRadius: "10px" },
        "::-webkit-scrollbar-thumb:hover": { background: "brandPrimary" },
      }
    },
    shadows: {
      glow: `0 0 40px rgba(${hexToRgb(activeTheme.colors.primary)}, 0.15)`,
      "glow-lg": `0 0 60px rgba(${hexToRgb(activeTheme.colors.primary)}, 0.25)`,
      card: "0 4px 24px rgba(0, 0, 0, 0.04)",
      "card-hover": `0 12px 40px rgba(${hexToRgb(activeTheme.colors.primary)}, 0.12)`,
      "card-dark": "0 4px 24px rgba(0, 0, 0, 0.4)",
      "card-dark-hover": "0 12px 40px rgba(0, 0, 0, 0.6)",
    },
    components: {
      Button: {
        baseStyle: {
          borderRadius: "xl",
          fontWeight: "600",
          letterSpacing: "0.01em",
          lineHeight: "1.2",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        },
        variants: {
          solid: {
            bg: "brandPrimary",
            color: "white",
            _hover: {
              bg: "brandHover",
              transform: "translateY(-2px)",
              boxShadow: "glowShadow",
            },
            _active: { transform: "translateY(0)" },
          },
          outline: {
            borderColor: "border",
            color: "textPrimary",
            _hover: {
              bg: "surfaceHover",
              borderColor: "brandPrimary",
              transform: "translateY(-2px)",
            },
            _active: { transform: "translateY(0)" },
          },
          ghost: {
            color: "textSecondary",
            _hover: {
              bg: "surfaceHover",
              color: "brandPrimary",
            },
          },
        },
      },
      Card: {
        baseStyle: {
          container: {
            bg: "cardBg",
            border: "1px solid",
            borderColor: "border",
            borderRadius: "2xl",
            overflow: "hidden",
            backdropFilter: "blur(24px)",
            boxShadow: "cardShadow",
            transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            _hover: {
              transform: "translateY(-6px)",
              borderColor: "brandPrimary",
              boxShadow: "cardShadowHover",
            },
          },
        },
      },
      Heading: {
        baseStyle: {
          fontWeight: "700",
          letterSpacing: "-0.03em",
          color: "textPrimary",
        },
        sizes: {
          "4xl": { fontSize: "clamp(1.75rem, 1.2rem + 2vw, 3rem)" },
          "3xl": { fontSize: "clamp(1.5rem, 1.1rem + 1.6vw, 2.5rem)" },
          "2xl": { fontSize: "clamp(1.3rem, 1rem + 1.2vw, 2rem)" },
          xl: { fontSize: "clamp(1.15rem, 0.95rem + 0.8vw, 1.5rem)" },
          lg: { fontSize: "clamp(1.05rem, 0.9rem + 0.5vw, 1.3rem)" },
          md: { fontSize: "clamp(0.95rem, 0.85rem + 0.3vw, 1.15rem)" },
          sm: { fontSize: "clamp(0.85rem, 0.8rem + 0.15vw, 0.95rem)" },
          xs: { fontSize: "clamp(0.75rem, 0.72rem + 0.1vw, 0.85rem)" },
        },
      },
      Text: {
        baseStyle: { color: "textSecondary", lineHeight: "1.75" },
      },
      Link: {
        baseStyle: {
          color: "brandPrimary",
          fontWeight: "500",
          transition: "all 0.2s ease",
          _hover: { textDecoration: "none", opacity: 0.85 },
        },
      },
      Divider: {
        baseStyle: { borderColor: "border", opacity: 0.6 },
      },
      Input: {
        variants: {
          outline: {
            field: {
              borderColor: "border",
              bg: "surfaceHover",
              borderRadius: "xl",
              _focus: {
                borderColor: "brandPrimary",
                boxShadow: `0 0 0 1px rgba(${hexToRgb(activeTheme.colors.primary)}, 0.4)`,
              },
              _hover: { borderColor: "border" },
            },
          },
        },
      },
      Textarea: {
        variants: {
          outline: {
            borderColor: "border",
            bg: "surfaceHover",
            borderRadius: "xl",
            _focus: {
              borderColor: "brandPrimary",
              boxShadow: `0 0 0 1px rgba(${hexToRgb(activeTheme.colors.primary)}, 0.4)`,
            },
            _hover: { borderColor: "border" },
          },
        },
      },
      Tag: {
        baseStyle: {
          container: {
            borderRadius: "full",
            fontWeight: "500",
            fontSize: "xs",
            letterSpacing: "0.02em",
            bg: "surfaceHover",
            color: "textSecondary",
            border: "1px solid",
            borderColor: "border",
          },
        },
      },
      Badge: {
        baseStyle: {
          borderRadius: "full",
          fontWeight: "600",
          fontSize: "xs",
          letterSpacing: "0.05em",
          px: 3,
          py: 1,
        },
        variants: {
          subtle: {
            bg: "badgeBg",
            color: "brandPrimary",
            border: "1px solid",
            borderColor: "badgeBorder",
          },
        },
        defaultProps: { variant: "subtle" },
      },
      Switch: {
        baseStyle: {
          track: { _checked: { bg: "brandPrimary" } },
        },
      },
      Alert: {
        baseStyle: {
          container: {
            borderRadius: "2xl",
            backdropFilter: "blur(20px)",
            border: "1px solid",
            borderColor: "border",
            boxShadow: "cardShadow",
            p: 4,
          },
          title: {
            fontWeight: "700",
            fontSize: "sm",
            color: "textPrimary",
          },
          description: {
            fontSize: "xs",
            color: "textSecondary",
          }
        },
        variants: {
          subtle: (props) => {
            const { colorScheme: c } = props;
            let statusColor = "brandPrimary";
            if (c === "red" || c === "error") statusColor = "red.500";
            if (c === "green" || c === "success") statusColor = "green.500";
            if (c === "orange" || c === "warning") statusColor = "orange.400";
            if (c === "blue" || c === "info") statusColor = "blue.400";

            return {
              container: {
                bg: "cardBg",
                borderColor: "border",
                color: "textPrimary",
              },
              icon: {
                color: statusColor,
              }
            };
          },
          solid: (props) => {
            const { colorScheme: c } = props;
            let statusColor = "brandPrimary";
            if (c === "red" || c === "error") statusColor = "red.600";
            if (c === "green" || c === "success") statusColor = "green.600";
            return {
              container: {
                bg: statusColor,
                color: "white",
              }
            };
          }
        }
      },
    }
  });
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "139, 92, 246";
}

const defaultTheme = createAppTheme();
export default defaultTheme;
