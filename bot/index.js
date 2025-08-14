require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const User = require("../models/userRegister.js");
const Product = require("../models/products");
const PendingProduct = require("../models/pending.products");

const token = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);
const PORT = process.env.PORT || 3000;
const URL = process.env.URL || "https://2fd3fb43a613.ngrok-free.app";

const bot = new TelegramBot(token, { webHook: true });
bot.setWebHook(`${URL}/bot${token}`);

const app = express();
app.use(bodyParser.json());

// Webhook endpoint
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// NEW ORDER: Telegramga xabar yuborish
app.post("/new-order", async (req, res) => {
  const { sellerUserName, buyerId, productName, quantity, phone } = req.body;

  try {
    const seller = await User.findOne({ userName: sellerUserName });
    const buyer = await User.findById(buyerId);

    if (!seller || !seller.chatId) {
      return res.status(400).json({ message: "Seller chatId topilmadi" });
    }

    if (!buyer) {
      return res.status(400).json({ message: "Buyer topilmadi" });
    }

    await bot.sendMessage(
      seller.chatId,
      `📦 Yangi buyurtma!\nMijoz: ${
        buyer.name || buyer.userName
      }\nMahsulot: ${productName}\nSoni: ${quantity}\nTelefon: ${phone}\n\n✅ Tasdiqlash yoki ❌ Bekor qilish uchun tugmalarni bosing.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Tasdiqlash ✅",
                callback_data: `approve_${buyerId}_${productName}_${quantity}`,
              },
              {
                text: "Bekor qilish ❌",
                callback_data: `reject_${buyerId}_${productName}_${quantity}`,
              },
            ],
          ],
        },
      }
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Xabar yuborilmadi:", err.message);
    res.status(500).json({ message: "Xabar yuborilmadi" });
  }
});

// Telegram bot callback logikasi (tasdiqlash/ bekor qilish)
bot.on("callback_query", async (callbackQuery) => {
  const data = callbackQuery.data;
  const [action, buyerId, productName, quantityStr] = data.split("_");
  const quantity = Number(quantityStr);

  const buyer = await User.findById(buyerId);
  const product = await Product.findOne({ name: productName });

  if (!buyer || !product) {
    bot.sendMessage(
      callbackQuery.from.id,
      "Xatolik: Buyer yoki product topilmadi."
    );
    return bot.answerCallbackQuery(callbackQuery.id);
  }

  if (action === "approve") {
    // Product left kamaytirish
    product.left = product.left - quantity;
    if (product.left < 0) product.left = 0;
    await product.save();

    bot.sendMessage(callbackQuery.from.id, `Siz buyurtmani tasdiqladingiz ✅`);
    bot.sendMessage(
      buyer.chatId,
      `📦 Sizning buyurtmangiz tasdiqlandi ✅\nMahsulot: ${productName}\nSoni: ${quantity}`
    );
  } else if (action === "reject") {
    bot.sendMessage(callbackQuery.from.id, `Siz buyurtmani bekor qildingiz ❌`);
    bot.sendMessage(
      buyer.chatId,
      `❌ Sizning buyurtmangiz bekor qilindi\nMahsulot: ${productName}\nSoni: ${quantity}`
    );
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

const userStates = {};
const adminReplyingTo = {};
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
  const userName = msg.from.first_name || "Foydalanuvchi";
  const username = msg.from.username || "username yo‘q";

  usersInfo[chatId] = { username, first_name: userName };

  try {
    const user = await User.findOne({ userName: username });
    if (user) {
      user.chatId = chatId;
      await user.save();
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
  else sendMainMenu(chatId, userName);

  userStates[chatId] = null;
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const username = msg.from.username || msg.from.first_name || "username yo‘q";

  if (blockedUsers[chatId] || !text) return;

  // boshqa menyular logikasi shu yerda qoladi
  // ...
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti ✅`);
});
