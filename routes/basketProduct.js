const express = require("express");
const router = express.Router();
const BasketProduct = require("../models/basketProduct.js");
const tokenCheck = require("../middleware/token.js");

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

    const basket = await BasketProduct.find(filter).populate({
      path: "product",
      match: search ? { name: { $regex: search, $options: "i" } } : {},
    });

    const filteredBasket = basket
      .filter((b) => b.product !== null)
      .map((b) => {
        let images = null;

        if (b.product._id && b.product.images) {
          images = b.product.images.map(
            (_, index) =>
              `${process.env.URL}/api/products/product/${b.product._id}/image/${index}`
          );
        }

        return {
          _id: b._id,
          quantity: b.quantity,
          productId: b.product._id,
          name: b.product.name,
          price: b.product.price,
          model: b.product.model,
          description: b.product.description,
          images,
          discount: b.product.discount || 0,
          discountPrice: b.product.discountPrice || null,
          left: b.product.left || 0,
        };
      });

    res.json(filteredBasket);
  } catch (err) {
    console.error(err);
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
