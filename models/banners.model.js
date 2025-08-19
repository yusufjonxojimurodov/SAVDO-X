const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
