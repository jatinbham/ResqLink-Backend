const Request = require("../models/Request");
const Analytics = require("../models/Analytics");
const { triggerRequestHelp, triggerAnalytics } = require("../utils/n8n");

// POST /api/requests  — Create a new help request
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

    // ── N8n Trigger ──────────────────────────────────────────────
    const n8nPayload = {
      event: "request_help",
      requestId: request._id,
      category,
      priority: request.priority,
      title,
      description,
      location,
      details,
      user: {
        id: req.user._id,
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email,
      },
      createdAt: request.createdAt,
    };
    const n8nRes = await triggerRequestHelp(n8nPayload);
    if (n8nRes?.runId) {
      request.n8nRunId = n8nRes.runId;
      await request.save();
    }

    // ── Analytics event ──────────────────────────────────────────
    await Analytics.create({
      event: "request_created",
      category,
      userId: req.user._id,
      meta: { requestId: request._id, priority },
    });
    await triggerAnalytics({ event: "request_created", category, priority, requestId: request._id });

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/requests  — List requests (with filters)
exports.getRequests = async (req, res) => {
  try {
    const { category, status, priority, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
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

// GET /api/requests/nearby  — Requests near a location
exports.getNearbyRequests = async (req, res) => {
  try {
    const { lng, lat, radius = 5000, category } = req.query; // radius in meters
    if (!lng || !lat)
      return res.status(400).json({ success: false, message: "lng and lat required" });

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

    const requests = await Request.find(filter)
      .populate("user", "name phone")
      .limit(50);

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/requests/:id
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

// PATCH /api/requests/:id/status  — Update status (volunteer/admin)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["pending", "active", "fulfilled", "cancelled"];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const request = await Request.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(status === "fulfilled" && { fulfilledAt: new Date() }),
      },
      { new: true }
    );

    if (!request)
      return res.status(404).json({ success: false, message: "Request not found" });

    if (status === "fulfilled") {
      await triggerAnalytics({ event: "request_fulfilled", category: request.category, requestId: request._id });
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/requests/:id
exports.deleteRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request)
      return res.status(404).json({ success: false, message: "Request not found" });

    if (
      request.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    )
      return res.status(403).json({ success: false, message: "Not authorized" });

    await request.deleteOne();
    res.json({ success: true, message: "Request deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/requests/my  — Current user's requests
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
