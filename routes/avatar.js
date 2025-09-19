const express = require("express");
const multer = require("multer");
const User = require("../models/userRegister");
const tokenCheck = require("../middleware/token.js");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/users/avatar",
  tokenCheck,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Rasm fayli yuborilmadi" });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      }

      user.avatar = {
        data: req.file.buffer,
        contentType: "image/jpeg",
      };
      await user.save();

      const avatarUrl = `${req.protocol}://${req.get(
        "host"
      )}/api/avatar/users/avatar/${user._id}/file`;

      res.json({
        message: "Avatar yuklandi",
        avatarUrl,
      });
    } catch (error) {
      console.error("Upload xatolik:", error.message);
      res.status(500).json({ message: "Rasm yuklashda xatolik" });
    }
  }
);

router.get("/users/get/avatar", tokenCheck, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.avatar || !user.avatar.data) {
      return res.status(404).json({ message: "Avatar topilmadi" });
    }

    const avatarUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/avatar/users/avatar/${user._id}/file`; 

    res.json({ avatarUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get("/users/avatar/:id/file", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.avatar || !user.avatar.data) {
      return res.status(404).json({ message: "Avatar topilmadi" });
    }

    res.contentType(user.avatar.contentType);
    res.send(user.avatar.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.delete("/users/avatar", tokenCheck, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.avatar) {
      return res.status(404).json({ message: "Avatar topilmadi" });
    }

    user.avatar = undefined;
    await user.save();

    res.json({ message: "Avatar o‘chirildi" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server xatosi" });
  }
});

module.exports = router;
