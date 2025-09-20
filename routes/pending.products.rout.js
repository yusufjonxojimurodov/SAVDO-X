const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const BasketProduct = require("../models/basketProduct.js");
const PendingProduct = require("../models/pending.products.js");
const { bot } = require("../bot/index.js");
const tokenCheck = require("../middleware/token.js");

router.post("/add", tokenCheck, async (req, res) => {
  try {
    const { orders, phone, userName, quantity, location } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res
        .status(400)
        .json({ message: "Orders array bo'sh bo'lmasligi kerak" });
    }

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({ message: "Iltimos, marker tanlang" });
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

      // const geocodeRes = await fetch(
      //   `https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json`,
      //   { headers: { "User-Agent": "MyApp/1.0" } }
      // );
      // const geocodeData = await geocodeRes.json();
      const address = "Tizim xatosi "

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
        buyerChatId: req.body.buyerChatId,
        location: {
          lat: location.lat,
          lng: location.lng,
          address,
        },
      });

      await pending.save();
      pendingProducts.push(pending);

      try {
        await bot.sendMessage(
          basketItem.product.createdBy.chatId,
          `Sizning mahsulotingiz "${
            basketItem.product.name
          }" tasdiqlanishi kutilmoqda.⌚\nMijoz👤: ${
            userName ? "@" + userName : "Anonim"
          }\nMobil Raqam📞: ${phone}\nSotib olmoqchi🧺: ${
            quantity || basketItem.quantity
          } ta\nManzil📍: ${address}`,
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

router.get("/my-pending/seller", tokenCheck, async (req, res) => {
  try {
    const pendingOrders = await PendingProduct.find({
      createdBy: req.userId,
    })
      .populate("buyer", "name userName")
      .populate("product");

    res.json(pendingOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.delete("/delete/:id", async (req, res) => {
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

router.get("/pending/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pendingOrder = await PendingProduct.findById(id)
      .populate("product", "name")
      .populate("buyer", "userName");

    if (!pendingOrder)
      return res.status(404).json({ message: "Pending product topilmadi" });

    res.json({
      pendingId: pendingOrder._id,
      customerChatId: pendingOrder.buyerChatId,
      productName: pendingOrder.product?.name || "",
      buyerName: pendingOrder.buyer?.userName || "",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
