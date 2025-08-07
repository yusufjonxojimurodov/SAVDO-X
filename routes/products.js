const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const FormData = require("form-data");
const axios = require("axios");
const sharp = require("sharp");
const path = require("path");

const ProductModel = require("../models/products");
const { removeBackgroundFromImageFile } = require("remove.bg");

const upload = multer({ dest: "temp/" });

const jwt = require("jsonwebtoken");
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
  "/create-product",
  tokenCheck,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description, price, left, model } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "Rasm yuklash majburiy!" });
      }

      const inputPath = req.file.path;
      const outputPath = `uploads/${Date.now()}-no-bg.png`;

      // remove.bg bilan fonni olib tashlash
      const result = await removeBackgroundFromImageFile({
        path: inputPath,
        apiKey: process.env.REMOVE_BG_API_KEY,
        size: "auto",
        type: "auto",
      });

      // result.base64img ni PNG faylga aylantirib saqlash
      await sharp(Buffer.from(result.base64img, "base64"))
        .png()
        .toFile(outputPath);

      // ImgBB uchun faylni base64 formatga o‘tkazamiz
      const imageBuffer = fs.readFileSync(outputPath);
      const imageBase64 = imageBuffer.toString("base64");

      const formData = new FormData();
      formData.append("image", imageBase64);

      // ImgBB ga yuklash
      const response = await axios.post(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        formData,
        { headers: formData.getHeaders() }
      );

      // vaqtinchalik fayllarni o‘chirish
      fs.unlinkSync(inputPath); // original yuklangan fayl
      // outputPath saqlab qoling — serverda rasm sifatida kerak bo‘lsa

      const imageUrl = response.data.data.url;

      // Mahsulotni saqlash
      const newProduct = new ProductModel({
        name,
        description,
        price,
        model,
        left,
        createdBy: req.userId,
        image: imageUrl,
      });
      await newProduct.save();

      // userName ni populate qilish
      const populatedProduct = await ProductModel.findById(
        newProduct._id
      ).populate("createdBy", "userName");

      res.status(201).json(populatedProduct);
    } catch (err) {
      console.error("Xatolik:", err.response?.data || err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

module.exports = router;
