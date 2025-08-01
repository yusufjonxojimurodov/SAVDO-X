const express = require("express");
const router = express.Router();
const BasketProduct = require("../models/basketProduct.js");
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

router.post("/add", tokenCheck, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    let basketItem = await BasketProduct.findOne({
      user: req.userId,
      product: productId,
    });

    if (basketItem) {
      basketItem.quantity += quantity;
      await basketItem.save();
    } else {
      basketItem = new BasketProduct({
        user: req.userId,
        product: productId,
        quantity,
      });
      await basketItem.save();
    }

    res.status(201).json(basketItem);
  } catch (err) {
    if (err.name === "ValidationError")
      res.status(400).json({ message: "Notogri ma'lumot yuborildi" });
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get("/", tokenCheck, async (req, res) => {
  try {
    const basket = await BasketProduct.find({ user: req.userId }).populate(
      "product"
    );
    res.json(basket);
  } catch (err) {
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.delete("/delete", tokenCheck, async (req, res) => {
  try {
    const { ids } = req.query;
    const productIds = ids.split(",");

    await BasketProduct.deleteMany({
      user: req.userId,
      _id: { $in: productIds },
    });

    res.json({ message: "Tanlangan mahsulotlar o‘chirildi" });
  } catch (err) {
    res.status(500).json({ message: "Server xatosi" });
  }
});



module.exports = router;
