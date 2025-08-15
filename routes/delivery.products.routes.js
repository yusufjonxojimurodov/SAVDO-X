const express = require("express");
const router = express.Router();
const DeliveryProduct = require("../models/delivery.products.models.js");
const PendingProduct = require("../models/pending.products.js");
const jwt = require("jsonwebtoken");

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

router.post("/add/:pendingId", tokenCheck, async (req, res) => {
  try {
    const { pendingId } = req.params;
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ message: "Manzil kiritilishi shart" });
    }

    const pending = await PendingProduct.findById(pendingId);
    if (!pending) {
      return res.status(404).json({ message: "PendingProduct topilmadi" });
    }

    const newDelivery = new DeliveryProduct({
      product: pending.product,
      name: pending.name,
      description: pending.description,
      price: pending.price,
      model: pending.model,
      left: pending.left,
      image: pending.image,
      createdBy: pending.createdBy,
      quantity: pending.quantity,
      buyer: pending.buyer,
      phone: pending.phone,
      userName: pending.userName,
      address,
    });
    await newDelivery.save();

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
