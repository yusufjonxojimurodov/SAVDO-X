const bot = require("../../core/bot.js")

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

module.exports = { sendMainMenu, USER_MENU };