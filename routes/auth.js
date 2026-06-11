const express = require("express");
const router = express.Router();
const { signup, login, sendOtp, verifyOtp, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/signup", signup);
router.post("/login", login);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/me", protect, getMe);

module.exports = router;
