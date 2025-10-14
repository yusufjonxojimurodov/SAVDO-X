const { pendingMap } = require("../../../utils/sentToAdmin.js");

const adminStates = {};

function adminReplyHandler(bot) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith("admin_reply_")) {
      const requestId = data.split("admin_reply_")[1];
      const req = pendingMap[requestId];

      if (!req) {
        await bot.sendMessage(
          chatId,
          "❌ So‘rov topilmadi yoki allaqachon javob berilgan."
        );
        return;
      }

      adminStates[chatId] = { type: "waitingAdminReply", requestId };
      await bot.sendMessage(chatId, "✏️ Javobingizni kiriting:");
      return;
    }

    if (data.startsWith("admin_reject_")) {
      const requestId = data.split("admin_reject_")[1];
      const req = pendingMap[requestId];
      if (!req) {
        await bot.sendMessage(chatId, "❌ So‘rov topilmadi.");
        return;
      }

      await bot.sendMessage(
        req.userChatId,
        "❌ Sizning so‘rovingiz admin tomonidan rad etildi."
      );
      await bot.sendMessage(chatId, "So‘rov bekor qilindi ❌");

      delete pendingMap[requestId];
      return;
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (adminStates[chatId]?.type === "waitingAdminReply") {
      const { requestId } = adminStates[chatId];
      const req = pendingMap[requestId];

      if (!req) {
        await bot.sendMessage(
          chatId,
          "❌ So‘rov topilmadi yoki allaqachon yakunlangan."
        );
        delete adminStates[chatId];
        return;
      }

      await bot.sendMessage(
        req.userChatId,
        `📨 Admin sizning xabaringizni qabul qildi ✅\n💬 Javobi: ${text}`
      );

      await bot.sendMessage(chatId, "✅ Javob foydalanuvchiga yuborildi!");
      delete pendingMap[requestId];
      delete adminStates[chatId];
    }
  });
}

module.exports = adminReplyHandler;
