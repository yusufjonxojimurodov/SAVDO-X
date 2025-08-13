const express = require("express");
const router = express.Router();
const PendingProduct = require("../models/pending.products");
const ProductModel = require("../models/products");
const permission = require("../utils/roleCheck");
const jwt = require("jsonwebtoken");

const tokenCheck = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token topilmadi" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token noto‘g‘ri yoki eskirgan" });
  }
};

router.post(
  "/create",
  tokenCheck,
  permission(["admin", "seller"]),
  async (req, res) => {
    try {
      const { productId } = req.body;

      const product = await ProductModel.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Mahsulot topilmadi" });
      }

      // faqat o'z mahsulotini qo'sha oladi
      if (product.createdBy.toString() !== req.userId.toString()) {
        return res
          .status(403)
          .json({ message: "Bu mahsulot sizga tegishli emas" });
      }

      const pending = new PendingProduct({
        product: product._id,
        createdBy: req.userId,
      });
      await pending.save();

      res
        .status(201)
        .json({ message: "Mahsulot tasdiqlash jarayoniga qo‘shildi", pending });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

// 2. Sotuvchining pending mahsulotlarini olish
router.get(
  "/my",
  tokenCheck,
  permission(["admin", "seller"]),
  async (req, res) => {
    try {
      const myPending = await PendingProduct.find({
        createdBy: req.userId,
      }).populate("product");
      res.json(myPending);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

// 3. Tasdiqlash yoki bekor qilish
router.post(
  "/decision",
  tokenCheck,
  permission(["admin", "seller"]),
  async (req, res) => {
    try {
      const { productId, status } = req.body;

      const pending = await PendingProduct.findOne({
        product: productId,
        createdBy: req.userId,
      });
      if (!pending) {
        return res.status(404).json({
          message: "Pending mahsulot topilmadi yoki sizga tegishli emas",
        });
      }

      if (status === "success") {
        await PendingProduct.findByIdAndDelete(pending._id);
        return res.json({ message: "Mahsulot tasdiqlandi va sotildi" });
      } else if (status === "cancel") {
        await PendingProduct.findByIdAndDelete(pending._id);
        return res.json({ message: "Mahsulot bekor qilindi" });
      } else {
        return res.status(400).json({ message: "Status noto‘g‘ri" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

module.exports = router;
