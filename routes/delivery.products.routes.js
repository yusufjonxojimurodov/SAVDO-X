const express = require("express");
const router = express.Router();
const User = require("../models/userRegister.js");
const DeliveryProduct = require("../models/delivery.products.models.js");
const PendingProduct = require("../models/pending.products.js");
const { bot } = require("../bot/index.js");
const jwt = require("jsonwebtoken");

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

router.post("/add/:pendingId/:address", tokenCheck, async (req, res) => {
  try {
    const { pendingId, address } = req.params;

    if (!pendingId)
      return res.status(400).json({ message: "pendingId required" });
    if (!address) return res.status(400).json({ message: "address required" });

    const pending = await PendingProduct.findById(pendingId)
      .populate("product")
      .populate("createdBy")
      .populate("buyer");

    if (!pending)
      return res.status(404).json({ message: "PendingProduct topilmadi" });

    const product = pending.product || {};
    const seller = pending.createdBy || {};
    const buyer = pending.buyer || {};

    if (!product.left || product.left < pending.quantity) {
      if (seller.chatId && !product._notified) {
        await bot.sendMessage(
          seller.chatId,
          `⚠️ ${product.name} mahsulotingiz sotuvda qolmadi.\nAgar sizning omboringizda bo'lsa saytimizga kirib mahsulot qoldig'ini yangilang!`
        );
        product._notified = true;
        await product.save();
      }

      await PendingProduct.findByIdAndDelete(pendingId);

      if (buyer.chatId) {
        await bot.sendMessage(
          buyer.chatId,
          `❌ Afsuski, siz buyurtma qilgan ${product.name} mahsuloti omborda qolmagan.`
        );
      }

      return res.status(400).json({
        message: "❌ Bu mahsulot sotuvda qolmagan",
      });
    }

    const newDelivery = new DeliveryProduct({
      image: product.image || "",
      name: product.name || "",
      description: product.description || "",
      productId: product._id,
      sellerId: seller._id,
      buyerId: buyer._id,
      quantity: pending.quantity,
      price: pending.price,
      discount: pending.discount,
      discountPrice: pending.discountPrice,
      address,
      status: "pending",
    });

    await newDelivery.save();

    product.left = product.left - pending.quantity;

    if (product.left <= 0 && seller.chatId && !product._notified) {
      await bot.sendMessage(
        seller.chatId,
        `⚠️ ${product.name} mahsulotingiz sotuvda qolmadi.\nAgar sizning omboringizda bo'lsa saytimizga kirib mahsulot qoldig'ini yangilang!`
      );
      product._notified = true;
    }

    await product.save();

    await PendingProduct.findByIdAndDelete(pendingId);

    if (buyer.chatId) {
      await bot.sendMessage(
        buyer.chatId,
        `✅ Sizning ${product.name} mahsulotingiz tasdiqlandi va tez orada yetkazib beriladi.`
      );
    }

    res.json({
      message: "✅ Mahsulot yetkazish jarayoniga o‘tkazildi",
      delivery: newDelivery,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get("/my-deliveries", tokenCheck, async (req, res) => {
  try {
    const userId = req.userId;

    const deliveries = await DeliveryProduct.find({ buyerId: userId })
      .populate("sellerId", "userName phone")
      .populate(
        "productId",
        "name price image description discount discountPrice"
      );

    res.json({
      message: "✅ Sizning delivery products",
      deliveries,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get("/seller/deliveries", tokenCheck, async (req, res) => {
  try {
    const sellerId = req.userId;

    const deliveries = await DeliveryProduct.find({ sellerId })
      .populate("buyerId", "userName phone")
      .populate(
        "productId",
        "name price image description discount discountPrice"
      );

    res.json({
      message: "✅ Siz sotgan delivery products",
      deliveries,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.put("/delivery/:id/status", tokenCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["completed", "incompleted"].includes(status)) {
      return res.status(400).json({ message: "❌ Noto‘g‘ri status qiymati" });
    }

    const delivery = await DeliveryProduct.findOne({
      _id: id,
      sellerId: req.userId,
    });

    if (!delivery) {
      return res
        .status(404)
        .json({ message: "❌ Delivery topilmadi yoki sizga tegishli emas" });
    }

    delivery.status = status;
    await delivery.save();

    const seller = await User.findById(req.userId);
    if (seller && seller.role === "seller") {
      if (status === "completed") {
        seller.points = (seller.points || 0) + 1;
      } else if (status === "incompleted") {
        seller.points = (seller.points || 0) - 2;
      }
      await seller.save();
    }

    res.json({
      message: "✅ Delivery status yangilandi",
      delivery,
      sellerPoints: seller?.points,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
