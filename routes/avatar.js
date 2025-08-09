const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/userRegister");
const jwt = require("jsonwebtoken");

const router = express.Router();

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads/avatars"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Faqat rasm fayllari qabul qilinadi"));
  },
});

// POST - avatar yuklas
router.post(
  "/api/users/:id/avatar",
  tokenCheck,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Rasm fayli yuborilmadi" });
      }
      const avatarPath = "/uploads/avatars/" + req.file.filename;

      // User modelda avatar maydonini yangilash
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { avatar: avatarPath },
        { new: true, select: "-password" }
      );

      if (!user) {
        // Yuklangan faylni o'chirish
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      }

      res.json({ message: "Avatar yuklandi", avatar: avatarPath });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

// GET - avatar olish (yo'lni qaytaradi)
router.get("/api/users/:id/avatar", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.avatar) {
      return res.status(404).json({ message: "Avatar topilmadi" });
    }
    res.sendFile(path.join(__dirname, user.avatar));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

// PUT - avatar yangilash (POST bilan deyarli bir xil)
router.put(
  "/api/users/:id/avatar",
  tokenCheck,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Rasm fayli yuborilmadi" });
      }
      const avatarPath = "/uploads/avatars/" + req.file.filename;

      // Eski avatarni o'chirish uchun
      const user = await User.findById(req.params.id);
      if (!user) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      }
      if (user.avatar) {
        const oldPath = path.join(__dirname, user.avatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      // Yangi avatarni saqlash
      user.avatar = avatarPath;
      await user.save();

      res.json({ message: "Avatar yangilandi", avatar: avatarPath });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

// DELETE - avatar o'chirish
router.delete("/api/users/:id/avatar", tokenCheck, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.avatar) {
      return res.status(404).json({ message: "Avatar topilmadi" });
    }

    const avatarPath = path.join(__dirname, user.avatar);
    if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);

    user.avatar = "";
    await user.save();

    res.json({ message: "Avatar o‘chirildi" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
