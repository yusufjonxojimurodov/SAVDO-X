require("dotenv").config();
const { genRequestId, asAt } = require("./format");
const bot = require("../bot/core/bot.js");

const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);

if (!ADMIN_CHAT_ID) console.error("ADMIN_CHAT_ID topilmadi yoki noto'g'ri!");

const pendingMap = {};

function sendToAdminWithApproveReject({ type, userChatId, username, payload }) {
  const requestId = genRequestId();
  pendingMap[requestId] = { type, userChatId, username, payload };

  const titles = {
    contact_admin: "Adminga bog‘lanish so‘rovi",
    complaint: "Mahsulot egasidan shikoyat",
    issue: "Saytdagi muammo xabari",
    suggestion: "Saytga taklif",
  };

  const text =
    `🆕 *${titles[type]}*\n` +
    `*Foydalanuvchi:* ${asAt(username)}\n` +
    `*Xabar:* ${payload.text}` +
    (payload.extra ? `\n${payload.extra}` : "");

  return bot.sendMessage(ADMIN_CHAT_ID, text, {
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

module.exports = { sendToAdminWithApproveReject, pendingMap };
