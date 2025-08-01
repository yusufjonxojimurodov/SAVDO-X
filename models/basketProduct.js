const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const basketProductSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, default: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BasketProduct", basketProductSchema);
