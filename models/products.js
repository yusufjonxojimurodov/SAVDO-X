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
    type: {
      type: String,
      required: [true, "Mahsulot turi kiritilishi shart !"],
    },
    left: {
      type: Number,
      required: [true, "Mahsulot qoldigini kiritish shart!"],
    },
    discount: {
      type: Number,
      required: [false],
      default: 0,
    },
    discountPrice: {
      type: Number
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
