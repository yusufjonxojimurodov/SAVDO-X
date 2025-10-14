const TelegramBot = require("node-telegram-bot-api");
const dotenv = require("dotenv");

dotenv.config();

const token = process.env.BOT_TOKEN;
const URL = process.env.URL;

if (!token) console.error("❌ BOT_TOKEN topilmadi!");
if (!URL) console.error("❌ URL topilmadi!");

const bot = new TelegramBot(token, { webHook: true });
bot.setWebHook(`${URL}/bot${token}`);

module.exports = bot;
