const registerHandler = require("./registerHandler.js");
const contactAdminHandler = require("./contactAdminHandler");
const complaintHandler = require("./complaintHandler");
const issueHandler = require("./issueHandler");
const { sendMainMenu } = require("./command");
const { sendAdminMenu } = require("../admin/adminMenuHandler.js");
const updateHandler = require("./updateHandler");
const orderHandler = require("./orderHandler");

function registerUserHandlers(bot) {
  const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
  });

  registerHandler(bot);
  updateHandler(bot);
  contactAdminHandler(bot);
  complaintHandler(bot);
  issueHandler(bot);
  orderHandler(bot);
}

module.exports = registerUserHandlers;
