const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const FormData = require("form-data");
const User = require("../models/userRegister");
const tokenCheck = require("../middleware/token.js")
const router = express.Router();

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/users/avatar",
  tokenCheck,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Rasm fayli yuborilmadi" });
      }

      const base64Image = req.file.buffer.toString("base64");

      const formData = new FormData();
      formData.append("image", base64Image);

      const imgbbRes = await axios.post(
        `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
        formData,
        { headers: formData.getHeaders() }
      );

      const imageUrl = imgbbRes.data.data.url;

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

router.get("/users/get/avatar", tokenCheck, async (req, res) => {
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

router.delete("/users/avatar", tokenCheck, async (req, res) => {
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