const express = require("express");
const router = express.Router();
const BasketProduct = require("../models/basketProduct.js");
const tokenCheck = require("../middleware/token.js")

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
    const { search } = req.query;

    let filter = { user: req.userId };

    if (search) {
      filter = {
        ...filter,
      };
    }

    const basket = await BasketProduct.find(filter)
      .populate({
        path: "product",
        match: search
          ? { name: { $regex: search, $options: "i" } }
          : {},
      });

    const filteredBasket = basket.filter((b) => b.product !== null);

    res.json(filteredBasket);
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