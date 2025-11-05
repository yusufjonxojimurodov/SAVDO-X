// websocket/notifications.server.js
const WebSocket = require("ws");

let wss;
const clients = new Map();

function initWebSocket(server) {
  wss = new WebSocket.Server({ server }); // <--- port emas, server

  wss.on("connection", (ws) => {
    console.log("🟢 Yangi foydalanuvchi ulanmoqda...");

    ws.on("message", (msg) => {
      const data = JSON.parse(msg);

      if (data.type === "auth") {
        clients.set(data.userId, ws);
        console.log(`👤 ${data.userId} ulanib oldi`);
        return;
      }

      if (data.type === "notify") {
        const receiver = clients.get(data.to);
        if (receiver && receiver.readyState === WebSocket.OPEN) {
          receiver.send(
            JSON.stringify({
              type: "notification",
              message: data.message,
              time: Date.now(), 
            })
          );
          console.log(`📩 ${data.to} foydalanuvchiga yuborildi`);
        }
      }
    });

    ws.on("close", () => {
      for (const [userId, socket] of clients.entries()) {
        if (socket === ws) {
          clients.delete(userId);
          console.log(`🔴 ${userId} uzildi`);
        }
      }
    });
  });

  console.log("🚀 WebSocket Notification server Express bilan ulandi");
}

module.exports = { initWebSocket, clients };
