const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../models/userRegister");

const router = express.Router();

const JWT_TOKEN = process.env.JWT_TOKEN;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY; // imgbb API kalitini .env ga yoz

// Token tekshiruvchi middleware
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

// POST - avatar yuklash va IMGBB'ga jo'natish
router.post("/api/users/avatar", tokenCheck, async (req, res) => {
  try {
    if (!req.body.image) {
      return res
        .status(400)
        .json({ message: "Rasm fayli base64 formatda yuborilmadi" });
    }

    // IMGBB ga yuklash
    const formData = new URLSearchParams();
    formData.append("image", req.body.image);

    const imgbbRes = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      formData
    );

    const imageUrl = imgbbRes.data.data.url;

    // MongoDB dagi user avatarini yangilash
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    user.avatar = imageUrl;
    await user.save();

    res.json({ message: "Avatar yuklandi", avatar: imageUrl });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ message: "Rasm yuklashda xatolik" });
  }
});

// GET - avatar URL ni olish
router.get("/api/users/get/avatar", tokenCheck, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.avatar) {
      return res.status(404).json({ message: "Avatar topilmadi" });
    }
    res.json({ avatar: user.avatar });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

// DELETE - avatar URL ni o'chirish
router.delete("/api/users/avatar", tokenCheck, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.avatar) {
      return res.status(404).json({ message: "Avatar topilmadi" });
    }

    user.avatar = "";
    await user.save();

    res.json({ message: "Avatar o‘chirildi" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;