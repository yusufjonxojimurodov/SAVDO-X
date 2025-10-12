const mongoose = require("mongoose");

const statisticWebsiteSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  visits: { type: Number, default: 0 },
  users: { type: Number, default: 0 },
  pageViews: { type: Number, default: 0 },
});

module.exports = mongoose.model("StatisticWebsite", statisticWebsiteSchema);
