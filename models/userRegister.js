const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const schemaCreateAccount = new mongoose.Schema({
  name: String,
  surname: String,
  userName: {
    type: String,
    required: [true, "User Name kiritilishi shart"],
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Parol kiritilishi shart"],
  },
  phone: {
    type: String,
    default: "",
  },
  avatar: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    default: "",
  },
  birthDate: {
    type: Date,
    default: "",
  },
  role: {
    type: String,
    enum: ["admin", "seller", "customer", "blocked"],
    default: "customer",
  },
  chatId: {
    type: Number,
    default: null,
  },
});

schemaCreateAccount.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

schemaCreateAccount.pre("save", function (next) {
  if (this.birthDate) {
    this.birthDate.setUTCHours(0, 0, 0, 0);
  }

  next();
});

const User = mongoose.model("User", schemaCreateAccount);
module.exports = User;
