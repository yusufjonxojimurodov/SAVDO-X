const express = require("express");
const router = express.Router();
const DeliveryProduct = require("../models/delivery.products.models.js");
const PendingProduct = require("../models/pending.products.js");
const jwt = require("jsonwebtoken");

// Token tekshiruvi middleware
const tokenCheck = (req, res, next) => {
  if (!req.headers.authorization && req.body.sellerBot) {
    return next();
  }

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

// PendingProduct _id va address orqali DeliveryProduct yaratish
router.post("/add/:pendingId/:address", tokenCheck, async (req, res) => {
  try {
    const { pendingId, address } = req.params;

    if (!pendingId)
      return res.status(400).json({ message: "pendingId required" });
    if (!address) return res.status(400).json({ message: "address required" });

    // PendingProduct _id bo‘yicha topish
    const pending = await PendingProduct.findById(pendingId);
    console.log(pending);
    if (!pending)
      return res.status(404).json({ message: "PendingProduct topilmadi" });

    // DeliveryProduct yaratish
    const newDelivery = new DeliveryProduct({
      productId: pending.product,
      sellerId: pending.createdBy,
      buyerId: pending.buyer,
      quantity: pending.quantity,
      price: pending.price,
      address,
      status: "pending",
    });

    await newDelivery.save();

    // PendingProduct o'chirish
    await PendingProduct.findByIdAndDelete(pendingId);

    res.json({
      message: "Mahsulot yetkazish jarayoniga o‘tkazildi",
      delivery: newDelivery,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
