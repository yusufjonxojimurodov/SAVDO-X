const User = require("../models/userRegister.js");

function checkPermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      if (!user)
        return res.status(401).json({ message: "Foydalanuvchi topilmadi" });

      if (user.role === "admin") return next();

      if (user.role === "moderator") {
        if (user.permission && user.permission[requiredPermission])
          return next();
        return res.status(403).json({ message: "Admin tomonidan bu amalni sizga bajarishga ruxsat berilmagan !" });
      }

      if (
        user.role === "seller" &&
        requiredPermission.startsWith("updateStatus")
      )
        return next();

      return res.status(403).json({ message: "Admin tomonidan bu amalni sizga bajarishga ruxsat berilmagan !" });
    } catch (err) {
      console.error("checkPermission xato:", err.message);
      res.status(500).json({ message: "Server xatosi" });
    }
  };
}

module.exports = checkPermission;
