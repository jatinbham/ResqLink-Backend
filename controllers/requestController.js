const Request = require("../models/Request");
const Analytics = require("../models/Analytics");
const { triggerRequestHelp, triggerAnalytics } = require("../utils/n8n");

// ── 1. POST /api/requests ──────────────────────────────────────────────
exports.createRequest = async (req, res) => {
  try {
    const { category, priority, title, description, location, details } = req.body;

    if (!category || !title)
      return res.status(400).json({ success: false, message: "Category and title required" });

    const request = await Request.create({
      user: req.user._id,
      category,
      priority: priority || "high",
      title,
      description,
      location,
      details: details || {},
    });

    const n8nPayload = {
      event: "request_help",
      requestId: request._id,
      category, priority: request.priority, title, description, location, details,
      user: { id: req.user._id, name: req.user.name, phone: req.user.phone, email: req.user.email },
      createdAt: request.createdAt,
    };
    const n8nRes = await triggerRequestHelp(n8nPayload);
    if (n8nRes?.runId) { request.n8nRunId = n8nRes.runId; await request.save(); }

    await Analytics.create({ event: "request_created", category, userId: req.user._id, meta: { requestId: request._id, priority } });
    await triggerAnalytics({ event: "request_created", category, priority, requestId: request._id });

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 2. GET /api/requests ───────────────────────────────────────────────
exports.getRequests = async (req, res) => {
  try {
    const { category, status, priority, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;

    const requests = await Request.find(filter)
      .populate("user", "name phone bloodGroup")
      .populate("assignedTo", "name phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Request.countDocuments(filter);
    res.json({ success: true, total, page: Number(page), requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 3. GET /api/requests/nearby ───────────────────────────────────────
exports.getNearbyRequests = async (req, res) => {
  try {
    const { lng, lat, radius = 5000, category } = req.query;
    if (!lng || !lat || lng === "null" || lat === "null")
      return res.status(400).json({ success: false, message: "Valid lng and lat required" });

    const filter = {
      status: { $in: ["pending", "active"] },
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: Number(radius),
        },
      },
    };
    if (category) filter.category = category;

    const requests = await Request.find(filter).populate("user", "name phone").limit(50);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 4. GET /api/requests/hospitals ────────────────────────────────────
exports.getHospitals = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng || lat === "null" || lng === "null")
      return res.status(400).json({ success: false, message: "Valid coordinates (lat, lng) required" });

    const mockHospitals = [
      { id: 1, name: "City Red Cross Hospital",      address: "Connaught Place, New Delhi", contact: "+91-11-23711551" },
      { id: 2, name: "Max Super Speciality Hospital", address: "Saket, New Delhi",           contact: "+91-11-26515050" },
      { id: 3, name: "AIIMS Trauma Centre",           address: "Ansari Nagar, New Delhi",    contact: "+91-11-26588500" },
    ];
    res.json({ success: true, hospitals: mockHospitals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 5. POST /api/requests/ai-preview ─────────────────────────────────
exports.getAIPreview = async (req, res) => {
  try {
    const { category, description, title } = req.body;
    const urgencyScore =
      description?.toLowerCase().includes("urgent") ||
      title?.toLowerCase().includes("emergency") ? 95 : 65;
    const recommendedAction =
      urgencyScore > 80 ? "Immediate Dispatch & Alert Blood Banks" : "Standard Route Verification Process";

    res.json({
      success: true,
      preview: {
        analyzed: true, urgencyScore,
        aiSummary: `Processed telemetry for ${category || "general medical query"}.`,
        recommendedAction,
        generatedAt: new Date(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 6. GET /api/requests/my ───────────────────────────────────────────
exports.myRequests = async (req, res) => {
  try {
    const requests = await Request.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 7. GET /api/requests/stats ────────────────────────────────────────
exports.getRequestStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const [result] = await Request.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          total:     { $sum: 1 },
          // FIX: tera model "active"/"fulfilled" use karta hai — dono cover kiye
          active:    { $sum: { $cond: [{ $in: ["$status", ["pending", "active", "matched", "in-progress"]] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $in: ["$status", ["fulfilled", "completed"]] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq:  ["$status", "cancelled"] }, 1, 0] } },
          avgResponseMs: {
            $avg: {
              $cond: [
                { $in: ["$status", ["fulfilled", "completed"]] },
                { $subtract: ["$updatedAt", "$createdAt"] },
                "$$REMOVE",
              ],
            },
          },
        },
      },
    ]);

    if (!result)
      return res.json({ active: 0, completed: 0, cancelled: 0, total: 0, avgResponse: "—", successRate: "—" });

    const avgMins = result.avgResponseMs ? Math.round(result.avgResponseMs / 60000) : null;
    const avgResponse = avgMins != null
      ? avgMins < 60 ? `${avgMins} min` : `${(avgMins / 60).toFixed(1)} hr`
      : "—";

    const ratable     = result.completed + result.cancelled;
    const successRate = ratable > 0 ? `${Math.round((result.completed / ratable) * 100)}%` : "—";

    res.json({ active: result.active, completed: result.completed, cancelled: result.cancelled, total: result.total, avgResponse, successRate });
  } catch (err) {
    console.error("getRequestStats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 8. GET /api/requests/:id ──────────────────────────────────────────
exports.getRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate("user", "name phone email bloodGroup")
      .populate("assignedTo", "name phone");

    if (!request)
      return res.status(404).json({ success: false, message: "Request not found" });

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 9. PATCH /api/requests/:id/status ────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["pending", "active", "fulfilled", "cancelled"];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status, ...(status === "fulfilled" && { fulfilledAt: new Date() }) },
      { new: true }
    );

    if (!request)
      return res.status(404).json({ success: false, message: "Request not found" });

    if (status === "fulfilled")
      await triggerAnalytics({ event: "request_fulfilled", category: request.category, requestId: request._id });

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── 10. DELETE /api/requests/:id ─────────────────────────────────────
exports.deleteRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request)
      return res.status(404).json({ success: false, message: "Request not found" });

    if (request.user.toString() !== req.user._id.toString() && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized" });

    await request.deleteOne();
    res.json({ success: true, message: "Request deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};