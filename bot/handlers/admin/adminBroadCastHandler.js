const User = require("../../../models/userRegister.js");

async function startBroadcast(bot, chatId, adminStates) {
  adminStates[chatId] = { type: "waitingBroadcastMessage" };
  await bot.sendMessage(
    chatId,
    "Iltimos, barcha foydalanuvchilarga yubormoqchi bo‘lgan xabarni kiriting. Matn, rasm yoki hujjat bo‘lishi mumkin."
  );
}

async function handleBroadcast(bot, msg, adminStates) {
  const chatId = msg.chat.id;
  const users = await User.find({}).select("chatId").lean();

  if (!users.length) {
    await bot.sendMessage(chatId, "Hozircha foydalanuvchilar yo‘q.");
    delete adminStates[chatId];
    return;
  }

  const broadcastText = msg.caption || msg.text || "";
  const photo = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
  const document = msg.document ? msg.document.file_id : null;
  const video = msg.video ? msg.video.file_id : null;

  for (const user of users) {
    try {
      if (photo)
        await bot.sendPhoto(user.chatId, photo, { caption: broadcastText });
      else if (document)
        await bot.sendDocument(user.chatId, document, {
          caption: broadcastText,
        });
      else if (video)
        await bot.sendVideo(user.chatId, video, { caption: broadcastText });
      else if (broadcastText) await bot.sendMessage(user.chatId, broadcastText);
    } catch (err) {
      console.error(`Xabar yuborishda xato: ${user.chatId}`, err);
    }
  }

  await bot.sendMessage(chatId, "Xabar barcha foydalanuvchilarga yuborildi ✅");
  delete adminStates[chatId];
}

module.exports = { startBroadcast, handleBroadcast };
