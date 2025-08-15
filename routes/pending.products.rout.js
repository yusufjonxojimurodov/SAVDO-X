const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const BasketProduct = require("../models/basketProduct.js");
const PendingProduct = require("../models/pending.products.js");
const ProductModel = require("../models/products.js");
const { bot } = require("../bot/index.js");
const axios = require("axios");

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
    const { orders, phone, userName } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res
        .status(400)
        .json({ message: "Orders array bo'sh bo'lmasligi kerak" });
    }

    const pendingProducts = [];

    for (const order of orders) {
      const { productId, quantity } = order;

      const basketItem = await BasketProduct.findById(productId).populate({
        path: "product",
        populate: { path: "createdBy", select: "chatId userName" },
      });

      if (!basketItem) {
        return res.status(404).json({ message: "Bunday mahsulot topilmadi" });
      }

      const pending = new PendingProduct({
        product: basketItem.product._id,
        name: basketItem.product.name,
        description: basketItem.product.description,
        price: basketItem.product.price,
        model: basketItem.product.model,
        left: basketItem.product.left,
        image: basketItem.product.image,
        createdBy: basketItem.product.createdBy,
        quantity: quantity || basketItem.quantity,
        buyer: req.userId,
        phone,
        userName: req.userName,
      });

      await pending.save();
      pendingProducts.push(pending);

      // BOT ga sellerga xabar yuborish
      try {
        await bot.sendMessage(
          basketItem.product.createdBy.chatId,
          `Sizning mahsulotingiz "${
            basketItem.product.name
          }" tasdiqlanishi kutilmoqda.\nMijoz: ${userName || "Anonim"}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Tasdiqlash ✅",
                    callback_data: `approve_${pending._id}`,
                  },
                  {
                    text: "Bekor qilish ❌",
                    callback_data: `reject_${pending._id}`,
                  },
                ],
              ],
            },
          }
        );
      } catch (err) {
        console.error("Botga xabar yuborilmadi:", err.message);
      }
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

router.get("/my-pending/buyer", tokenCheck, async (req, res) => {
  try {
    const pendingOrders = await PendingProduct.find({
      buyer: req.userId,
    })
      .populate("product")
      .populate("createdBy", "name userName");

    res.json(pendingOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

// GET /my-pending/seller
router.get("/my-pending/seller", tokenCheck, async (req, res) => {
  try {
    const pendingOrders = await PendingProduct.find({
      createdBy: req.userId, // faqat o'z yaratgan mahsulotlari
    })
      .populate("buyer", "name userName")
      .populate("product"); // buyer va product ma'lumotlari

    res.json(pendingOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

// DELETE /pending/delete/:id
router.delete("/delete/:id", tokenCheck, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await PendingProduct.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "PendingProduct topilmadi" });
    }

    res.json({ message: "PendingProduct muvaffaqiyatli o‘chirildi", deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
