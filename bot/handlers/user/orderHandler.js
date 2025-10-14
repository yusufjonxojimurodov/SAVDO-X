const axios = require("axios");

const userOrderState = {};

function orderHandler(bot) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
      if (data.startsWith("approve_")) {
        const [_, pendingId] = data.split("_");

        userOrderState[chatId] = { pendingId, step: "waitingAddress" };

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
        const [_, pendingId] = data.split("_");

        userOrderState[chatId] = { pendingId, step: "waitingCancelReason" };

        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          {
            chat_id: chatId,
            message_id: query.message.message_id,
          }
        );

        await bot.sendMessage(
          chatId,
          "❌ Buyurtma bekor qilinmoqda. Iltimos, bekor qilish sababini yozing:"
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
    const text = msg.text?.trim();
    const state = userOrderState[chatId];

    if (!state) return;

    const { pendingId, step } = state;

    if (step === "waitingAddress") {
      try {
        const res = await axios.get(
          `${process.env.API_URL}/pending/products/pending/products/${pendingId}`
        );
        const customerChatId = res.data.customerChatId;

        await axios.post(
          `${
            process.env.API_URL
          }/delivery/products/add/${pendingId}/${encodeURIComponent(text)}`,
          { sellerBot: true }
        );

        await bot.sendMessage(
          chatId,
          "🚚 Buyurtma yetkazish jarayoniga o‘tkazildi!"
        );

        if (customerChatId) {
          await bot.sendMessage(
            customerChatId,
            "🚚 Sizning buyurtmangiz yetkazish jarayoniga o‘tkazildi!"
          );
        } else {
          console.error("❌ Customer chatId topilmadi!");
        }
      } catch (err) {
        await bot.sendMessage(
          chatId,
          "❗ Bu buyurtma allaqachon qayta ishlangan yoki xatolik yuz berdi."
        );
        console.log("Approve xato:", err.response?.data || err.message);
      }

      delete userOrderState[chatId];
    }

    if (step === "waitingCancelReason") {
      try {
        const res = await axios.get(
          `${process.env.API_URL}/pending/products/pending/products/${pendingId}?sellerBot=true`
        );
        const customerChatId = res.data.customerChatId;

        await bot.sendMessage(chatId, "❌ Buyurtma bekor qilindi!");

        if (customerChatId) {
          await bot.sendMessage(
            customerChatId,
            `❌ Sizning buyurtmangiz bekor qilindi.\n📝 Sabab: ${text}`
          );
        }

        await axios.delete(
          `${process.env.API_URL}/pending/products/delete/${pendingId}?sellerBot=true`
        );
      } catch (err) {
        await bot.sendMessage(
          chatId,
          "❗ Buyurtmani bekor qilishda xatolik. Iltimos, adminga murojaat qiling."
        );
        console.log("Cancel xato:", err.response?.data || err.message);
      }

      delete userOrderState[chatId];
    }
  });
}

module.exports = orderHandler;