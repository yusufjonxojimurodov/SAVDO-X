async function handleApproveReject(bot, query, adminStates) {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("approve_")) {
    const userId = data.split("_")[1];
    await bot.sendMessage(chatId, `✅ Foydalanuvchi ${userId} tasdiqlandi.`);
  }

  if (data.startsWith("reject_")) {
    const userId = data.split("_")[1];
    await bot.sendMessage(chatId, `❌ Foydalanuvchi ${userId} rad etildi.`);
  }
}

module.exports = { handleApproveReject };
