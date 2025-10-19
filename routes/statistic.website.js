const express = require("express");
const router = express.Router();
const StatisticWebsite = require("../models/statistic.website.model");
const User = require("../models/userRegister.js")

router.get("/", async (req, res) => {
  try {
    let { month, year } = req.query;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    year = parseInt(year) || currentYear;
    month = parseInt(month) || currentMonth;

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const stats = await StatisticWebsite.find({
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort({ date: 1 });

    const weeks = [[], [], [], []];
    stats.forEach((item) => {
      const day = new Date(item.date).getDate();
      const weekIndex = Math.min(Math.floor((day - 1) / 7), 3);
      weeks[weekIndex].push(item);
    });

    const weeklySummary = weeks.map((week, i) => {
      const visits = week.reduce((sum, d) => sum + d.visits, 0);
      const users = week.reduce((sum, d) => sum + d.users, 0);
      const pageViews = week.reduce((sum, d) => sum + d.pageViews, 0);
      return {
        week: i + 1,
        visits,
        users,
        pageViews,
      };
    });

    const totalUsersCount = await User.countDocuments();
    const sellerCount = await User.countDocuments({ role: "seller" });
    const customerCount = await User.countDocuments({ role: "customer" });
    const moderatorCount = await User.countDocuments({ role: "moderator" });
    const blockedCount = await User.countDocuments({ role: "blocked" });

    res.json({
      month,
      year,
      totalVisits: weeklySummary.reduce((s, w) => s + w.visits, 0),
      totalUsers: weeklySummary.reduce((s, w) => s + w.users, 0),
      totalPageViews: weeklySummary.reduce((s, w) => s + w.pageViews, 0),
      weekly: weeklySummary,
      usersStats: {
        totalUsersCount,
        sellerCount,
        customerCount,
        moderatorCount,
        blockedCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
});

router.post("/track", async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59
    );

    let stat = await StatisticWebsite.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!stat) {
      stat = new StatisticWebsite({
        date: today,
        visits: 1,
      });
    } else {
      stat.visits += 1;
      stat.pageViews += 1;
    }

    await stat.save();

    res.json({ message: "Statistika yangilandi ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatoligi" });
  }
});

module.exports = router;