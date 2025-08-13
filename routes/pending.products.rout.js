const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const BasketProduct = require("../models/basketProduct.js");
const PendingProduct = require("../models/pending.products.js");
const ProductModel = require("../models/products.js");

const tokenCheck = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token topilmadi" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token noto‘g‘ri yoki eskirgan" });
  }
};

// POST endpoint: buyurtmani PendingProducts ga qo'shish
router.post("/add", tokenCheck, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    // BasketProduct DBda shu user va productni topish
    const basketItem = await BasketProduct.findOne({
      user: req.userId,
      product: productId,
    }).populate("product");

    if (!basketItem) {
      return res.status(404).json({ message: "Mahsulot savatchada topilmadi" });
    }

    // PendingProduct DBga saqlash
    const pending = new PendingProduct({
      product: basketItem.product._id,
      name: basketItem.product.name,
      description: basketItem.product.description,
      price: basketItem.product.price,
      model: basketItem.product.model,
      left: basketItem.product.left,
      image: basketItem.product.image,
      createdBy: basketItem.product.createdBy,
      quantity: quantity,
      buyer: req.userId, // kim buyurtma qildi
    });

    await pending.save();

    res.status(201).json({
      message: "Mahsulot tasdiqlanishi kutilayotganlarga qo‘shildi",
      pending,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

// GET endpoint: faqat seller o‘zining pending productslarini ko‘rsin
router.get("/my-pending", tokenCheck, async (req, res) => {
  try {
    const pendingOrders = await PendingProduct.find({
      createdBy: req.userId,
    }).populate("buyer", "name userName");

    res.json(pendingOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
