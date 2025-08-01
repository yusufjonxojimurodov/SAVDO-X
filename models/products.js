const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    image: { type: String },
    name: {
      type: String,
      required: [true, "Mahsulotga Nomi kirgizilishi shart !"],
    },
    description: {
      type: String,
      required: [true, "Mahsulotga izoh kiritilishi shart"],
    },
    price: {
      type: Number,
      required: [true, "Mahsulot narxi kiritilishi shart"],
    },
    model: {
      type: String,
      required: [true, "Telefon modelini kiritish shart"],
    },
    left: {
      type: Number,
      required: [true, "Mahsulot qoldigini kiritish shart!"]
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
