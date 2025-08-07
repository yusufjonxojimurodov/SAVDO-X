const express = require("express");
const router = express.Router();
const ProductModel = require("../models/products");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const sharp = require("sharp");
const permission = require("../utils/roleCheck.js");
const { removeBackgroundFromImageFile } = require("remove.bg");

const upload = multer({ dest: "temp/" });

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

router.get(
  "/my",
  permission(["admin", "seller"]),
  tokenCheck,
  async (req, res) => {
    try {
      const myProducts = await ProductModel.find({ createdBy: req.userId });
      res.json(myProducts);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.post(
  "/create-product",
  permission(["admin", "seller"]),
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

      const result = await removeBackgroundFromImageFile({
        path: inputPath,
        apiKey: process.env.REMOVE_BG_API_KEY,
        size: "auto",
        type: "auto",
      });

      await sharp(Buffer.from(result.base64img, "base64"))
        .png()
        .toFile(outputPath);

      const imageBuffer = fs.readFileSync(outputPath);
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

      const populatedProduct = await ProductModel.findById(
        newProduct._id
      ).populate("createdBy", "userName");

      res.status(201).json(populatedProduct);
    } catch (err) {
      console.error("Xatolik:", err.response?.data || err);
      if (err.name === "ValidationError") {
        return res
          .status(404)
          .json({ message: "Notog‘ri ma'lumot yuborildi!" });
      }
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

module.exports = router;
