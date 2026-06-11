const Analytics = require("../models/Analytics");
const Request = require("../models/Request");
const Volunteer = require("../models/Volunteer");
const User = require("../models/User");
const Donation = require("../models/Donation");
const { triggerAnalytics } = require("../utils/n8n");

// GET /api/analytics/summary  — Main KPI dashboard data
exports.getSummary = async (req, res) => {
  try {
    const [
      totalRequests,
      fulfilledRequests,
      activeRequests,
      totalVolunteers,
      activeVolunteers,
      totalUsers,
      totalDonations,
    ] = await Promise.all([
      Request.countDocuments(),
      Request.countDocuments({ status: "fulfilled" }),
      Request.countDocuments({ status: { $in: ["pending", "active"] } }),
      Volunteer.countDocuments(),
      Volunteer.countDocuments({ isAvailableNow: true }),
      User.countDocuments({ role: "user" }),
      Donation.countDocuments({ status: { $in: ["collected", "distributed"] } }),
    ]);

    // Category breakdown
    const categoryBreakdown = await Request.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    // Priority breakdown
    const priorityBreakdown = await Request.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    // Requests over last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyRequests = await Request.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Volunteers joined last 7 days
    const volunteerGrowth = await Volunteer.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const summary = {
      kpis: {
        totalRequests,
        fulfilledRequests,
        activeRequests,
        fulfillmentRate:
          totalRequests > 0
            ? ((fulfilledRequests / totalRequests) * 100).toFixed(1)
            : 0,
        totalVolunteers,
        activeVolunteers,
        totalUsers,
        totalDonations,
        livesAssisted: fulfilledRequests, // 1 request = 1 life assisted (can tweak)
      },
      categoryBreakdown,
      priorityBreakdown,
      dailyRequests,
      volunteerGrowth,
    };

    // ── N8n Trigger (analytics fetch event) ─────────────────────
    await triggerAnalytics({
      event: "analytics_viewed",
      userId: req.user?._id,
      snapshot: summary.kpis,
    });

    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/analytics/events  — Raw analytics events (admin)
exports.getEvents = async (req, res) => {
  try {
    const { event, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (event) filter.event = event;

    const events = await Analytics.find(filter)
      .populate("userId", "name role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Analytics.countDocuments(filter);
    res.json({ success: true, total, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/analytics/event  — Log a custom analytics event (from frontend)
exports.logEvent = async (req, res) => {
  try {
    const { event, category, meta } = req.body;
    if (!event)
      return res.status(400).json({ success: false, message: "Event name required" });

    const entry = await Analytics.create({
      event,
      category,
      userId: req.user?._id,
      meta: meta || {},
    });

    // Also push to n8n
    await triggerAnalytics({
      event,
      category,
      userId: req.user?._id,
      meta,
    });

    res.status(201).json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/analytics/leaderboard  — Top volunteers
exports.getLeaderboard = async (req, res) => {
  try {
    const volunteers = await Volunteer.find()
      .populate("user", "name avatar bloodGroup")
      .sort({ tasksCompleted: -1, rating: -1 })
      .limit(10);

    res.json({ success: true, leaderboard: volunteers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
