const express = require("express");
const router = express.Router();
const ProductModel = require("../models/products");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Faqat PNG yoki JPEG formatdagi rasm yuklash mumkin!"), false);
  }
};

const upload = multer({ storage, fileFilter });

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

router.get("/my", tokenCheck, async (req, res) => {
  try {
    const myProducts = await ProductModel.find({ createdBy: req.userId });
    res.json(myProducts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

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

      const newProduct = new ProductModel({
        name,
        description,
        price,
        model,
        left,
        createdBy: req.userId,
        image: `/uploads/${req.file.filename}`,
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
          .json({ message: "Notogri ma'lumot yuborildi !" });
      console.error(err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

module.exports = router;
