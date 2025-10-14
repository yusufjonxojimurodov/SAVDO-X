const bodyParser = require("body-parser");
const bot = require("./bot");

function setupWebhook(app) {
  const token = process.env.BOT_TOKEN;

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

module.exports = { setupWebhook };
