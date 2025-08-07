const express = require("express");
const router = express.Router();
const Comment = require("../models/coment.js");
const Product = require("../models/products.js");
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

router.post("/create/comment", tokenCheck, async (req, res) => {
  try {
    const { productId, text, rating } = req.body;

    if (!["happy", "unhappy"].includes(rating)) {
      return res.status(400).json({ message: "Rating qiymati noto‘g‘ri" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    const newComment = new Comment({
      productId,
      text,
      userId: req.userId,
      rating,
    });

    await newComment.save();

    const populated = await Comment.findById(newComment._id)
      .populate("userId", "userName")
      .populate("productId", "name");

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Komment qo‘shishda xatolik yuz berdi" });
  }
});

router.get("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const comments = await Comment.find({ productId })
      .populate("userId", "name surname")
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Kommentlarni olishda xatolik" });
  }
});

router.delete("/delete/:id", tokenCheck, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: "Komment topilmadi" });
    }

    if (comment.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Ruxsat yo‘q" });
    }

    await comment.deleteOne();
    res.json({ message: "Komment o‘chirildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Komment o‘chirishda xatolik" });
  }
});

module.exports = router;
