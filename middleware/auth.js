const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer "))
      return res.status(401).json({ success: false, message: "Not authorized, no token" });

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select("-password -otp -otpExpiry");
    if (!req.user)
      return res.status(401).json({ success: false, message: "User not found" });

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token invalid or expired" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ success: false, message: "Admin access required" });
  next();
};

const volunteerOrAdmin = (req, res, next) => {
  if (!["volunteer", "admin"].includes(req.user?.role))
    return res.status(403).json({ success: false, message: "Volunteer or admin access required" });
  next();
};

module.exports = { protect, adminOnly, volunteerOrAdmin };
