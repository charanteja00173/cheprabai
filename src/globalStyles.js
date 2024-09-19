// globalStyles.js - Global Styles for Futuristic Touch
import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: 'Roboto', sans-serif;
    background: ${({ theme }) => theme.background};
    color: ${({ theme }) => theme.secondaryColor};
    transition: background 0.3s ease, color 0.3s ease;
  }

  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.primaryColor};
    border-radius: 10px;
  }

  input, button {
    font-family: 'Roboto', sans-serif;
  }
`;
