const bot = require("./core/bot");
const registerUserHandlers = require("./handlers/user");
const { setupAdminHandlers } = require("./handlers/admin");

function initBot() {
  const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

  registerUserHandlers(bot);
  setupAdminHandlers(bot, ADMIN_CHAT_ID);

  console.log("🤖 Bot ishga tushdi va webhook ulandi!");
}

module.exports = { bot, initBot };
