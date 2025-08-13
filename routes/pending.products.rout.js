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

router.post("/add", tokenCheck, async (req, res) => {
  try {
    const { orders, phone } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res
        .status(400)
        .json({ message: "Orders array bo'sh bo'lmasligi kerak" });
    }

    const pendingProducts = [];

    for (const order of orders) {
      const { productId, quantity } = order;

      const basketItem = await BasketProduct.findOne({
        user: req.userId,
        product: productId,
      }).populate("product");

      if (!basketItem) continue; // savatchada bo'lmasa o'tkazib yuboradi

      const pending = new PendingProduct({
        product: basketItem.product._id,
        name: basketItem.product.name,
        description: basketItem.product.description,
        price: basketItem.product.price,
        model: basketItem.product.model,
        left: basketItem.product.left,
        image: basketItem.product.image,
        createdBy: basketItem.product.createdBy,
        quantity,
        buyer: req.userId,
        phone, // foydalanuvchi telefon raqami
      });

      await pending.save();
      pendingProducts.push(pending);
    }

    res.status(201).json({
      message: "Mahsulotlar tasdiqlanishi kutilayotganlarga qo‘shildi",
      pendingProducts,
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
