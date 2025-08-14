const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const dotenv = require("dotenv");

const User = require("./models/userRegister.js");
const productsRouter = require("./routes/products.js");
const basketRouter = require("./routes/basketProduct.js");
const commentRouter = require("./routes/comment.rout.js");
const avatarRouter = require("./routes/avatar.js");
const pendingRoutes = require("./routes/pending.products.rout.js");
const telegramBot = require("./bot/index.js");

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/get/all/products", productsRouter);
app.use("/basket", basketRouter);
app.use("/api/comments", commentRouter);
app.use(avatarRouter);
app.use("/pending/products", pendingRoutes);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB Muvaffaqiyatli");
  })
  .catch((errorMongo) => {
    console.error("MongoDB ulanish xatosi:", errorMongo);
  });

// JWT token check middleware
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

// Auth routes
app.post("/api/register", async (req, res) => {
  try {
    const { name, surname, userName, password } = req.body;

    const exists = await User.findOne({ userName });
    if (exists)
      return res
        .status(400)
        .json({ message: "Bunday UserName allaqachon mavjud" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      surname,
      userName,
      password: hashedPassword,
    });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, JWT_TOKEN, {
      expiresIn: "24h",
    });

    res.status(201).json({
      message: "Akkaunt Muvaffaqiyatli yaratildi",
      token,
    });
  } catch (error) {
    console.error(error);
    if (error.name === "ValidationError")
      return res.status(400).json({ message: "Bad Request" });
    res.status(500).json({ message: "Server Xatoligi" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { userName, password } = req.body;
    const user = await User.findOne({ userName });
    if (!user) return res.status(400).json({ message: "User Name Notogri" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "UserName yoki Password Xato" });

    const token = jwt.sign({ id: user._id }, JWT_TOKEN, { expiresIn: "24h" });

    res.json({
      token,
      name: user.name,
      surname: user.surname,
      userName: user.userName,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Xatoligi" });
  }
});

app.get("/api/getUserMe", tokenCheck, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Xatoligi" });
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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server ${PORT}-portda ishlayapti`);
});
