const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/userRegister.js");
const Product = require("../models/products.js");
const bodyParser = require("body-parser");

module.exports = (app) => {
  const token = process.env.BOT_TOKEN;
  const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);
  const URL = process.env.URL;

  if (!token) {
    console.error("BOT_TOKEN topilmadi! Iltimos .env faylga qo'shing.");
    return;
  }
  if (!URL) {
    console.error("URL topilmadi! Iltimos .env faylga qo'shing.");
    return;
  }

  const bot = new TelegramBot(token, { webHook: true });
  bot.setWebHook(`${URL}/bot${token}`);

  // Telegram webhook uchun raw body
  app.use(
    `/bot${token}`,
    bodyParser.json({
      verify: (req, res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );

  app.post(`/bot${token}`, (req, res) => {
    try {
      const update = JSON.parse(req.rawBody);
      bot.processUpdate(update);
      res.sendStatus(200);
    } catch (err) {
      console.error("Telegram update xato:", err);
      res.sendStatus(500);
    }
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
    bot.sendMessage(chatId, text, options).catch(console.error);
  }

  function sendAdminMenu(chatId) {
    const text = "Xush kelibsiz, Admin! Quyidagi menyudan tanlang:";
    bot
      .sendMessage(chatId, text, {
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
      })
      .catch(console.error);
  }

  // /start komandasi
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.username; // Telegram username

    if (!userName) {
      bot.sendMessage(
        chatId,
        "Sizning Telegram username topilmadi. Iltimos, username bilan botga kiring!"
      );
      return;
    }

    // Foydalanuvchiga telefon raqamini yuborish tugmasi
    bot.sendMessage(chatId, "Iltimos, telefon raqamingizni yuboring:", {
      reply_markup: {
        keyboard: [
          [{ text: "Telefon raqamni yuborish", request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  });

  // Contact kelganda saqlash
  bot.on("contact", async (msg) => {
    const chatId = msg.chat.id;
    const phone = msg.contact.phone_number;
    const userName = msg.from.username;

    if (!userName) {
      bot.sendMessage(
        chatId,
        "Username topilmadi, botni username bilan ishlating."
      );
      return;
    }

    try {
      // userName bo'yicha tekshirish
      let user = await User.findOne({ userName });

      if (!user) {
        // Foydalanuvchi mavjud bo'lmasa, yangi yaratish
        user = new User({ userName, chatId, phone });
        await user.save();
        bot.sendMessage(
          chatId,
          "Telefon raqamingiz va username muvaffaqiyatli saqlandi ✅"
        );
      } else {
        // Foydalanuvchi allaqachon bo'lsa, chatId va phone yangilansin
        user.chatId = chatId;
        user.phone = phone;
        await user.save();
        bot.sendMessage(chatId, "Telefon raqamingiz yangilandi ✅");
      }
    } catch (err) {
      console.error("Foydalanuvchi saqlanmadi:", err.message);
      bot.sendMessage(chatId, `Xatolik yuz berdi: ${err.message}`);
    }
  });

  bot.on("message", (msg) => {
    if (!msg || !msg.chat || !msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text;

    if (blockedUsers[chatId] || !text) return;

    // Boshqa menyu logikasi shu yerda qoladi
    // Masalan: "Adminga bog‘lanish📲" ni qayta ishlash
  });

  console.log("Telegram bot webhook sozlandi ✅");
};
