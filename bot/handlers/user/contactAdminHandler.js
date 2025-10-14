const { sendToAdminWithApproveReject } = require("../../../utils/sentToAdmin.js");
const userStates = {};

function contactAdminHandler(bot) {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const username = msg.from?.username;

    if (text === "Adminga bog‘lanish📲") {
      userStates[chatId] = { type: "contactAdmin" };
      return bot.sendMessage(
        chatId,
        "Xabaringizni yozing — adminga yuboramiz:"
      );
    }

    if (userStates[chatId]?.type === "contactAdmin") {
      sendToAdminWithApproveReject({
        type: "contact_admin",
        userChatId: chatId,
        username,
        payload: { text },
      });
      bot.sendMessage(chatId, "Xabaringiz adminlarga yuborildi ✅");
      delete userStates[chatId];
    }
  });
}

module.exports = contactAdminHandler;
