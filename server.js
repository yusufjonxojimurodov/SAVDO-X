const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("./models/userRegister.js");
const path = require("path");
const productsRouter = require("./routes/products.js");
const basketRouter = require("./routes/basketProduct.js");
const commentRouter = require("./routes/comment.rout.js");

require("dotenv").config();

const users = express();
users.use(cors());
users.use(express.json());
users.use("/uploads", express.static(path.join(__dirname, "uploads")));
users.use("/get/all/products", productsRouter);
users.use("/basket", basketRouter);
users.use("/api/comments", commentRouter);

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

users.post("/api/register", async (request, response) => {
  try {
    const { name, surname, userName, password } = request.body;
    const exists = await User.findOne({ userName });
    if (exists)
      return response
        .status(400)
        .json({ message: "Bunday UserName allaqachon mavjud" });

    const newUser = new User({ name, surname, userName, password });
    await newUser.save();
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

users.post("/api/login", async (request, response) => {
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

users.get("/api/getUserMe", tokenCheck, async (request, response) => {
  try {
    const user = await User.findById(request.userId).select("-password");
    response.json(user);
  } catch (error) {
    response.status(500).json({ message: "Server Xatoligi" });
  }
});

users.put("/api/update-role/:id", tokenCheck, async (req, res) => {
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

const PORT = process.env.PORT || 5000;
users.listen(PORT, "0.0.0.0", () =>
  console.log(`Server ${PORT}-portda ishlayapti`)
);
