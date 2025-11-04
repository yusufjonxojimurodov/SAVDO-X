const mongoose = require("mongoose");

const webSiteSchema = new mongoose.Schema({
  status: {
    type: Number,
    enum: [200, 400, 500],
    default: 200,
  },
  text: {
    type: String,
    required: true
  }
});

const WEBSITE = mongoose.model("website", webSiteSchema);

module.exports = WEBSITE;
