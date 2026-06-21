// globalStyles.js - Global Styles for Futuristic Touch
import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  html {
    font-size: clamp(13px, 0.3vw + 13px, 16px);
    -webkit-tap-highlight-color: transparent;
  }

  body {
    margin: 0;
    padding: 0;
    background: var(--chakra-colors-bg);
    color: var(--chakra-colors-textPrimary);
    transition: background 0.3s ease, color 0.3s ease;
    overscroll-behavior-y: contain;
  }

  /* Interactive touch target optimization */
  button, a, input, select, textarea {
    touch-action: manipulation;
  }

  /* Safe Area custom properties */
  :root {
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-right: env(safe-area-inset-right, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left: env(safe-area-inset-left, 0px);
  }

  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--chakra-colors-brandPrimary);
    border-radius: 10px;
  }
`;
