const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const FormData = require("form-data");
const User = require("../models/userRegister");

const router = express.Router();

const JWT_TOKEN = process.env.JWT_TOKEN;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

// Multer — xotirada saqlash
const upload = multer({ storage: multer.memoryStorage() });

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
    res
      .status(401)
      .json({ message: "Foydalanuvchi tokeni yo‘q yoki eskirgan" });
  }
};

// POST - avatar yuklash
router.post(
  "/api/users/avatar",
  tokenCheck,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Rasm fayli yuborilmadi" });
      }

      // Faylni base64 formatga o‘girish
      const base64Image = req.file.buffer.toString("base64");

      // IMGBB'ga yuborish
      const formData = new FormData();
      formData.append("image", base64Image);

      const imgbbRes = await axios.post(
        `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
        formData,
        { headers: formData.getHeaders() }
      );

      const imageUrl = imgbbRes.data.data.url;

      // User modelini yangilash
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      }

      user.avatar = imageUrl;
      await user.save();

      res.json({ message: "Avatar yuklandi", avatar: imageUrl });
    } catch (error) {
      console.error("Upload xatolik:", error.response?.data || error.message);
      res.status(500).json({ message: "Rasm yuklashda xatolik" });
    }
  }
);

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

// DELETE - avatar o‘chirish
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
