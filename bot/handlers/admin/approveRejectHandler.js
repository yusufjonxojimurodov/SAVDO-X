const pendingProducts = require("../../../models/pending.products.js");

const userStates = {};

function approveRejectHandler(bot) {
  bot.on("message", async (msg) => {
    if (msg.contact) return;

    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (userStates[chatId]?.type === "waitingCancelReason") {
      const { pendingId } = userStates[chatId];

      try {
        const pending = await pendingProducts
          .findById(pendingId)
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
            `❌ Siz sotib olmoqchi bo‘lgan "${pending.name}" mahsuloti bekor qilindi.\nSabab: ${text}`
          );
        }

        await bot.sendMessage(
          chatId,
          `Mahsulot "${pending.name}" bekor qilindi ❌\nSabab: ${text}`
        );

        await pendingProducts.findByIdAndDelete(pendingId);

        delete userStates[chatId];
      } catch (err) {
        console.error("Bekor qilish xato:", err);
        await bot.sendMessage(chatId, "❗ Xatolik yuz berdi.");
        delete userStates[chatId];
      }
    }
  });
}

module.exports = { approveRejectHandler, userStates };
