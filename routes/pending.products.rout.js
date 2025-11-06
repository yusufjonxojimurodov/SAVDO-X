const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const BasketProduct = require("../models/basketProduct.js");
const PendingProduct = require("../models/pending.products.js");
const { bot } = require("../bot/index.js");
const tokenCheck = require("../middleware/token.js");
const { clients } = require("../websocket/notifications.server.js");

async function sendNotification(user, message) {
  const time = Date.now();

  const wsClient = clients.get(user._id.toString());
  if (wsClient && wsClient.readyState === 1) {
    wsClient.send(JSON.stringify({ type: "notification", message, time }));
  }

  if (user.chatId) {
    try {
      await bot.sendMessage(user.chatId, message);
    } catch (err) {
      console.error("Botga xabar yuborishda xatolik:", err.message);
    }
  }
}

router.post("/add", tokenCheck, async (req, res) => {
  try {
    const { orders, phone, userName, location } = req.body;

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

      const product = basketItem.product;
      const seller = product.createdBy;

      // Mahsulot miqdorini tekshirish
      if (!product.left || product.left < (quantity || basketItem.quantity)) {
        await sendNotification(
          seller,
          `⚠️ ${product.name} mahsulotingiz omborda qolmagan!`
        );
        return res
          .status(400)
          .json({ message: "❌ Bu mahsulot sotuvda qolmagan" });
      }

      const pending = new PendingProduct({
        product: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        model: product.model,
        left: product.left,
        image: product.image,
        createdBy: seller._id,
        quantity: quantity || basketItem.quantity,
        buyer: req.userId,
        phone,
        userName,
        location: {
          lat: location.lat,
          lng: location.lng,
          address: "Tizim xatosi", // agar reverse geocode ishlatilmasa
        },
      });

      await pending.save();
      pendingProducts.push(pending);

      // Sotuvchiga WebSocket orqali xabar
      await sendNotification(
        seller,
        `📦 Mahsulotingiz "${product.name}" tasdiqlanishi kutilmoqda.`
      );

      // Telegram orqali xabar
      await bot.sendMessage(
        seller.chatId,
        `🛒 Mahsulotingiz "${
          product.name
        }" uchun yangi buyurtma keldi.\nMijoz👤: ${
          userName ? "@" + userName : "Anonim"
        }\n📞 Raqam: ${phone}\n🧺 Soni: ${
          quantity || basketItem.quantity
        } ta\n📍 Manzil: Tizim xatosi`,
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
    }

    res.status(201).json({
      message: "Mahsulotlar tasdiqlanishi kutilayotganlarga qo‘shildi",
      pendingProducts,
    });
  } catch (err) {
    console.error("❌ /add API xatosi:", err);
    res.status(500).json({ message: "Server xatosi", error: err.message });
  }
});

router.post("/add/:pendingId/:address", tokenCheck, async (req, res) => {
  try {
    const { pendingId, address } = req.params;

    if (!pendingId || !address) {
      return res
        .status(400)
        .json({ message: "pendingId va address parametrlari kerak" });
    }

    const pending = await PendingProduct.findById(pendingId).populate(
      "product createdBy buyer"
    );

    if (!pending)
      return res.status(404).json({ message: "PendingProduct topilmadi" });

    const { product, createdBy: seller, buyer } = pending;

    // Omborda mahsulot miqdorini kamaytirish
    product.left -= pending.quantity;
    if (product.left < 0) product.left = 0;
    await product.save();

    // Yetkazib berish modelini yaratish
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
    await PendingProduct.findByIdAndDelete(pendingId);

    await sendNotification(
      buyer,
      `✅ Sizning ${product.name} mahsulotingiz tasdiqlandi va tez orada yetkazib beriladi.`
    );

    if (product.left <= 0 && seller.chatId && !product._notified) {
      await sendNotification(
        seller,
        `⚠️ ${product.name} mahsulotingiz omborda qolmagan. Yangilashingizni tavsiya qilamiz.`
      );
      product._notified = true;
      await product.save();
    }

    res.json({
      message: "✅ Mahsulot yetkazish jarayoniga o‘tkazildi",
      delivery: newDelivery,
    });
  } catch (err) {
    console.error("❌ /add/:pendingId/:address xatosi:", err);
    res.status(500).json({ message: "Server xatosi", error: err.message });
  }
});

/**
 * 👤 3-API: Mening pending buyurtmalarim
 */
router.get("/my-pending/buyer", tokenCheck, async (req, res) => {
  try {
    const pendingOrders = await PendingProduct.find({
      buyer: req.userId,
    })
      .populate("product")
      .populate("createdBy", "name userName");

    const formattedOrders = pendingOrders.map((order) => {
      const obj = order.toObject();
      const product = obj.product || {};
      if (product._id && product.images && product.images.length > 0) {
        product.images = product.images.map(
          (_, index) =>
            `${process.env.URL}/api/products/product/${product._id}/image/${index}`
        );
      } else {
        product.images = [];
      }
      obj.product = product;
      return obj;
    });

    res.json(formattedOrders);
  } catch (err) {
    console.error("my-pending/buyer xatosi:", err);
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
