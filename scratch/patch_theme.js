const fs = require('fs');
const path = require('path');

const targetPath = '/Users/charantejaperala/Downloads/Projects/cheprabai/src/theme.js';
let content = fs.readFileSync(targetPath, 'utf8');

// Replace the Chakra import
content = content.replace('import { extendTheme } from "@chakra-ui/react";', '');

// Replace the createAppTheme function
const startTag = 'export function createAppTheme(';
const startIndex = content.indexOf(startTag);
if (startIndex === -1) {
  console.error("Could not find createAppTheme start");
  process.exit(1);
}

const endTag = 'function hexToRgbArr(';
const endIndex = content.indexOf(endTag);
if (endIndex === -1) {
  console.error("Could not find hexToRgbArr start");
  process.exit(1);
}

const before = content.slice(0, startIndex);
const after = content.slice(endIndex);

const newCreateAppTheme = `export function createAppTheme(themeKey = "default", fontKey = "inter") {
  const activeTheme = THEMES[themeKey] || THEMES.default;
  const activeFont = FONTS[fontKey] || FONTS.inter;
  const isDarkOnly = activeTheme.isDarkOnly || false;
  const isLightOnly = activeTheme.isLightOnly || false;

  const mode = isLightOnly ? "light" : "dark";

  const getBg = (m) => {
    if (isLightOnly) return activeTheme.colors.lightBg;
    if (isDarkOnly) return activeTheme.colors.darkBg;
    return m === "light" ? activeTheme.colors.lightBg : activeTheme.colors.darkBg;
  };

  const getSurface = (m) => {
    if (isLightOnly) return activeTheme.colors.lightSurface;
    if (isDarkOnly) return activeTheme.colors.darkSurface;
    return m === "light" ? activeTheme.colors.lightSurface : activeTheme.colors.darkSurface;
  };

  const getSurfaceHover = (m) => {
    if (isLightOnly) return activeTheme.colors.lightSurfaceHover;
    if (isDarkOnly) return activeTheme.colors.darkSurfaceHover;
    return m === "light" ? activeTheme.colors.lightSurfaceHover : activeTheme.colors.darkSurfaceHover;
  };

  const getCard = (m) => {
    if (isLightOnly) return activeTheme.colors.lightSurface;
    if (isDarkOnly) return \`rgba(\${hexToRgb(activeTheme.colors.darkSurface)}, 0.65)\`;
    return m === "light"
      ? activeTheme.colors.lightSurface
      : \`rgba(\${hexToRgb(activeTheme.colors.darkSurface)}, 0.65)\`;
  };

  const liftTowardWhite = (hex, amt) => {
    const [r, g, b] = hexToRgbArr(hex);
    const f = (c) => Math.round(c + (255 - c) * amt);
    return \`\${f(r)}, \${f(g)}, \${f(b)}\`;
  };

  const getBorder = (m) => {
    const isDark = isDarkOnly || (m === "dark" && !isLightOnly);
    const rgb = isDark ? liftTowardWhite(activeTheme.colors.primary, 0.55) : hexToRgb(activeTheme.colors.primary);
    const opacity = isDark ? "0.16" : "0.1";
    return \`rgba(\${rgb}, \${opacity})\`;
  };

  const getBorderSubtle = (m) => {
    const isDark = isDarkOnly || (m === "dark" && !isLightOnly);
    const rgb = isDark ? liftTowardWhite(activeTheme.colors.primary, 0.55) : hexToRgb(activeTheme.colors.primary);
    return \`rgba(\${rgb}, \${isDark ? "0.09" : "0.055"})\`;
  };

  const getTextPrimary = (m) => {
    if (isLightOnly) return "#0F172A";
    if (isDarkOnly) return "#F9FAFB";
    return m === "light" ? "#0F172A" : "#F9FAFB";
  };

  const getTextSecondary = (m) => {
    if (isLightOnly) return "#475569";
    if (isDarkOnly) return "#E5E7EB";
    return m === "light" ? "#475569" : "#E5E7EB";
  };

  const getTextMuted = (m) => {
    if (isLightOnly) return "#64748B";
    if (isDarkOnly) return "#9CA3AF";
    return m === "light" ? "#64748B" : "#9CA3AF";
  };

  const getGlassBg = (m) => {
    const targetSurface = isLightOnly ? activeTheme.colors.lightSurface : activeTheme.colors.darkBg;
    return \`rgba(\${hexToRgb(targetSurface)}, 0.75)\`;
  };

  const getBadgeBg = (m) => {
    const opacity = isLightOnly ? 0.06 : 0.12;
    return \`rgba(\${hexToRgb(activeTheme.colors.primary)}, \${opacity})\`;
  };

  const getBadgeBorder = (m) => {
    const opacity = isLightOnly ? 0.12 : 0.2;
    return \`rgba(\${hexToRgb(activeTheme.colors.primary)}, \${opacity})\`;
  };

  const getFeaturedBg = (m) => {
    const opacity = isLightOnly ? 0.02 : 0.04;
    return \`rgba(\${hexToRgb(activeTheme.colors.primary)}, \${opacity})\`;
  };

  return {
    "--chakra-colors-bg": getBg(mode),
    "--chakra-colors-surface": getSurface(mode),
    "--chakra-colors-surfaceHover": getSurfaceHover(mode),
    "--chakra-colors-cardBg": getCard(mode),
    "--chakra-colors-border": getBorder(mode),
    "--chakra-colors-borderSubtle": getBorderSubtle(mode),
    "--chakra-colors-textPrimary": getTextPrimary(mode),
    "--chakra-colors-textSecondary": getTextSecondary(mode),
    "--chakra-colors-textMuted": getTextMuted(mode),
    "--chakra-colors-brandPrimary": activeTheme.colors.primary,
    "--chakra-colors-brandSecondary": activeTheme.colors.secondary,
    "--chakra-colors-brandAccent": activeTheme.colors.accent,
    "--chakra-colors-brandHover": activeTheme.colors.hover,
    "--chakra-colors-brandGlow": activeTheme.colors.glow,
    "--chakra-colors-glassBg": getGlassBg(mode),
    "--chakra-colors-badgeBg": getBadgeBg(mode),
    "--chakra-colors-badgeBorder": getBadgeBorder(mode),
    "--chakra-colors-featuredBg": getFeaturedBg(mode),
    "--chakra-shadows-cardShadow": isLightOnly ? "0 4px 24px rgba(0, 0, 0, 0.04)" : "0 4px 24px rgba(0, 0, 0, 0.4)",
    "--chakra-shadows-cardShadowHover": isLightOnly ? \`0 12px 40px rgba(\${hexToRgb(activeTheme.colors.primary)}, 0.12)\` : "0 12px 40px rgba(0, 0, 0, 0.6)",
    "--chakra-shadows-glowShadow": \`0 0 40px rgba(\${hexToRgb(activeTheme.colors.primary)}, 0.15)\`,
    "--chakra-fonts-heading": activeFont.heading,
    "--chakra-fonts-body": activeFont.body,
    "--chakra-fonts-mono": \`'JetBrains Mono', 'Fira Code', monospace\`,
  };
}

`;

fs.writeFileSync(targetPath, before + newCreateAppTheme + after, 'utf8');
console.log("theme.js patched successfully.");
