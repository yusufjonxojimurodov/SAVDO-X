const ADMIN_MENU = {
  keyboard: [
    ["Foydalanuvchilar ro'yxati"],
    ["Barcha userlarga xabar yozish"],
    ["Ma'lumotlarni yangilash📝"],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

function sendAdminMenu(bot, chatId) {
  const text = "Xush kelibsiz, Admin! Quyidagi menyudan tanlang:";
  bot.sendMessage(chatId, text, {
    reply_markup: ADMIN_MENU,
  });
}

module.exports = { sendAdminMenu };
