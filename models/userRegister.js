const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const schemaCreateAccount = new mongoose.Schema({
  name: {
    type: String,
  },
  surname: {
    type: String,
  },
  userName: {
    type: String,
    required: [true, "User Name kiritilishi shart"],
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Parol kiritilishi shart"],
  },
});

schemaCreateAccount.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.model("User", schemaCreateAccount);

module.exports = User;
