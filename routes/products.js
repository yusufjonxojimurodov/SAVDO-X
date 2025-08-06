const express = require("express");
const router = express.Router();
const ProductModel = require("../models/products");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const upload = multer({ dest: "temp/" }); // vaqtinchalik papka

// Token tekshiruvchi middleware
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

// Barcha mahsulotlarni olish (filtr va sort bilan)
router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.model) {
      filter.model = req.query.model;
    }

    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: "i" };
    }

    let sortOption = {};
    if (req.query.price) {
      if (req.query.price === "expensive") {
        sortOption.price = -1;
      } else if (req.query.price === "cheap") {
        sortOption.price = 1;
      }
    }

    const products = await ProductModel.find(filter)
      .populate("createdBy", "userName")
      .sort(sortOption);

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

// Foydalanuvchining o‘z mahsulotlari
router.get("/my", tokenCheck, async (req, res) => {
  try {
    const myProducts = await ProductModel.find({ createdBy: req.userId });
    res.json(myProducts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

// Yangi mahsulot yaratish (ImgBB yuklash bilan)
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

      // Faylni o‘qib base64 ga o‘tkazamiz
      const imageBuffer = fs.readFileSync(req.file.path);
      const imageBase64 = imageBuffer.toString("base64");

      // ImgBB ga yuklash
      const response = await axios.post(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        { image: imageBase64 }
      );

      // vaqtinchalik faylni o‘chiramiz
      fs.unlinkSync(req.file.path);

      const imageUrl = response.data.data.url;

      // Yangi mahsulot yaratamiz
      const newProduct = new ProductModel({
        name,
        description,
        price,
        model,
        left,
        createdBy: req.userId,
        image: imageUrl, // ImgBB URL saqlanadi
      });
      await newProduct.save();

      const populatedProduct = await ProductModel.findById(
        newProduct._id
      ).populate("createdBy", "userName");

      res.status(201).json(populatedProduct);
    } catch (err) {
      if (err.name === "ValidationError")
        return res
          .status(404)
          .json({ message: "Notog‘ri ma'lumot yuborildi!" });
      console.error(err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

module.exports = router;
