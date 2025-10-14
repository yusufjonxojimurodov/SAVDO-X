const { sendToAdminWithApproveReject } = require("../../../utils/sentToAdmin.js");

const userStates = {};

function issueHandler(bot) {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const username = msg.from?.username;

    if (text === "Saytdagi Muammolar🐞") {
      userStates[chatId] = { type: "issue" };
      return bot.sendMessage(
        chatId,
        "Qaysi muammo yuz berdi? Xabar qoldiring:"
      );
    }

    if (userStates[chatId]?.type === "issue") {
      sendToAdminWithApproveReject({
        type: "issue",
        userChatId: chatId,
        username,
        payload: { text },
      });
      bot.sendMessage(chatId, "Xabaringiz adminlarga yuborildi ✅");
      delete userStates[chatId];
    }
  });
}

module.exports = issueHandler;
