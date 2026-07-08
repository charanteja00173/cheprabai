import { io } from "socket.io-client";

export const socket = io(process.env.REACT_APP_SOCKET_ENDPOINT || "http://localhost:4000", {
  transports: ["websocket"],
  autoConnect: false
});