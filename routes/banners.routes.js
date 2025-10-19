const express = require("express");
const Banner = require("../models/banners.model");
const permission = require("../utils/roleCheck");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const jwt = require("jsonwebtoken");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const tokenCheck = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token topilmadi" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token noto‘g‘ri yoki eskirgan" });
  }
};

router.post(
  "/post",
  tokenCheck,
  permission(["admin"]),
  upload.single("image"),
  async (req, res) => {
    try {
      const count = await Banner.countDocuments();
      if (count >= 6) {
        return res
          .status(400)
          .json({ message: "Faqat 6 ta banner qo‘shish mumkin!" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Rasm yuklash majburiy!" });
      }

      if (!req.body.productUrl) {
        return res
          .status(400)
          .json({ message: "productUrl yuborilishi kerak!" });
      }

      const inputPath = req.file.path;
      const imageBuffer = fs.readFileSync(inputPath);
      const imageBase64 = imageBuffer.toString("base64");

      const formData = new FormData();
      formData.append("image", imageBase64);

      const response = await axios.post(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        formData,
        { headers: formData.getHeaders() }
      );

      fs.unlinkSync(inputPath);
      const imageUrl = response.data.data.url;

      const banner = new Banner({
        image: imageUrl,
        productUrl: req.body.productUrl,
        createdBy: req.userId,
      });

      await banner.save();

      res.status(201).json(banner);
    } catch (err) {
      console.error("Xatolik:", err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.delete(
  "/delete/:id",
  tokenCheck,
  permission(["admin"]),
  async (req, res) => {
    try {
      const banner = await Banner.findById(req.params.id);

      if (!banner) {
        return res.status(404).json({ message: "Banner topilmadi!" });
      }

      await Banner.findByIdAndDelete(req.params.id);

      res.json({ message: "Banner muvaffaqiyatli o‘chirildi!" });
    } catch (err) {
      console.error("O‘chirishda xatolik:", err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find().populate("createdBy", "userName");
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
