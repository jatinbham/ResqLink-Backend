const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

// POST /api/auth/signup
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, bloodGroup, role } = req.body;

    if (!name) return res.status(400).json({ success: false, message: "Name is required" });
    if (!email && !phone)
      return res.status(400).json({ success: false, message: "Email or phone required" });

    // Check existing
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing)
      return res.status(400).json({ success: false, message: "User already exists" });

    const user = await User.create({
      name,
      email: email || undefined,
      phone: phone || undefined,
      password: password || undefined,
      bloodGroup: bloodGroup || "",
      role: role === "admin" ? "user" : role || "user", // prevent self-admin
      isVerified: false,
    });

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

// POST /api/auth/send-otp
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone)
      return res.status(400).json({ success: false, message: "Phone required" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Upsert user with OTP
    await User.findOneAndUpdate(
      { phone },
      { otp, otpExpiry },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // TODO: Send via Twilio when configured
    // For now, return OTP in dev mode
    const isDev = process.env.NODE_ENV !== "production";
    console.log(`[OTP] ${phone} → ${otp}`);

    res.json({
      success: true,
      message: "OTP sent",
      ...(isDev && { otp }), // Remove in production!
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
    if (name && !user.name) user.name = name;
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

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};
