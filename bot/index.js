require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const bodyParser = require("body-parser");
const User = require("../models/userRegister.js");
const mongoose = require("mongoose");
const PendingProduct = require("../models/pending.products.js");
const axios = require("axios");

const token = process.env.BOT_TOKEN;
const URL = process.env.URL;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID || 0);
const mongoUri = process.env.MONGO_URI;

if (!token) console.error("BOT_TOKEN topilmadi!");
if (!URL) console.error("URL topilmadi!");
if (!ADMIN_CHAT_ID) console.error("ADMIN_CHAT_ID topilmadi yoki noto'g'ri!");

mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ MongoDB ulandi"))
  .catch((err) => console.error("❌ MongoDB xatolik:", err));

const bot = new TelegramBot(token, { webHook: true });
bot.setWebHook(`${URL}/bot${token}`);

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

const userSteps = {};
const userStates = {};
const adminStates = {};
const pendingMap = {};
const sellerAddressMap = {};
const USER_MENU = {
  keyboard: [
    ["Adminga bog‘lanish📲"],
    ["Mahsulot egasidan Shikoyat⚠️"],
    ["Saytdagi Muammolar🐞"],
    ["Saytimizga takliflar📃"],
    ["Savdo X saytida mahsulot sotish🛒"],
    ["Ma'lumotlarni yangilash📝"],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

const ADMIN_MENU = {
  keyboard: [
    ["Adminga bog‘lanish📲"],
    ["Mahsulot egasidan Shikoyat⚠️"],
    ["Saytdagi Muammolar🐞"],
    ["Saytimizga takliflar📃"],
    ["Savdo X saytida mahsulot sotish🛒"],
    ["Foydalanuvchilar ro'yxati"],
    ["Ma'lumotlarni yangilash📝"],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

function sendMainMenu(chatId, userName) {
  const text = `*Salom ${
    userName ? "@" + userName : "foydalanuvchi"
  }!* \nSavdo X telegram botiga Xush Kelibsiz😊!`;
  const options = {
    parse_mode: "Markdown",
    reply_markup: USER_MENU,
  };
  bot.sendMessage(chatId, text, options).catch(console.error);
}

function sendAdminMenu(chatId) {
  const text = "Xush kelibsiz, Admin! Quyidagi menyudan tanlang:";
  bot
    .sendMessage(chatId, text, {
      reply_markup: ADMIN_MENU,
    })
    .catch(console.error);
}

function asAt(username) {
  if (!username) return "Anonim";
  return username.startsWith("@") ? username : "@" + username;
}

function genRequestId() {
  return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

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

function sendMainMenu(chatId, userName) {
  const text = `*Salom ${
    userName ? "@" + userName : "foydalanuvchi"
  }!* \nSavdo X telegram botiga Xush Kelibsiz😊!`;
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: USER_MENU,
  });
}

function sendAdminMenu(chatId) {
  bot.sendMessage(chatId, "Xush kelibsiz, Admin! Quyidagi menyudan tanlang:", {
    reply_markup: ADMIN_MENU,
  });
}

function asAt(username) {
  if (!username) return "Anonim";
  return username.startsWith("@") ? username : "@" + username;
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  let user = await User.findOne({ chatId });

  if (user) {
    bot.sendMessage(chatId, "✅ Siz allaqachon ro‘yxatdan o‘tgansiz!");
    if (user.role === "admin") sendAdminMenu(chatId);
    else sendMainMenu(chatId, username);
    return;
  }

  bot.sendMessage(
    chatId,
    "📱 Salom! Savdo X botiga xush kelibsiz.\nRo‘yxatdan o‘tish uchun telefon raqamingizni yuboring:",
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

  let existingUser = await User.findOne({ phone });

  if (existingUser) {
    bot.sendMessage(
      chatId,
      "✅ Siz avval ro‘yxatdan o‘tibsiz.\nAgar ma’lumotlaringizni yangilamoqchi bo‘lsangiz menyudan 'Ma'lumotlarni yangilash📝' tugmasini bosing."
    );
    if (existingUser.role === "admin") sendAdminMenu(chatId);
    else sendMainMenu(chatId, username);
    return;
  }

  let user = new User({ userName: username, chatId, phone });
  await user.save();

  bot.sendMessage(chatId, "👤 Ismingizni yozing:");
  userSteps[chatId] = "askName";
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const step = userSteps[chatId];

  if (!step) return;
  let user = await User.findOne({ chatId });
  if (!user) return;

  if (step === "askName") {
    user.name = text;
    await user.save();
    bot.sendMessage(chatId, "👤 Familiyangizni yozing:");
    userSteps[chatId] = "askSurname";
  } else if (step === "askSurname") {
    user.surname = text;
    await user.save();
    bot.sendMessage(chatId, "🔑 Parol kiriting (saytga kirish uchun):");
    userSteps[chatId] = "askPassword";
  } else if (step === "askPassword") {
    user.password = text;
    user.role = "customer";
    await user.save();
    delete userSteps[chatId];

    bot.sendMessage(
      chatId,
      "✅ Siz to‘liq ro‘yxatdan o‘tdingiz!\nEndi saytga telefon raqamingiz va parol bilan kira olasiz."
    );
    sendMainMenu(chatId, user.userName);
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (text === "Ma'lumotlarni yangilash📝") {
    let user = await User.findOne({ chatId });
    if (!user) {
      bot.sendMessage(
        chatId,
        "❌ Siz ro‘yxatdan o‘tmagansiz. /start buyrug‘ini bosing."
      );
      return;
    }

    user.userName = msg.from.username;
    await user.save();

    bot.sendMessage(chatId, "🔑 Yangi parolni kiriting:");
    userSteps[chatId] = "updatePassword";
    return;
  }

  const step = userSteps[chatId];
  if (!step) return;
  let user = await User.findOne({ chatId });
  if (!user) return;

  if (step === "updatePassword") {
    user.password = text;
    await user.save();
    delete userSteps[chatId];

    bot.sendMessage(chatId, "✅ Ma’lumotlaringiz muvaffaqiyatli yangilandi!");
    sendMainMenu(chatId, user.userName);
  }
});

function sendToAdminWithApproveReject({ type, userChatId, username, payload }) {
  const requestId = genRequestId();
  pendingMap[requestId] = { type, userChatId, username, payload };

  let title = "";
  if (type === "contact_admin") title = "Adminga bog‘lanish so‘rovi";
  else if (type === "complaint") title = "Mahsulot egasidan shikoyat";
  else if (type === "issue") title = "Saytdagi muammo xabari";
  else if (type === "suggestion") title = "Saytga taklif";

  const text =
    `🆕 *${title}*\n` +
    `*Foydalanuvchi:* ${asAt(username)}\n` +
    `*Xabar:* ${payload.text}` +
    (payload.extra ? `\n${payload.extra}` : "");

  bot.sendMessage(ADMIN_CHAT_ID, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Tasdiqlash ✅",
            callback_data: `admin_approve_${requestId}`,
          },
          {
            text: "Bekor qilish ❌",
            callback_data: `admin_reject_${requestId}`,
          },
        ],
      ],
    },
  });
}

bot.on("message", async (msg) => {
  if (msg.contact) return;

  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const username = msg.from?.username;

  if (userStates[chatId]?.type === "waitingCancelReason") {
    const { pendingId } = userStates[chatId];
    try {
      const pending = await PendingProduct.findById(pendingId)
        .populate("buyer")
        .populate("product");

      if (!pending) {
        await bot.sendMessage(chatId, "Pending product topilmadi.");
        delete userStates[chatId];
        return;
      }

      if (pending.buyer?.chatId) {
        await bot.sendMessage(
          pending.buyer.chatId,
          `Siz sotib olmoqchi bo‘lgan mahsulot "${pending.name}" bekor qilindi.\nSababi: ${text}`
        );
      }

      await bot.sendMessage(
        chatId,
        `Mahsulot "${pending.name}" bekor qilindi ❌\nSababi: ${text}`
      );

      await PendingProduct.findByIdAndDelete(pendingId);
      delete userStates[chatId];
      return;
    } catch (err) {
      console.error("Bekor qilish xato:", err);
      await bot.sendMessage(chatId, "Xatolik yuz berdi.");
      delete userStates[chatId];
      return;
    }
  }

  if (chatId === ADMIN_CHAT_ID) {
    if (text === "Foydalanuvchilar ro'yxati") {
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
      return;
    }

    if (adminStates[chatId]?.type === "waitingDirectMessage") {
      const { targetChatId, targetUsername } = adminStates[chatId];

      await bot.sendMessage(targetChatId, `Admin xabari:\n${text}`);

      await bot.sendMessage(
        chatId,
        `Xabar @${
          targetUsername || "foydalanuvchi"
        } ga yuborildi va suhbat tugatildi ✅`
      );

      delete adminStates[chatId];
      return;
    }

    if (adminStates[chatId]?.type === "waitingAdminReply") {
      const { requestId } = adminStates[chatId];
      const req = pendingMap[requestId];
      if (!req) {
        await bot.sendMessage(
          chatId,
          "So'rov topilmadi yoki allaqachon yakunlangan."
        );
        delete adminStates[chatId];
        return;
      }

      await bot.sendMessage(
        req.userChatId,
        `Admin sizning xabaringizni qabul qildi ✅\nJavobi: ${text}`
      );

      await bot.sendMessage(chatId, "Javob yuborildi va suhbat yakunlandi ✅");

      delete pendingMap[requestId];
      delete adminStates[chatId];
      return;
    }

    return;
  }

  if (text === "Adminga bog‘lanish📲") {
    userStates[chatId] = { type: "contactAdmin" };
    await bot.sendMessage(chatId, "Xabaringizni yozing — adminga yuboramiz:");
    return;
  }

  if (text === "Mahsulot egasidan Shikoyat⚠️") {
    userStates[chatId] = { type: "complaint_step1", temp: {} };
    await bot.sendMessage(chatId, "Mahsulot nomini yuboring:");
    return;
  }

  if (text === "Saytdagi Muammolar🐞") {
    userStates[chatId] = { type: "issue" };
    await bot.sendMessage(chatId, "Qaysi muammo yuz berdi? Xabar qoldiring:");
    return;
  }

  if (text === "Saytimizga takliflar📃") {
    userStates[chatId] = { type: "suggestion" };
    await bot.sendMessage(chatId, "Taklifingizni yozing:");
    return;
  }

  if (text === "Savdo X saytida mahsulot sotish🛒") {
    userStates[chatId] = { type: "contactAdmin" };
    await bot.sendMessage(
      chatId,
      "Mahsulot sotish bo‘yicha xabaringizni yozing — adminga yuboramiz:"
    );
    return;
  }

  const uState = userStates[chatId];

  if (uState?.type === "contactAdmin") {
    sendToAdminWithApproveReject({
      type: "contact_admin",
      userChatId: chatId,
      username,
      payload: { text },
    });
    await bot.sendMessage(
      chatId,
      "Xabaringiz adminlarga yuborildi. Javobni kuting ✅"
    );
    delete userStates[chatId];
    return;
  }

  if (uState?.type === "complaint_step1") {
    uState.temp.productName = text;
    uState.type = "complaint_step2";
    await bot.sendMessage(
      chatId,
      "Mahsulot yaratuvchisini (@username) yuboring:"
    );
    return;
  }
  if (uState?.type === "complaint_step2") {
    uState.temp.owner = text;
    uState.type = "complaint_step3";
    await bot.sendMessage(chatId, "Shikoyat matnini yozing:");
    return;
  }
  if (uState?.type === "complaint_step3") {
    const payloadText = text;
    const extra = `\n*Mahsulot:* ${
      uState.temp.productName
    }\n*Yaratuvchi:* ${asAt(uState.temp.owner)}`;

    sendToAdminWithApproveReject({
      type: "complaint",
      userChatId: chatId,
      username,
      payload: { text: payloadText, extra },
    });

    await bot.sendMessage(
      chatId,
      "Shikoyatingiz adminlarga yuborildi. Javobni kuting ✅"
    );
    delete userStates[chatId];
    return;
  }

  if (uState?.type === "issue") {
    sendToAdminWithApproveReject({
      type: "issue",
      userChatId: chatId,
      username,
      payload: { text },
    });
    await bot.sendMessage(
      chatId,
      "Xabaringiz adminlarga yuborildi. Javobni kuting ✅"
    );
    delete userStates[chatId];
    return;
  }

  if (uState?.type === "suggestion") {
    sendToAdminWithApproveReject({
      type: "suggestion",
      userChatId: chatId,
      username,
      payload: { text },
    });
    await bot.sendMessage(
      chatId,
      "Taklifingiz adminlarga yuborildi. Javobni kuting ✅"
    );
    delete userStates[chatId];
    return;
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data || "";

  if (chatId !== ADMIN_CHAT_ID) {
    await bot.answerCallbackQuery(query.id, { text: "Ruxsat yo'q." });
    return;
  }

  if (data.startsWith("pick_user_")) {
    const [, , targetChatIdStr, targetUsernameRaw] = data.split("_");
    const targetChatId = Number(targetChatIdStr);
    const targetUsername = targetUsernameRaw || "";

    adminStates[chatId] = {
      type: "selectedUser",
      targetChatId,
      targetUsername,
    };

    await bot.sendMessage(
      chatId,
      `Tanlangan foydalanuvchi: ${asAt(targetUsername)}\nNimani qilamiz?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Xabar yozish 📝",
                callback_data: `start_chat_${targetChatId}`,
              },
            ],
            [{ text: "Suhbatni tugatish ❌", callback_data: `end_chat` }],
          ],
        },
      }
    );

    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data.startsWith("start_chat_")) {
    const [, , targetChatIdStr] = data.split("_");
    const targetChatId = Number(targetChatIdStr);

    const st = adminStates[chatId];
    if (!st || st.type !== "selectedUser" || st.targetChatId !== targetChatId) {
      await bot.answerCallbackQuery(query.id, { text: "Sessiya topilmadi." });
      return;
    }

    adminStates[chatId] = {
      type: "waitingDirectMessage",
      targetChatId,
      targetUsername: st.targetUsername,
    };

    await bot.sendMessage(chatId, "Xabaringizni yozing:");
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data === "end_chat") {
    delete adminStates[chatId];
    await bot.sendMessage(chatId, "Suhbat tugatildi ✅");
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data.startsWith("admin_approve_") || data.startsWith("admin_reject_")) {
    const parts = data.split("_");
    const action = parts.slice(0, 2).join("_");
    const requestId = parts.slice(2).join("_");

    const req = pendingMap[requestId];
    if (!req) {
      await bot.answerCallbackQuery(query.id, { text: "So'rov topilmadi." });
      return;
    }

    if (action === "admin_approve") {
      adminStates[chatId] = { type: "waitingAdminReply", requestId };
      await bot.sendMessage(
        chatId,
        "Xabaringizni yozing (foydalanuvchiga yuboriladi):"
      );
    } else {
      await bot.sendMessage(
        req.userChatId,
        "Sizning murojaatingiz bekor qilindi ❌"
      );
      delete pendingMap[requestId];
      await bot.sendMessage(chatId, "Bekor qilindi va yakunlandi.");
    }

    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data.startsWith("send_reply_")) {
    const requestId = data.replace("send_reply_", "");
    const req = pendingMap[requestId];

    if (!req) {
      await bot.answerCallbackQuery(query.id, { text: "So'rov topilmadi." });
      return;
    }

    adminStates[chatId] = { type: "waitingAdminReply", requestId };
    await bot.sendMessage(chatId, "Javob matnini kiriting:");
    await bot.answerCallbackQuery(query.id);
    return;
  }

  await bot.answerCallbackQuery(query.id).catch(() => {});
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data.startsWith("approve_")) {
      const [action, ...idParts] = data.split("_");
      const pendingId = idParts.join("_").trim();

      sellerAddressMap[chatId] = { pendingId, step: "waiting_address" };
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      );

      await bot.sendMessage(
        chatId,
        "✅ Buyurtma tasdiqlandi.\n📍 Iltimos, mijoz manzilini kiriting:"
      );
    }

    if (data.startsWith("reject_")) {
      const [action, ...idParts] = data.split("_");
      const pendingId = idParts.join("_").trim();

      sellerAddressMap[chatId] = { pendingId, step: "waiting_cancel_reason" };

      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      );

      await bot.sendMessage(
        chatId,
        "❌ Buyurtma bekor qilinmoqda. Iltimos, bekor qilish sababini kiriting:"
      );
    }
  } catch (err) {
    console.error("Callback xatolik:", err.message);
    await bot.sendMessage(
      chatId,
      "⚠️ Xatolik yuz berdi. Keyinroq urinib ko‘ring."
    );
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!sellerAddressMap[chatId]) return;

  const { pendingId, step } = sellerAddressMap[chatId];

  if (step === "waiting_address") {
    try {
      const pendingOrderResponse = await axios.get(
        `${process.env.API_URL}/pending/products/pending/products/${pendingId}`
      );
      const customerChatId = pendingOrderResponse.data.customerChatId;

      await axios.post(
        `${
          process.env.API_URL
        }/delivery/products/add/${pendingId}/${encodeURIComponent(text)}`,
        { sellerBot: true }
      );

      await bot.sendMessage(
        chatId,
        "🚚 Mahsulot yetkazish jarayoniga o‘tkazildi!"
      );

      if (customerChatId) {
        await bot.sendMessage(
          customerChatId,
          `🚚 Sizning buyurtmangiz yetkazish jarayoniga o‘tkazildi!`
        );
      } else {
        console.error("❌ Customer chatId topilmadi!");
      }
    } catch (err) {
      bot.sendMessage(
        chatId,
        "Mahsulot Savdo X saytidagi operatorlaringiz tomonidan Tasdiqlangan✅ yoki Bekor qilingan❌ yoki adminga murojaatga chiqing👨‍💻"
      );
      console.log(
        "❌ Approve qadamida xato:",
        err.response?.data || err.message
      );
    }

    delete sellerAddressMap[chatId];
  }

  if (step === "waiting_cancel_reason") {
    try {
      const pendingOrderResponse = await axios.get(
        `${process.env.API_URL}/pending/products/pending/products/${pendingId}?sellerBot=true`
      );
      const customerChatId = pendingOrderResponse.data.customerChatId;

      await bot.sendMessage(chatId, "❌ Buyurtma bekor qilindi!");

      if (customerChatId) {
        await bot.sendMessage(
          customerChatId,
          `❌ Sizning buyurtmangiz bekor qilindi. Sabab: ${text}`
        );
      }

      await axios.delete(
        `${process.env.API_URL}/pending/products/delete/${pendingId}?sellerBot=true`
      );
    } catch (err) {
      bot.sendMessage(
        chatId,
        "Mahsulot Savdo X saytidagi operatorlaringiz tomonidan Tasdiqlangan✅ yoki Bekor qilingan❌ yoki adminga murojaatga chiqing👨‍💻"
      );
      console.log(
        "❌ Cancel qadamida xato:",
        err.response?.data || err.message
      );
    }

    delete sellerAddressMap[chatId];
  }
});

module.exports = { bot, setupWebhook };
