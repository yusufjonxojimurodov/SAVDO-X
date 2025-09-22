const express = require("express");
const router = express.Router();
const permission = require("../utils/roleCheck.js");
const tokenCheck = require("../middleware/token.js");
const bcrypt = require("bcrypt");
const User = require("../models/userRegister.js");
const jwt = require("jsonwebtoken");

require("dotenv").config();

router.post("/login", async (req, res) => {
  try {
    console.log("userId from token:", req.userId);
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    if (!user)
      return res.status(400).json({ message: "Telefon raqam notog‘ri" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Parol xato" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_TOKEN,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      name: user.name,
      surname: user.surname,
      phone: user.phone,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Server xatoligi" });
  }
});

router.get("/getUserMe", tokenCheck, async (req, res) => {
  try {
    // token middleware orqali userId olinadi
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Token noto‘g‘ri yoki eskirgan" });
    }

    let user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User topilmadi" });
    }

    user = user.toObject();

    // seller bo‘lmasa points va ratingni o‘chirish
    if (user.role !== "seller") {
      delete user.points;
      delete user.rating;
    }

    res.json(user);
  } catch (error) {
    console.error("GET /users/getUserMe error:", error);
    res.status(500).json({ message: "Server xatoligi" });
  }
});

router.put(
  "/update/role/:id",
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

router.put(
  "/update-profile",
  tokenCheck,
  permission(["admin", "seller", "customer"]),
  async (req, res) => {
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
  }
);

router.put(
  "/admin/update-user/:id",
  tokenCheck,
  permission(["admin"]),
  async (req, res) => {
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
  }
);

router.get(
  "/all/users",
  tokenCheck,
  permission(["admin"]),
  async (req, res) => {
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
  }
);

router.delete(
  "/user/delete/:id",
  tokenCheck,
  permission(["admin"]),
  async (req, res) => {
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
  }
);

router.get("/:id", async (req, res) => {
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

    if (user._id) {
      user.avatar = `${req.protocol}://${req.get(
        "host"
      )}/api/avatar/users/avatar/${user._id}/file`;
    }

    res.json(user);
  } catch (err) {
    console.error("GET /users/:id error:", err.message);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
