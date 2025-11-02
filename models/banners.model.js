const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    productUrl: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "IN_ACTIVE"], default: "ACTIVE" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
