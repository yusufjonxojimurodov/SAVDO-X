const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const BasketProduct = require("../models/basketProduct.js");
const PendingProduct = require("../models/pending.products.js");
const { bot } = require("../bot/index.js");
const tokenCheck = require("../middleware/token.js");
const { clients } = require("../websocket/notifications.server.js");

async function sendNotification(user, message) {
  const time = new Date().toLocaleTimeString();

  const wsClient = clients.get(user._id.toString());
  if (wsClient && wsClient.readyState === 1) {
    wsClient.send(
      JSON.stringify({
        type: "notification",
        message,
        time,
      })
    );
  }

  if (user.chatId) {
    await bot.sendMessage(user.chatId, message);
  }
}

router.post("/add/:pendingId/:address", tokenCheck, async (req, res) => {
  try {
    const { pendingId, address } = req.params;

    if (!pendingId || !address)
      return res.status(400).json({ message: "pendingId va address kerak" });

    const pending = await PendingProduct.findById(pendingId).populate(
      "product createdBy buyer"
    );

    if (!pending)
      return res.status(404).json({ message: "PendingProduct topilmadi" });

    const { product = {}, createdBy: seller = {}, buyer = {} } = pending;

    if (!product.left || product.left < pending.quantity) {
      if (seller.chatId && !product._notified) {
        await sendNotification(
          seller,
          `⚠️ ${product.name} mahsulotingiz sotuvda qolmadi.\nAgar omborda bo'lsa saytga kirib yangilang!`
        );
        product._notified = true;
        await product.save();
      }

      await PendingProduct.findByIdAndDelete(pendingId);

      if (buyer.chatId) {
        await sendNotification(
          buyer,
          `❌ Afsuski, siz buyurtma qilgan ${product.name} mahsuloti omborda qolmagan.`
        );
      }

      return res
        .status(400)
        .json({ message: "❌ Bu mahsulot sotuvda qolmagan" });
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

    product.left -= pending.quantity;

    if (product.left <= 0 && seller.chatId && !product._notified) {
      await sendNotification(
        seller,
        `⚠️ ${product.name} mahsulotingiz sotuvda qolmadi.\nAgar omborda bo'lsa saytga kirib yangilang!`
      );
      product._notified = true;
    }

    await product.save();
    await PendingProduct.findByIdAndDelete(pendingId);

    await sendNotification(
      buyer,
      `✅ Sizning ${product.name} mahsulotingiz tasdiqlandi va tez orada yetkazib beriladi.`
    );

    res.json({
      message: "✅ Mahsulot yetkazish jarayoniga o‘tkazildi",
      delivery: newDelivery,
    });
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

    const formattedOrders = pendingOrders.map((order) => {
      const obj = order.toObject ? order.toObject() : order;

      if (obj.product) {
        const productObj = obj.product.toObject
          ? obj.product.toObject()
          : obj.product;

        if (
          productObj._id &&
          productObj.images &&
          productObj.images.length > 0
        ) {
          productObj.images = productObj.images.map(
            (_, index) =>
              `${process.env.URL}/api/products/product/${productObj._id}/image/${index}`
          );
        } else {
          productObj.images = [];
        }

        obj.product = productObj;
      }

      return obj;
    });

    res.json(formattedOrders);
  } catch (err) {
    console.error("my-pending/seller error:", err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const pending = await PendingProduct.findById(id).populate(
      "product createdBy buyer"
    );

    if (!pending) {
      return res.status(404).json({ message: "PendingProduct topilmadi" });
    }

    const { product = {}, createdBy: seller = {}, buyer = {} } = pending;

    await PendingProduct.findByIdAndDelete(id);

    if (buyer._id) {
      await sendNotification(
        buyer,
        `❌ Sotuvchi siz buyurtma qilgan "${product.name}" mahsulotini bekor qildi.`
      );
    }

    if (seller._id) {
      await sendNotification(
        seller,
        `⚠️ Siz "${product.name}" mahsulotini bekor qildingiz va buyurtma o‘chirildi.`
      );
    }

    res.json({
      message: "PendingProduct muvaffaqiyatli o‘chirildi",
      deleted: pending,
    });
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
