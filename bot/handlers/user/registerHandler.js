const User = require("../../../models/userRegister.js");
const { sendMainMenu } = require("./command.js");
const { sendAdminMenu } = require("../admin/adminMenuHandler.js");

const userSteps = {};

function registerHandler(bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;

    let user = await User.findOne({ chatId });
    if (user) {
      await bot.sendMessage(chatId, "✅ Siz allaqachon ro‘yxatdan o‘tgansiz!");
      const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

      if (chatId === ADMIN_CHAT_ID) {
        return sendAdminMenu(bot, chatId);
      } else {
        return sendMainMenu(chatId, username);
      }
    }

    await bot.sendMessage(
      chatId,
      "📱 Salom! Ro‘yxatdan o‘tish uchun telefon raqamingizni yuboring:",
      {
        reply_markup: {
          keyboard: [
            [{ text: "📲 Telefon raqamni yuborish", request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
  });

  bot.on("contact", async (msg) => {
    const chatId = msg.chat.id;
    const phone = msg.contact?.phone_number;
    const username = msg.from.username;

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      await bot.sendMessage(chatId, "✅ Siz avval ro‘yxatdan o‘tibsiz!");
      return sendMainMenu(chatId, username);
    }

    const user = new User({ userName: username, chatId, phone });
    await user.save();

    await bot.sendMessage(chatId, "👤 Ismingizni yozing:");
    userSteps[chatId] = "askName";
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const step = userSteps[chatId];
    if (!step || msg.contact) return;

    const user = await User.findOne({ chatId });
    if (!user) return;

    if (step === "askName") {
      user.name = text;
      await user.save();
      await bot.sendMessage(chatId, "👤 Familiyangizni yozing:");
      userSteps[chatId] = "askSurname";
    } else if (step === "askSurname") {
      user.surname = text;
      await user.save();
      await bot.sendMessage(chatId, "🔑 Parol kiriting (saytga kirish uchun):");
      userSteps[chatId] = "askPassword";
    } else if (step === "askPassword") {
      user.password = text;
      user.role = "customer";
      await user.save();

      delete userSteps[chatId];

      await bot.sendMessage(chatId, "✅ Siz to‘liq ro‘yxatdan o‘tdingiz!");
      const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

      if (chatId === ADMIN_CHAT_ID) {
        return sendAdminMenu(bot, chatId);
      } else {
        return sendMainMenu(chatId, username);
      }
    }
  });
}

module.exports = registerHandler;
