async function startDirectChat(
  bot,
  chatId,
  targetChatId,
  targetUsername,
  adminStates
) {
  adminStates[chatId] = {
    type: "waitingDirectMessage",
    targetChatId,
    targetUsername,
  };
  await bot.sendMessage(chatId, "Xabaringizni yozing:");
}

async function handleDirectMessage(bot, msg, adminStates) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const { targetChatId, targetUsername } = adminStates[chatId];

  await bot.sendMessage(targetChatId, `Admin xabari:\n${text}`);
  await bot.sendMessage(
    chatId,
    `Xabar @${
      targetUsername || "foydalanuvchi"
    } ga yuborildi va suhbat tugatildi ✅`
  );

  delete adminStates[chatId];
}

module.exports = { startDirectChat, handleDirectMessage };
