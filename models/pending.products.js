const mongoose = require("mongoose");

const pendingProductSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: String,
  description: String,
  price: Number,
  model: String,
  left: Number,
  image: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  quantity: Number,
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  buyerChatId: { type: String },
  phone: String,
  userName: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PendingProduct", pendingProductSchema);
