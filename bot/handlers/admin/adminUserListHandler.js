const User = require("../../../models/userRegister.js");
const { asAt } = require("../../../utils/format.js");

async function handleUserList(bot, chatId) {
  try {
    const users = await User.find({}).select("userName chatId").lean();

    if (!users.length) {
      await bot.sendMessage(chatId, "Hozircha foydalanuvchilar yo‘q.");
      return;
    }

    const rows = users.map((u) => [
      {
        text: asAt(u.userName),
        callback_data: `pick_user_${u.chatId}_${u.userName || ""}`,
      },
    ]);

    await bot.sendMessage(chatId, "Foydalanuvchilar ro‘yxati:", {
      reply_markup: { inline_keyboard: rows },
    });
  } catch (err) {
    console.error("User list xato:", err);
    await bot.sendMessage(chatId, "Xatolik yuz berdi.");
  }
}

module.exports = { handleUserList };
