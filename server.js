const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const productsRouter = require("./routes/products.js");
const basketRouter = require("./routes/basketProduct.js");
const commentRouter = require("./routes/comment.rout.js");
const avatarRouter = require("./routes/avatar.js");
const pendingRoutes = require("./routes/pending.products.rout.js");
const deliveryProducts = require("./routes/delivery.products.routes.js");
const bannersRoutes = require("./routes/banners.routes.js");
const montlhySales = require("./routes/montlhy.sales.router.js");
const userRouter = require("./routes/users.js");
const statisticWebsite = require("./routes/statistic.website.js");
const { initBot } = require("./bot/index.js");

require("dotenv").config();
const { setupWebhook } = require("./bot/core/webhook.js");

setupWebhook(app);
initBot();

const allowedDomens = [
  "https://texnobazaar.netlify.app",
  "https://texnobazaaradminn.netlify.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedDomens.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS orqali kirish taqiqlangan ❌"));
      }
    },
    methods: ["GET", "DELETE", "POST", "PUT", "PATCH"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

app.use(express.json());
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/users", userRouter);
app.use("/api/products", productsRouter);
app.use("/api/basket", basketRouter);
app.use("/api/comments", commentRouter);
app.use("/api/avatar", avatarRouter);
app.use("/api/pending/products", pendingRoutes);
app.use("/api/delivery/products", deliveryProducts);
app.use("/api/banner", bannersRoutes);
app.use("/api/montlhy", montlhySales);
app.use("/api/statistic", statisticWebsite);

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDb Muvaffaqiyatli");
  })
  .catch((errorMongo) => {
    console.log(errorMongo);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server ${PORT}-portda ishlayapti`)
);
