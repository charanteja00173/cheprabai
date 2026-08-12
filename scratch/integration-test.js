const axios = require("axios");
const { io } = require("socket.io-client");

const backendUrl = "http://localhost:4000";

async function run() {
  console.log("1. Logging in as admin...");
  let adminToken;
  try {
    const loginRes = await axios.post(`${backendUrl}/api/admin/login`, {
      password: "Admin",
    });
    adminToken = loginRes.data.token;
    console.log("Logged in! Token:", adminToken);
  } catch (err) {
    console.error("Admin login failed:", err.message);
    process.exit(1);
  }

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  console.log("2. Setting requireRoomApproval to true...");
  try {
    await axios.patch(
      `${backendUrl}/api/admin/settings`,
      { requireRoomApproval: true },
      { headers: authHeaders }
    );
    console.log("requireRoomApproval set to true");
  } catch (err) {
    console.error("Failed to patch settings:", err.message);
    process.exit(1);
  }

  console.log("3. Connecting socket client...");
  const socket = io(backendUrl, {
    transports: ["polling", "websocket"],
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err.message);
    process.exit(1);
  });

  socket.on("connect", () => {
    console.log("Socket connected! ID:", socket.id);

    console.log("4. Attempting joinRoom directly (should be blocked)...");
    socket.emit(
      "joinRoom",
      {
        roomId: "testroom-approved-flow",
        userName: "Bob",
        securityCode: "Letsdoit",
      },
      async (res) => {
        console.log("joinRoom result:", res);
        if (res?.code !== "NEEDS_APPROVAL") {
          console.error("ERROR: Expected NEEDS_APPROVAL but got:", res);
          process.exit(1);
        }
        console.log("Success: Join was blocked correctly with NEEDS_APPROVAL");

        // Now listen for resolution
        socket.on("roomRequestResolved", async (data) => {
          console.log("Received roomRequestResolved socket event:", data);
          if (data.status === "approved" && data.roomId === "testroom-approved-flow") {
            console.log("Socket event verified! Now attempting joinRoom again...");
            socket.emit(
              "joinRoom",
              {
                roomId: "testroom-approved-flow",
                userName: "Bob",
                securityCode: "Letsdoit",
              },
              async (joinRes) => {
                console.log("joinRoom after approval result:", joinRes);
                if (joinRes?.success) {
                  console.log("Successfully joined the approved room!");
                  
                  // Reset settings to false
                  console.log("Resetting requireRoomApproval to false...");
                  await axios.patch(
                    `${backendUrl}/api/admin/settings`,
                    { requireRoomApproval: false },
                    { headers: authHeaders }
                  );
                  console.log("INTEGRATION TEST PASSED SUCCESSFULLY!");
                  socket.disconnect();
                  process.exit(0);
                } else {
                  console.error("Failed to join after approval:", joinRes);
                  process.exit(1);
                }
              }
            );
          } else {
            console.error("Unexpected socket resolution status:", data);
            process.exit(1);
          }
        });

        console.log("5. Emitting requestRoomCreation...");
        socket.emit(
          "requestRoomCreation",
          {
            roomId: "testroom-approved-flow",
            userName: "Bob",
            personalPassword: "Letsdoit",
          },
          async (reqRes) => {
            console.log("requestRoomCreation response:", reqRes);
            if (!reqRes?.success) {
              console.error("Failed to create room request:", reqRes);
              process.exit(1);
            }
            const requestId = reqRes.requestId;
            console.log("Request created! ID:", requestId);

            // Fetch pending requests via Admin API
            console.log("6. Admin fetching requests...");
            const reqsRes = await axios.get(`${backendUrl}/api/admin/room-requests`, {
              headers: authHeaders,
            });
            const pendingReq = reqsRes.data.requests.find((r) => r.id === requestId);
            console.log("Found pending request:", pendingReq);

            if (!pendingReq || pendingReq.status !== "pending") {
              console.error("ERROR: request is not pending in admin console!");
              process.exit(1);
            }

            // Approve the request
            console.log("7. Admin approving request...");
            const approveRes = await axios.post(
              `${backendUrl}/api/admin/room-requests/${requestId}/approve`,
              {},
              { headers: authHeaders }
            );
            console.log("Approve response:", approveRes.data);
          }
        );
      }
    );
  });
}

run();
