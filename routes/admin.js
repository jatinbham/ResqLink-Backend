const express = require("express");
const router = express.Router();
const {
  getUsers,
  changeRole,
  toggleBan,
  getOverview,
  verifyVolunteer,
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");
const User = require("../models/User");
const Request = require("../models/Request");

// All admin routes are protected + admin only
router.use(protect, adminOnly);

// ── Existing routes ───────────────────────────────────────────────────────────
router.get("/overview",                   getOverview);
router.get("/users",                      getUsers);
router.patch("/users/:id/role",           changeRole);
router.patch("/users/:id/ban",            toggleBan);
router.patch("/volunteers/:id/verify",    verifyVolunteer);

// ── New routes (required by AdminPage frontend) ───────────────────────────────

// GET /api/admin/kpis
router.get("/kpis", async (req, res) => {
  try {
    const totalUsers      = await User.countDocuments();
    const totalVolunteers = await User.countDocuments({ role: "volunteer" });
    const totalRequests   = await Request.countDocuments();
    const openRequests    = await Request.countDocuments({ status: "active" });

    res.json({ success: true, data: { totalUsers, totalVolunteers, totalRequests, openRequests } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/verifications/pending
router.get("/verifications/pending", async (req, res) => {
  try {
    const pending = await User.find({ role: "volunteer", isVerified: false })
      .select("name phone email createdAt")
      .lean();
    res.json({ success: true, data: pending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/verifications/:id/approve
router.post("/verifications/:id/approve", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isVerified: true });
    res.json({ success: true, message: "Volunteer approved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/verifications/:id/reject
router.post("/verifications/:id/reject", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { role: "user", isVerified: false });
    res.json({ success: true, message: "Volunteer rejected" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/moderation
router.get("/moderation", async (req, res) => {
  try {
    const flagged = await Request.find({ flagged: true })
      .select("title category urgency createdAt flagReason")
      .lean();
    res.json({ success: true, data: flagged });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/moderation/:id/dismiss
router.post("/moderation/:id/dismiss", async (req, res) => {
  try {
    await Request.findByIdAndUpdate(req.params.id, { flagged: false });
    res.json({ success: true, message: "Dismissed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/category-stats?period=7d
router.get("/category-stats", async (req, res) => {
  try {
    const days  = parseInt(req.query.period) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await Request.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } },
    ]);

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/live-activity
router.get("/live-activity", async (req, res) => {
  try {
    const recent = await Request.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title category urgency status createdAt")
      .lean();
    res.json({ success: true, data: recent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;