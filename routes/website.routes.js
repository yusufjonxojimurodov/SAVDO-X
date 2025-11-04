const express = require("express");
const router = express.Router();
const WEBSITE = require("../models/website.model.js");
const tokenCheck = require("../middleware/token.js");
const permission = require("../utils/roleCheck.js");

router.put(
  "/update/platform/status",
  tokenCheck,
  permission(["admin"]),
  async (req, res) => {
    try {
      const { status, text } = req.body;

      if (status && ![200, 400, 500].includes(status)) {
        return res.status(400).json({ message: "Noto‘g‘ri status qiymati" });
      }

      const updateData = {};
      if (status !== undefined) updateData.status = status;
      if (text !== undefined) updateData.text = text;

      const updated = await WEBSITE.findOneAndUpdate({}, updateData, {
        new: true,
        upsert: true,
      });

      res.json({
        message: "Platforma holati yangilandi",
        website: updated,
      });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ message: "Serverda xatolik" });
    }
  }
);

router.get("/get/platform/status", async (req, res) => {
  try {
    const platformStatus = await WEBSITE.findOne();

    res.json({
      status: platformStatus.status,
      text: platformStatus.text || "",
    });
  } catch (error) {
    console.error("GET error:", error);
    res.status(500).json({ message: "Serverda xatolik" });
  }
});

module.exports = router;
