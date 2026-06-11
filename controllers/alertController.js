const Alert = require("../models/Alert");
const Analytics = require("../models/Analytics");
const { triggerAlert, triggerAnalytics } = require("../utils/n8n");

// POST /api/alerts  — Create alert (admin/volunteer)
exports.createAlert = async (req, res) => {
  try {
    const { type, category, title, message, location, expiresAt } = req.body;

    if (!title || !message)
      return res.status(400).json({ success: false, message: "Title and message required" });

    const alert = await Alert.create({
      type: type || "info",
      category: category || "general",
      title,
      message,
      location,
      createdBy: req.user._id,
      expiresAt: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h default
    });

    // ── N8n Trigger ──────────────────────────────────────────────
    const n8nPayload = {
      event: "alert_created",
      alertId: alert._id,
      type: alert.type,
      category: alert.category,
      title,
      message,
      location,
      createdBy: {
        id: req.user._id,
        name: req.user.name,
      },
      createdAt: alert.createdAt,
    };
    const n8nRes = await triggerAlert(n8nPayload);
    if (n8nRes?.runId) {
      alert.n8nRunId = n8nRes.runId;
      await alert.save();
    }

    await Analytics.create({
      event: "alert_created",
      category: alert.category,
      userId: req.user._id,
      meta: { alertId: alert._id, type: alert.type },
    });

    res.status(201).json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/alerts  — Get all active alerts
exports.getAlerts = async (req, res) => {
  try {
    const { type, category, active = "true" } = req.query;
    const filter = {};
    if (active === "true") {
      filter.isActive = true;
      filter.$or = [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }];
    }
    if (type) filter.type = type;
    if (category) filter.category = category;

    const alerts = await Alert.find(filter)
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/alerts/nearby
exports.getNearbyAlerts = async (req, res) => {
  try {
    const { lng, lat, radius = 10000 } = req.query;
    if (!lng || !lat)
      return res.status(400).json({ success: false, message: "lng and lat required" });

    const alerts = await Alert.find({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: Number(radius),
        },
      },
    })
      .populate("createdBy", "name role")
      .limit(20);

    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/alerts/:id/resolve
exports.resolveAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { isActive: false, type: "resolved" },
      { new: true }
    );
    if (!alert)
      return res.status(404).json({ success: false, message: "Alert not found" });

    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/alerts/:id/seen
exports.markSeen = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { seenBy: req.user._id } },
      { new: true }
    );
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/alerts/:id (admin only)
exports.deleteAlert = async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Alert deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
