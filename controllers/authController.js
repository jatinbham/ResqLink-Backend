const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/auth/send-otp
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone)
      return res.status(400).json({ success: false, message: "Phone required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await User.findOneAndUpdate(
      { phone },
      {
        otp,
        otpExpiry,
        $setOnInsert: { name: "Temporary User" },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[OTP] ${phone} → ${otp}`);

    res.json({
      success: true,
      message: "OTP sent",
      ...(process.env.NODE_ENV !== "production" && { otp }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp, name } = req.body;
    if (!phone || !otp)
      return res.status(400).json({ success: false, message: "Phone and OTP required" });

    const user = await User.findOne({ phone });
    if (!user || user.otp !== otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    if (user.otpExpiry < new Date())
      return res.status(400).json({ success: false, message: "OTP expired" });

    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isVerified = true;
    if (name) user.name = name;

    await user.save();

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/signup
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, bloodGroup, role } = req.body;

    if (!name)
      return res.status(400).json({ success: false, message: "Name is required" });
    if (!email && !phone)
      return res.status(400).json({ success: false, message: "Email or phone required" });

    const mappedRole = role || "user";

    const user = await User.findOneAndUpdate(
      { phone },
      {
        name,
        email: email || undefined,
        password: password || undefined,
        bloodGroup: bloodGroup || "",
        role: mappedRole,
        isVerified: true,
      },
      { new: true, runValidators: true }
    );

    if (!user)
      return res.status(404).json({ success: false, message: "User not found. Please send OTP first." });

    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        bloodGroup: user.bloodGroup,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!email && !phone)
      return res.status(400).json({ success: false, message: "Email or phone required" });

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    if (password) {
      const valid = await user.comparePassword(password);
      if (!valid)
        return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        bloodGroup: user.bloodGroup,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};