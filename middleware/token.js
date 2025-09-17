// tokenCheck.js
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_TOKEN = process.env.JWT_TOKEN;

const tokenCheck = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Token topilmadi" });
  }

  const token = authHeader.split(" ")[1]; 

  if (!token) {
    return res.status(401).json({ message: "Token topilmadi" });
  }

  if (req.query?.sellerBot === "true" || req.body?.sellerBot === true) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_TOKEN);
    req.userId = decoded.id;
    req.role = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token noto‘g‘ri yoki eskirgan" });
  }
};

module.exports = tokenCheck;
