const User = require("../../../models/userRegister.js");
const { sendMainMenu } = require("./command.js");
const { sendAdminMenu } = require("../admin/adminMenuHandler.js");

const userSteps = {};

function updateHandler(bot) {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (text === "Ma'lumotlarni yangilash📝") {
      const user = await User.findOne({ chatId });
      if (!user) {
        return bot.sendMessage(
          chatId,
          "❌ Siz ro‘yxatdan o‘tmagansiz. /start ni bosing."
        );
      }

      user.userName = msg.from.username;
      await user.save();

      await bot.sendMessage(chatId, "🔑 Yangi parolni kiriting:");
      userSteps[chatId] = "updatePassword";
      return;
    }

    if (userSteps[chatId] === "updatePassword") {
      const user = await User.findOne({ chatId });
      if (!user) return;

      user.password = text;
      await user.save();

      delete userSteps[chatId];

      await bot.sendMessage(
        chatId,
        "✅ Ma’lumotlaringiz muvaffaqiyatli yangilandi!"
      );

      const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

      if (chatId === ADMIN_CHAT_ID) {
        return sendAdminMenu(bot, chatId);
      } else {
        return sendMainMenu(chatId, username);
      }
    }
  });
}

module.exports = updateHandler;
