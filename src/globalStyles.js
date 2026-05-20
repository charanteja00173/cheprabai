// globalStyles.js - Global Styles for Futuristic Touch
import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    background: var(--chakra-colors-bg);
    color: var(--chakra-colors-textPrimary);
    transition: background 0.3s ease, color 0.3s ease;
  }

  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--chakra-colors-brandPrimary);
    border-radius: 10px;
  }
`;
