const User = require("../models/userRegister.js");

const permission = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "Sizga ruxsat yo'q!" });
      }
      req.user = user;
      next();
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  };
};

module.exports = permission;
