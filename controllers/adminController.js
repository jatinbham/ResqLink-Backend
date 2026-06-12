const User = require("../models/User");
const Request = require("../models/Request");
const Volunteer = require("../models/Volunteer");
const Alert = require("../models/Alert");
const Donation = require("../models/Donation");

// GET /api/admin/users
exports.getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select("-password -otp -otpExpiry")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);
    res.json({ success: true, total, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// PATCH /api/admin/users/:id/role
exports.changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ["user", "volunteer", "admin", "requester"]; // ✅ requester add kiya
    if (!allowed.includes(role))
      return res.status(400).json({ success: false, message: "Invalid role" });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password -otp -otpExpiry");

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/users/:id/ban
exports.toggleBan = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    user.isActive = !user.isActive;
    await user.save();

    res.json({ success: true, isActive: user.isActive, message: `User ${user.isActive ? "unbanned" : "banned"}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/overview  — Full system overview
exports.getOverview = async (req, res) => {
  try {
    const [users, volunteers, requests, alerts, donations] = await Promise.all([
      User.countDocuments(),
      Volunteer.countDocuments(),
      Request.countDocuments(),
      Alert.countDocuments({ isActive: true }),
      Donation.countDocuments(),
    ]);

    const recentRequests = await Request.find()
      .populate("user", "name phone")
      .sort({ createdAt: -1 })
      .limit(5);

    const recentUsers = await User.find()
      .select("name phone role createdAt")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      overview: {
        counts: { users, volunteers, requests, alerts, donations },
        recentRequests,
        recentUsers,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/volunteers/:id/verify
exports.verifyVolunteer = async (req, res) => {
  try {
    const volunteer = await Volunteer.findByIdAndUpdate(
      req.params.id,
      { isVerified: true, verifiedAt: new Date() },
      { new: true }
    ).populate("user", "name phone email");

    if (!volunteer)
      return res.status(404).json({ success: false, message: "Volunteer not found" });

    res.json({ success: true, volunteer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
