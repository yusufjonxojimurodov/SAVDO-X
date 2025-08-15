const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/userRegister.js");
const PendingProduct = require("../models/pending.products.js");
const bodyParser = require("body-parser");

const token = process.env.BOT_TOKEN;
const URL = process.env.URL;

if (!token) console.error("BOT_TOKEN topilmadi!");
if (!URL) console.error("URL topilmadi!");

const bot = new TelegramBot(token, { webHook: true });
bot.setWebHook(`${URL}/bot${token}`);

// Telegram webhook uchun raw body middleware
function setupWebhook(app) {
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
}

const userStates = {};
const blockedUsers = {};
const usersInfo = {};

// Bot funksiyalari
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
  const userName = msg.from.username;
  if (!userName) {
    bot.sendMessage(
      chatId,
      "Sizning Telegram username topilmadi. Iltimos, username bilan botga kiring!"
    );
    return;
  }

  bot.sendMessage(chatId, "Iltimos, telefon raqamingizni yuboring:", {
    reply_markup: {
      keyboard: [[{ text: "Telefon raqamni yuborish", request_contact: true }]],
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
    let user = await User.findOne({ userName });
    if (!user) {
      user = new User({ userName, chatId, phone });
      await user.save();
      bot.sendMessage(
        chatId,
        "Telefon raqamingiz va username muvaffaqiyatli saqlandi ✅"
      );
    } else {
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

// callback_query handler
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const [action, pendingId] = data.split("_");

  try {
    const pending = await PendingProduct.findById(pendingId)
      .populate("buyer")
      .populate("product");

    if (!pending) {
      return bot.answerCallbackQuery(query.id, {
        text: "Pending product topilmadi",
      });
    }

    const buyerChatId = pending.buyer?.chatId;

    if (action === "approve") {
      await PendingProduct.findByIdAndDelete(pendingId);
      await bot.editMessageText(`Mahsulot "${pending.name}" tasdiqlandi ✅`, {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
      if (buyerChatId) {
        await bot.sendMessage(
          buyerChatId,
          `Siz sotib olmoqchi bo‘lgan mahsulot "${pending.name}" tasdiqlandi!`
        );
      }
    } else if (action === "reject") {
      await PendingProduct.findByIdAndDelete(pendingId);
      await bot.editMessageText(`Mahsulot "${pending.name}" bekor qilindi ❌`, {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
      if (buyerChatId) {
        await bot.sendMessage(
          buyerChatId,
          `Siz sotib olmoqchi bo‘lgan mahsulot "${pending.name}" sotuvchi tomonidan bekor qilindi.`
        );
      }
    }

    await bot.answerCallbackQuery(query.id);
  } catch (err) {
    console.error("Callback query xato:", err);
    await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
  }
});

console.log("Telegram bot webhook sozlandi ✅");

// EXPORT qilamiz
module.exports = { bot, setupWebhook };
