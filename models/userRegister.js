const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const schemaCreateAccount = new mongoose.Schema({
  name: String,
  surname: String,
  userName: {
    type: String,
    required: [false, "User Name kiritilishi shart"],
    unique: true,
  },
  password: {
    type: String,
    required: [false, "Parol kiritilishi shart"],
  },
  phone: {
    type: String,
    default: "",
  },
  avatar: {
    data: Buffer,
    contentType: String,
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
    enum: ["admin", "seller", "customer", "blocked", "moderator"],
    default: "customer",
  },
  permission: {
    type: Object,
    default: {
      editUsers: false,
      deleteUsers: false,
      updateRoleUsers: false,
      editProducts: false,
      deleteProducts: false,
      updateStatusProducts: false,
      updateProducts: false,
      createBanner: false,
      updateBanner: false,
      updateStatusBanner: false,
      deleteBanner: false
    }
  },
  points: {
    type: Number,
    default: 0,
  },
  rating: {
    type: Number,
    default: 1,
  },
  chatId: {
    type: Number,
    default: null,
  },
  faceFeature: {
    type: [Number],
    default: null,
  },
  faceRegistered: {
    type: Boolean,
    default: false,
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
