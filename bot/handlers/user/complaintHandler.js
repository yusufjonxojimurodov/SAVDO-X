const { sendToAdminWithApproveReject } = require("../../../utils/sentToAdmin.js");
const { asAt } = require("../../../utils/format"); 

const userStates = {};

function complaintHandler(bot) {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const username = msg.from?.username;

    const state = userStates[chatId];

    if (text === "Mahsulot egasidan Shikoyat⚠️") {
      userStates[chatId] = { type: "complaint_step1", temp: {} };
      return bot.sendMessage(chatId, "Mahsulot nomini yuboring:");
    }

    if (state?.type === "complaint_step1") {
      state.temp.productName = text;
      state.type = "complaint_step2";
      return bot.sendMessage(
        chatId,
        "Mahsulot yaratuvchisini (@username) yuboring:"
      );
    }

    if (state?.type === "complaint_step2") {
      state.temp.owner = text;
      state.type = "complaint_step3";
      return bot.sendMessage(chatId, "Shikoyat matnini yozing:");
    }

    if (state?.type === "complaint_step3") {
      const extra = `\n*Mahsulot:* ${
        state.temp.productName
      }\n*Yaratuvchi:* ${asAt(state.temp.owner)}`;
      sendToAdminWithApproveReject({
        type: "complaint",
        userChatId: chatId,
        username,
        payload: { text, extra },
      });
      bot.sendMessage(chatId, "Shikoyatingiz adminlarga yuborildi ✅");
      delete userStates[chatId];
    }
  });
}

module.exports = complaintHandler;