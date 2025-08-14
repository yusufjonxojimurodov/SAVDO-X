const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("./models/userRegister.js");
const path = require("path");
const productsRouter = require("./routes/products.js");
const basketRouter = require("./routes/basketProduct.js");
const commentRouter = require("./routes/comment.rout.js");
const avatarRouter = require("./routes/avatar.js");
const pendingRoutes = require("./routes/pending.products.rout.js");

require("dotenv").config();
require("./bot/index.js")(app);

app.use(
  cors({
    origin: ["http://localhost:5173", "https://practicesavdox.netlify.app"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/get/all/products", productsRouter);
app.use("/basket", basketRouter);
app.use("/api/comments", commentRouter);
app.use("/test", avatarRouter);
app.use("/pending/products", pendingRoutes);

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

const JWT_TOKEN = process.env.JWT_TOKEN;

const tokenCheck = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "Foydalanuvchi tokeni topilmadi" });
  try {
    const decoded = jwt.verify(token, JWT_TOKEN);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: "Foydalanuvchi tokeni yoq yoki eskirgan" });
  }
};

app.post("/api/register", async (request, response) => {
  try {
    const { name, surname, userName, password } = request.body;

    // 1️⃣ UserName allaqachon mavjudligini tekshirish
    const exists = await User.findOne({ userName });
    if (exists)
      return response
        .status(400)
        .json({ message: "Bunday UserName allaqachon mavjud" });

    // 2️⃣ Telegram chatId mavjudligini tekshirish
    const userWithChat = await User.findOne({
      userName,
      chatId: { $ne: null },
    });
    if (!userWithChat) {
      return response.status(400).json({
        message: "Iltimos, ro‘yxatdan o‘tish uchun avval botga /start yuboring",
      });
    }

    // 3️⃣ Yangi foydalanuvchini yaratish va chatId ni saqlash
    const newUser = new User({
      name,
      surname,
      userName,
      password,
      chatId: userWithChat.chatId,
    });

    await newUser.save();

    // 4️⃣ JWT token yaratish
    const token = jwt.sign({ id: newUser._id }, JWT_TOKEN, {
      expiresIn: "24h",
    });

    response.status(201).json({
      message: "Akkaunt Muvaffaqiyatli yaratildi",
      token,
    });
  } catch (error) {
    if (error.name === "ValidationError")
      return response.status(400).json({ message: "Bad Request" });
    response.status(500).json({ message: "Server Xatoligi" });
  }
});

app.post("/api/login", async (request, response) => {
  try {
    const { userName, password } = request.body;
    const user = await User.findOne({ userName });
    if (!user)
      return response.status(400).json({ message: "User Name Notogri" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return response
        .status(400)
        .json({ message: "UserName yoki Password Xato" });

    const token = jwt.sign({ id: user._id }, JWT_TOKEN, { expiresIn: "24h" });
    response.json({
      token,
      name: user.name,
      surname: user.surname,
      userName: user.userName,
    });
  } catch (error) {
    response.status(500).json({ message: "Server Xatoligi" });
  }
});

app.get("/api/getUserMe", tokenCheck, async (request, response) => {
  try {
    const user = await User.findById(request.userId).select("-password");
    response.json(user);
  } catch (error) {
    response.status(500).json({ message: "Server Xatoligi" });
  }
});

app.put("/api/update-role/:id", tokenCheck, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Faqat admin rol o‘zgartira oladi" });
    }

    const { role } = req.body;
    if (!["admin", "seller", "customer"].includes(role)) {
      return res.status(400).json({ message: "Yaroqsiz rol" });
    }

    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    if (role === "admin") {
      const existingAdmin = await User.findOne({ role: "admin" });
      if (
        existingAdmin &&
        existingAdmin._id.toString() !== userToUpdate._id.toString()
      ) {
        return res.status(400).json({ message: "Allaqachon admin mavjud" });
      }
    }

    userToUpdate.role = role;
    await userToUpdate.save();

    res.json({
      message: "Foydalanuvchi roli o‘zgartirildi",
      user: userToUpdate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

app.put("/api/update-profile", tokenCheck, async (req, res) => {
  try {
    const { name, surname, phone, email, userName, birthDate } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (surname) updateData.surname = surname;
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;
    if (userName) updateData.userName = userName;
    if (birthDate) updateData.birthDate = birthDate;

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true, select: "-password" }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    res.json({ message: "Profil yangilandi", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server ${PORT}-portda ishlayapti`)
);
