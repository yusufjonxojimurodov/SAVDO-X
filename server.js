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
const deliveryProducts = require("./routes/delivery.products.routes.js");
const bannersRoutes = require("./routes/banners.routes.js");
const permission = require("./utils/roleCheck.js");
const montlhySales = require("./routes/montlhy.sales.router.js");

require("dotenv").config();
const { bot, setupWebhook } = require("./bot/index.js");

setupWebhook(app);

app.use(
  cors({
    origin: "*",
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/get/all/products", productsRouter);
app.use("/basket", basketRouter);
app.use("/api/comments", commentRouter);
app.use(avatarRouter);
app.use("/pending/products", pendingRoutes);
app.use("/delivery/products", deliveryProducts);
app.use("/banner", bannersRoutes);
app.use("/montlhy", montlhySales);

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

app.get("/users/:id", tokenCheck, async (req, res) => {
  try {
    const { id } = req.params;

    let user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "❌ User topilmadi" });
    }

    user = user.toObject();

    if (user.role !== "seller") {
      delete user.points;
      delete user.rating;
    }

    res.json(user);
  } catch (err) {
    console.error("GET /users/:id error:", err.message);
    res.status(500).json({ message: "Server xatosi" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    if (!user)
      return res.status(400).json({ message: "Telefon raqam notog‘ri" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Parol xato" });

    const token = jwt.sign({ id: user._id }, JWT_TOKEN, { expiresIn: "24h" });

    res.json({
      token,
      name: user.name,
      surname: user.surname,
      phone: user.phone,
    });
  } catch (error) {
    res.status(500).json({ message: "Server xatoligi" });
  }
});

app.get("/api/getUserMe", tokenCheck, async (request, response) => {
  try {
    let user = await User.findById(request.userId).select("-password");

    if (!user) {
      return response.status(404).json({ message: "User topilmadi" });
    }

    user = user.toObject();

    if (user.role !== "seller") {
      delete user.points;
      delete user.rating;
    }

    response.json(user);
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Server Xatoligi" });
  }
});

app.put(
  "/api/update-role/:id",
  tokenCheck,
  permission(["admin"]),
  async (req, res) => {
    try {
      const adminUser = await User.findById(req.userId);
      if (adminUser.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Faqat admin rol o‘zgartira oladi" });
      }

      const { role } = req.body;
      if (!["admin", "seller", "customer", "blocked"].includes(role)) {
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
  }
);

app.put("/api/update-profile", tokenCheck, async (req, res) => {
  try {
    const { name, surname, email, birthDate } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (surname) updateData.surname = surname;
    if (email) updateData.email = email;
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

app.put("/api/admin/update-user/:id", tokenCheck, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);

    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Faqat admin foydalanuvchini yangilay oladi" });
    }

    const { id } = req.params;
    const { name, surname, phone, password } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (surname) updateData.surname = surname;
    if (phone) updateData.phone = phone;

    if (password) {
      const bcrypt = require("bcrypt");
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, select: "-password" }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    res.json({
      message: "Foydalanuvchi ma'lumotlari yangilandi ✅",
      user: updatedUser,
    });
  } catch (error) {
    console.error("PUT /api/admin/update-user/:id xato:", error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

app.get("/api/all/users", tokenCheck, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Faqat admin bu API'ni ishlata oladi" });
    }

    const { role, page = 0 } = req.query;
    let filter = {};

    if (role) {
      if (!["admin", "seller", "customer", "blocked"].includes(role)) {
        return res
          .status(400)
          .json({ message: "Noto‘g‘ri role qiymati kiritildi" });
      }
      filter.role = role;
    }

    const limit = 12;
    const skip = Number(page) * limit;

    const totalUsers = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("-password")
      .skip(skip)
      .limit(limit);

    res.json({
      message: "Foydalanuvchilar ro‘yxati",
      page: Number(page),
      totalPages: Math.ceil(totalUsers / limit),
      count: users.length,
      totalUsers,
      users,
    });
  } catch (error) {
    console.error("GET /api/all/users xato:", error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

app.delete("/api/users/:id", tokenCheck, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Faqat admin foydalanuvchini o‘chira oladi" });
    }

    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    res.json({
      message: "Foydalanuvchi muvaffaqiyatli o‘chirildi ✅",
      deletedUser: {
        _id: deletedUser._id,
        name: deletedUser.name,
        surname: deletedUser.surname,
        role: deletedUser.role,
        phone: deletedUser.phone,
      },
    });
  } catch (error) {
    console.error("DELETE /api/users/:id xato:", error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server ${PORT}-portda ishlayapti`)
);
