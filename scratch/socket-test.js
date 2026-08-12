const { io } = require("socket.io-client");

const socket = io("http://localhost:4000", {
  transports: ["polling", "websocket"],
});

console.log("Connecting to socket...");

socket.on("connect", () => {
  console.log("Connected to server! ID:", socket.id);

  // Try creating/joining a room directly
  console.log("Emitting joinRoom for room 'testroom123'...");
  socket.emit(
    "joinRoom",
    {
      roomId: "testroom123",
      userName: "Alice",
      securityCode: "Letsdoit",
    },
    (res) => {
      console.log("joinRoom response:", res);
      if (res.success) {
        console.log("SUCCESS!");
      } else {
        console.error("FAILED:", res.error);
      }
      socket.disconnect();
      process.exit(0);
    }
  );
});

socket.on("connect_error", (err) => {
  console.error("Connect error:", err.message);
  process.exit(1);
});
