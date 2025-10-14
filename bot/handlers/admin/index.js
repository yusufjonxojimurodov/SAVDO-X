const { sendAdminMenu } = require("./adminMenuHandler");
const { handleUserList } = require("./adminUserListHandler");
const { startBroadcast, handleBroadcast } = require("./adminBroadCastHandler");
const {
  startDirectChat,
  handleDirectMessage,
} = require("./adminDirectHandler");
const { handleAdminReply } = require("./adminReplyHandler");
const { handleApproveReject } = require("./adminApprovRejectHandler");

const adminStates = {};

function setupAdminHandlers(bot, ADMIN_CHAT_ID) {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (String(chatId) !== String(ADMIN_CHAT_ID)) return;

    if (text === "Foydalanuvchilar ro'yxati")
      return handleUserList(bot, chatId);
    if (text === "Barcha userlarga xabar yozish")
      return startBroadcast(bot, chatId, adminStates);
    if (adminStates[chatId]?.type === "waitingBroadcastMessage")
      return handleBroadcast(bot, msg, adminStates);
    if (adminStates[chatId]?.type === "waitingDirectMessage")
      return handleDirectMessage(bot, msg, adminStates);
    if (adminStates[chatId]?.type === "waitingAdminReply")
      return handleAdminReply(bot, msg, adminStates);
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    if (String(chatId) !== String(ADMIN_CHAT_ID)) return;
    await handleApproveReject(bot, query, adminStates);
  });
}

module.exports = { setupAdminHandlers, adminStates };
