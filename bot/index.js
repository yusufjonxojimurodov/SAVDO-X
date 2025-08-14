const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/userRegister.js");
const Product = require("../models/products.js");

module.exports = (app) => {
  const token = process.env.BOT_TOKEN;
  const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);
  const URL = process.env.URL;

  const bot = new TelegramBot(token, { webHook: true });
  bot.setWebHook(`${URL}/bot${token}`);

  // Telegram webhook endpoint
  app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  const userStates = {};
  const blockedUsers = {};
  const usersInfo = {};

  function sendMainMenu(chatId, userName) {
    const text = `*Salom ${userName}!* \nSavdo X telegram botiga Xush Kelibsiz😊!`;
    const options = {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          ["Adminga bog‘lanish📲"],
          ["Mahsulot egasidan Shikoyat⚠️"],
          ["Saytdagi Muammolar🐞"],
          ["Saytimizga takliflar📃"],
          ["Savdo X saytida mahsulot sotish🛒"],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };
    bot.sendMessage(chatId, text, options);
  }

  function sendAdminMenu(chatId) {
    const text = "Xush kelibsiz, Admin! Quyidagi menyudan tanlang:";
    bot.sendMessage(chatId, text, {
      reply_markup: {
        keyboard: [
          ["Adminga bog‘lanish📲"],
          ["Mahsulot egasidan Shikoyat⚠️"],
          ["Saytdagi Muammolar🐞"],
          ["Saytimizga takliflar📃"],
          ["Savdo X saytida mahsulot sotish🛒"],
          ["Foydalanuvchilar ro'yxati"],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.username || "username yo‘q";
    const firstName = msg.from.first_name || "Foydalanuvchi";

    usersInfo[chatId] = { username: userName, first_name: firstName };

    try {
      const user = await User.findOne({ userName });
      if (user) {
        user.chatId = chatId;
        await user.save();
      } else {
        bot.sendMessage(
          chatId,
          "Siz hali ro'yxatdan o'tmagansiz. /register orqali ro'yxatdan o'ting."
        );
      }
    } catch (err) {
      console.error("ChatId saqlanmadi:", err.message);
    }

    if (blockedUsers[chatId]) {
      bot.sendMessage(
        chatId,
        "Siz blocklangansiz ❌. Faqat /start buyrug‘ini yuborishingiz mumkin."
      );
      return;
    }

    if (chatId === ADMIN_CHAT_ID) sendAdminMenu(chatId);
    else sendMainMenu(chatId, firstName);

    userStates[chatId] = null;
  });

  bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (blockedUsers[chatId] || !text) return;
    // boshqa menyular logikasi shu yerda qoladi
  });
};
