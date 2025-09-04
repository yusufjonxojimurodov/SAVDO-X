const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const MonthlySale = require("../models/monthlySale.model");

const JWT_TOKEN = process.env.JWT_TOKEN;

const tokenCheck = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "Foydalanuvchi tokeni topilmadi" });
  try {
    const decoded = jwt.verify(token, JWT_TOKEN);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: "Foydalanuvchi tokeni yoq yoki eskirgan" });
  }
};

router.get("/sales", tokenCheck, async (req, res) => {
  try {
    const { year } = req.query; 
    let filter = { sellerId: req.userId };

    if (year) {
      filter.year = parseInt(year); 
    }

    const stats = await MonthlySale.find(filter).sort({
      year: 1,
      month: 1,
    });

    res.json(stats);
  } catch (error) {
    console.error("❌ Monthly sales error:", error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get("/sales/yearly", tokenCheck, async (req, res) => {
  try {
    const stats = await MonthlySale.aggregate([
      { $match: { sellerId: req.userId } },
      {
        $group: {
          _id: "$year",
          totalSold: { $sum: "$soldCount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(stats);
  } catch (error) {
    console.error("❌ Yearly sales error:", error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
