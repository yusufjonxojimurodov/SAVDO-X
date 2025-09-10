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
const Comment = require("../models/coment.js");
const { removeBackgroundFromImageFile } = require("remove.bg");
const PendingProduct = require("../models/pending.products.js");
const bot = require("../bot/index.js");

const upload = multer({ dest: "temp/" });

const tokenCheck = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token topilmadi" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
    req.userId = decoded.id;
    req.role = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token noto‘g‘ri yoki eskirgan" });
  }
};

const formatProduct = (product) => {
  const obj = product.toObject ? product.toObject() : product;
  if (obj.discount) {
    obj.discountPrice = obj.price - (obj.price * obj.discount) / 100;
  }
  return obj;
};

router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.model) {
      filter.model = req.query.model;
    }

    if (req.query.type) {
      filter.type = req.query.type;
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

    const productsWithRating = await Promise.all(
      products.map(async (product) => {
        const happyCount = await Comment.countDocuments({
          productId: product._id,
          rating: "happy",
        });

        const unhappyCount = await Comment.countDocuments({
          productId: product._id,
          rating: "unhappy",
        });

        const total = happyCount + unhappyCount;

        let happyPercent = 0;
        let unhappyPercent = 0;

        if (total > 0) {
          happyPercent = Math.round((happyCount / total) * 100);
          unhappyPercent = 100 - happyPercent;
        }

        return {
          ...formatProduct(product),
          rating: {
            happy: happyPercent,
            unhappy: unhappyPercent,
          },
        };
      })
    );

    res.json(productsWithRating);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get(
  "/my",
  tokenCheck,
  permission(["admin", "seller"]),
  async (req, res) => {
    try {
      const filter = { createdBy: req.userId };

      if (req.query.search) {
        filter.name = { $regex: req.query.search, $options: "i" };
      }

      if (req.query.model) {
        filter.model = req.query.model;
      }

      const myProducts = await ProductModel.find(filter);

      res.json(myProducts.map(formatProduct));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.post(
  "/create-product",
  tokenCheck,
  permission(["admin", "seller"]),
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description, price, left, type, discount, model } =
        req.body;

      if (!req.file) {
        return res.status(400).json({ message: "Rasm yuklash majburiy!" });
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
      const discountPrice = discount ? price - (price * discount) / 100 : price;

      const newProduct = new ProductModel({
        name,
        description,
        price,
        model,
        type,
        discount,
        discountPrice,
        left,
        createdBy: req.userId,
        image: imageUrl,
      });
      await newProduct.save();

      const populatedProduct = await ProductModel.findById(
        newProduct._id
      ).populate("createdBy", "userName");

      res.status(201).json(formatProduct(populatedProduct));
    } catch (err) {
      console.error("Xatolik:", err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.get("/:id", async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id).populate(
      "createdBy",
      "userName"
    );

    if (!product) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    const happyCount = await Comment.countDocuments({
      productId: product._id,
      rating: "happy",
    });
    const unhappyCount = await Comment.countDocuments({
      productId: product._id,
      rating: "unhappy",
    });
    const total = happyCount + unhappyCount;

    let happyPercent = 0;
    let unhappyPercent = 0;

    if (total > 0) {
      happyPercent = Math.round((happyCount / total) * 100);
      unhappyPercent = 100 - happyPercent;
    }

    const formattedProduct = {
      ...formatProduct(product),
      rating: {
        happy: happyPercent,
        unhappy: unhappyPercent,
      },
    };

    res.json(formattedProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.delete(
  "/my/:id",
  tokenCheck,
  permission(["admin", "seller"]),
  async (req, res) => {
    try {
      const productId = req.params.id;
      const userId = req.userId;

      const product = await ProductModel.findById(productId);

      if (!product) {
        return res.status(404).json({ message: "Mahsulot topilmadi" });
      }

      if (
        req.role !== "admin" &&
        product.createdBy.toString() !== userId.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Sizda bu mahsulotni o‘chirish huquqi yo‘q" });
      }

      await ProductModel.findByIdAndDelete(productId);

      res.json({ message: "Mahsulot muvaffaqiyatli o‘chirildi" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.put(
  "/my/product/edit/:id",
  tokenCheck,
  permission(["admin", "seller"]),
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description, price, left, model, discount } = req.body;
      const productId = req.params.id;
      const userId = req.userId;

      let product = await ProductModel.findById(productId);

      if (!product) {
        return res.status(404).json({ message: "Mahsulot topilmadi" });
      }

      if (product.createdBy.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ message: "Sizda bu mahsulotni tahrirlash huquqi yo‘q" });
      }

      let imageUrl = product.image;

      if (req.file) {
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
        imageUrl = response.data.data.url;
      }

      product.name = name ?? product.name;
      product.description = description ?? product.description;
      product.price = price ?? product.price;
      product.left = left ?? product.left;
      product.model = model ?? product.model;
      product.image = imageUrl;
      product.discount = discount ?? product.discount;
      product.discountPrice = product.discount
        ? product.price - (product.price * product.discount) / 100
        : product.price;

      await product.save();

      const updatedProduct = await ProductModel.findById(productId).populate(
        "createdBy",
        "userName"
      );

      res.json(formatProduct(updatedProduct));
    } catch (err) {
      console.error("PUT /my/product/edit error:", err.message);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.get("/products/admin", async (req, res) => {
  try {
    let { page = 1, size = 10 } = req.query;
    page = parseInt(page);
    size = parseInt(size);

    const skip = (page - 1) * size;

    const products = await ProductModel.find({})
      .select("name description price discount discountPrice left")
      .populate("createdBy", "userName")
      .skip(skip)
      .limit(size)
      .sort({ createdAt: -1 });

    const total = await ProductModel.countDocuments();

    res.json({
      page,
      size,
      totalPages: Math.ceil(total / size),
      totalProducts: total,
      products,
    });
  } catch (err) {
    console.error("Pagination error:", err.message);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get("/product/:id/image", async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id).select("image");

    if (!product) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    res.json({ imageUrl: product.image });
  } catch (err) {
    console.error("Image fetch error:", err.message);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
