import { io } from "socket.io-client";

export const backendUrl = process.env.REACT_APP_SOCKET_ENDPOINT || "";

export const socket = io(
  process.env.REACT_APP_SOCKET_ENDPOINT
    ? process.env.REACT_APP_SOCKET_ENDPOINT
    : typeof window !== "undefined" && window.location && window.location.origin
    ? window.location.origin
    : "",
  {
    transports: ["websocket", "polling"],
    upgrade: true,
    rememberUpgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
    timeout: 10000,
    autoConnect: false
  }
);