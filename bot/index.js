require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const bodyParser = require("body-parser");
const User = require("../models/userRegister.js");
const PendingProduct = require("../models/pending.products.js");
const token = process.env.BOT_TOKEN;
const URL = process.env.URL;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID || 0);
const axios = require("axios");

if (!token) console.error("BOT_TOKEN topilmadi!");
if (!URL) console.error("URL topilmadi!");
if (!ADMIN_CHAT_ID) console.error("ADMIN_CHAT_ID topilmadi yoki noto'g'ri!");

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

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  if (!username) {
    bot.sendMessage(
      chatId,
      "Sizning Telegram username topilmadi. Iltimos, Telegram sozlamalaridan username o‘rnatib qayta /start yuboring."
    );
    return;
  }

  try {
    let user = await User.findOne({ userName: username });

    if (user && user.phone) {
      if (user.chatId !== chatId) {
        user.chatId = chatId;
        await user.save();
      }
      if (chatId === ADMIN_CHAT_ID) sendAdminMenu(chatId);
      else sendMainMenu(chatId, username);
      return;
    }

    bot.sendMessage(chatId, "Iltimos, telefon raqamingizni yuboring:", {
      reply_markup: {
        keyboard: [
          [{ text: "Telefon raqamni yuborish", request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  } catch (err) {
    console.error("START xato:", err);
    bot.sendMessage(chatId, "Xatolik yuz berdi.");
  }
});

bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact?.phone_number;
  const username = msg.from.username;

  if (!username) {
    bot.sendMessage(
      chatId,
      "Username topilmadi, botni username bilan ishlating."
    );
    return;
  }

  try {
    let user = await User.findOne({ userName: username });
    if (!user) {
      user = new User({ userName: username, chatId, phone });
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

    if (chatId === ADMIN_CHAT_ID) sendAdminMenu(chatId);
    else sendMainMenu(chatId, username);
  } catch (err) {
    console.error("Foydalanuvchi saqlanmadi:", err);
    bot.sendMessage(chatId, `Xatolik yuz berdi: ${err.message}`);
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
      // Admin javob yozishi kerak
      adminStates[chatId] = { type: "waitingAdminReply", requestId };
      await bot.sendMessage(
        chatId,
        "Xabaringizni yozing (foydalanuvchiga yuboriladi):"
      );
    } else {
      // Bekor qilish
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

// Seller approve/reject tugmalari
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("approve_")) {
    // pendingId ni to‘liq olish
    const [action, ...idParts] = data.split("_");
    const pendingId = idParts.join("_");
    console.log("Approve pendingId:", pendingId); //

    // Sellerdan manzil so‘rash
    sellerAddressMap[chatId] = { pendingId, step: "waiting_address" };
    await bot.sendMessage(
      chatId,
      "✅ Buyurtma tasdiqlandi.\n📍 Iltimos, mijoz manzilini kiriting:"
    );
  }

  if (data.startsWith("reject_")) {
    const [action, ...idParts] = data.split("_");
    const pendingId = idParts.join("_");
    try {
      await axios.delete(`${process.env.API_URL}/pending/delete/${pendingId}`, {
        headers: { Authorization: `Bearer ${process.env.SELLER_TOKEN}` },
      });
      await bot.sendMessage(chatId, "❌ Buyurtma bekor qilindi.");
    } catch (err) {
      console.error(err.message);
      await bot.sendMessage(chatId, "Bekor qilishda xatolik yuz berdi.");
    }
  }

  await bot.answerCallbackQuery(query.id);
});

// Seller manzil yuborganda
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (
    sellerAddressMap[chatId] &&
    sellerAddressMap[chatId].step === "waiting_address"
  ) {
    const { pendingId } = sellerAddressMap[chatId];

    try {
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
    } catch (err) {
      console.error(err.message);
      await bot.sendMessage(chatId, "Manzilni saqlashda xatolik yuz berdi.");
    }

    delete sellerAddressMap[chatId];
  }
});

console.log("Telegram bot webhook sozlandi ✅");

module.exports = { bot, setupWebhook };
