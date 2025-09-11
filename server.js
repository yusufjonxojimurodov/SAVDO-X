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

require("dotenv").config();
const { bot, setupWebhook } = require("./bot/index.js");

setupWebhook(app);

app.use(
  cors({
    origin: ["https://savdo-x-admin.netlify.app", "https://savdox.netlify.app"],
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
