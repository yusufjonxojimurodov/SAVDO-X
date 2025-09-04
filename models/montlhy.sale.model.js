const mongoose = require("mongoose");

const monthlySaleSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  soldCount: { type: Number, default: 0 },
});

monthlySaleSchema.index({ sellerId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("MonthlySale", monthlySaleSchema);
