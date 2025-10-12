const express = require("express");
const router = express.Router();
const StatisticWebsite = require("../models/statistic.website.model")

router.get("/", async (req, res) => {
  try {
    let { month, year } = req.query;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based

    year = parseInt(year) || currentYear;
    month = parseInt(month) || currentMonth;

    // Oy boshi va oxiri
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    // Shu oraliqdagi ma'lumotlarni topamiz
    const stats = await StatisticWebsite.find({
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort({ date: 1 });

    // 4 hafta bo‘yicha ajratamiz
    const weeks = [[], [], [], []];
    stats.forEach((item) => {
      const day = new Date(item.date).getDate();
      const weekIndex = Math.min(Math.floor((day - 1) / 7), 3);
      weeks[weekIndex].push(item);
    });

    // Har hafta uchun yig‘indilar
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

    // Yakuniy javob
    res.json({
      month,
      year,
      totalVisits: weeklySummary.reduce((s, w) => s + w.visits, 0),
      totalUsers: weeklySummary.reduce((s, w) => s + w.users, 0),
      totalPageViews: weeklySummary.reduce((s, w) => s + w.pageViews, 0),
      weekly: weeklySummary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
});

module.exports = router;
