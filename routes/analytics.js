const express = require("express");
const router = express.Router();
const Request = require("../models/Request");
const User = require("../models/User");

// GET /api/analytics/kpis
router.get("/kpis", async (req, res) => {
  try {
    const totalRequests = await Request.countDocuments();
    const resolvedRequests = await Request.countDocuments({ status: "resolved" });
    const totalVolunteers = await User.countDocuments({ role: "volunteer" });

    res.json({
      success: true,
      data: {
        totalRequests,
        resolvedRequests,
        totalVolunteers,
        resolutionRate: totalRequests
          ? Math.round((resolvedRequests / totalRequests) * 100)
          : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/analytics/response-trend?period=30d
router.get("/response-trend", async (req, res) => {
  try {
    const days = parseInt(req.query.period) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const requests = await Request.find({ createdAt: { $gte: since } })
      .select("createdAt status")
      .lean();

    // Group by date
    const byDate = {};
    requests.forEach(r => {
      const d = r.createdAt.toISOString().split("T")[0];
      if (!byDate[d]) byDate[d] = { date: d, total: 0, resolved: 0 };
      byDate[d].total++;
      if (r.status === "resolved") byDate[d].resolved++;
    });

    res.json({ success: true, data: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/analytics/request-mix?period=7d
router.get("/request-mix", async (req, res) => {
  try {
    const days = parseInt(req.query.period) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const mix = await Request.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } },
    ]);

    res.json({ success: true, data: mix });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/analytics/top-responders
router.get("/top-responders", async (req, res) => {
  try {
    const responders = await User.find({ role: "volunteer" })
      .select("name volunteerStats.tasksCompleted volunteerStats.rating")
      .sort({ "volunteerStats.tasksCompleted": -1 })
      .limit(10)
      .lean();

    res.json({ success: true, data: responders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/analytics/summary  (used by Dashboard)
router.get("/summary", async (req, res) => {
  try {
    const totalResolved = await Request.countDocuments({ status: "resolved" });
    const activeNearby  = await Request.countDocuments({ status: "active" });
    const onlineVols    = await User.countDocuments({ role: "volunteer", isActive: true });

    res.json({
      success: true,
      data: {
        livesAssisted:           totalResolved,
        livesAssistedDelta:      "+12 this week",
        avgResponse:             "8 min",
        avgResponseDelta:        "-2 min vs last week",
        trustScore:              "4.8",
        trustScoreDelta:         "stable",
        streak:                  "5 days",
        streakDelta:             "personal best",
        activeRequestsNearby:    activeNearby,
        verifiedRespondersOnline: onlineVols,
        badgeProgress:           68,
        nextBadge:               "First Responder Gold",
        communityStatus: {
          title:    "Community is active",
          desc:     "",
          donors:   "24",
          shelters: "8",
          avgEta:   "12 min",
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;