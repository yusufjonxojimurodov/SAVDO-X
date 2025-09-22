const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: String,
    productType: String,
    productModel: String,

    seller: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      userName: String,
      phone: String,
    },

    complainant: {
      fullName: String,
      userName: String,
      phone: String,
    },

    message: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
