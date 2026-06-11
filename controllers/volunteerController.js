const Volunteer = require("../models/Volunteer");
const User = require("../models/User");
const Analytics = require("../models/Analytics");
const { triggerVolunteer, triggerAnalytics } = require("../utils/n8n");

// POST /api/volunteers/register  — Become a volunteer
exports.register = async (req, res) => {
  try {
    const { skills, availability, location, bloodGroup } = req.body;

    // Check already registered
    const existing = await Volunteer.findOne({ user: req.user._id });
    if (existing)
      return res.status(400).json({ success: false, message: "Already registered as volunteer" });

    const volunteer = await Volunteer.create({
      user: req.user._id,
      skills: skills || [],
      availability: availability || "on-call",
      location,
      bloodGroup: bloodGroup || req.user.bloodGroup || "",
    });

    // Update user role
    await User.findByIdAndUpdate(req.user._id, { role: "volunteer" });

    // ── N8n Trigger ──────────────────────────────────────────────
    const n8nPayload = {
      event: "volunteer_register",
      volunteerId: volunteer._id,
      user: {
        id: req.user._id,
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email,
      },
      skills,
      availability,
      location,
      bloodGroup: volunteer.bloodGroup,
      registeredAt: volunteer.createdAt,
    };
    const n8nRes = await triggerVolunteer(n8nPayload);
    if (n8nRes?.runId) {
      volunteer.n8nRunId = n8nRes.runId;
      await volunteer.save();
    }

    // ── Analytics ────────────────────────────────────────────────
    await Analytics.create({
      event: "volunteer_joined",
      userId: req.user._id,
      meta: { volunteerId: volunteer._id, skills },
    });
    await triggerAnalytics({ event: "volunteer_joined", userId: req.user._id });

    res.status(201).json({ success: true, volunteer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/volunteers  — List all volunteers (with filters)
exports.getVolunteers = async (req, res) => {
  try {
    const { skill, available, bloodGroup, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (skill) filter.skills = skill;
    if (available === "true") filter.isAvailableNow = true;
    if (bloodGroup) filter.bloodGroup = bloodGroup;

    const volunteers = await Volunteer.find(filter)
      .populate("user", "name phone email avatar")
      .sort({ tasksCompleted: -1, rating: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Volunteer.countDocuments(filter);
    res.json({ success: true, total, volunteers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/volunteers/nearby  — Nearby available volunteers
exports.getNearby = async (req, res) => {
  try {
    const { lng, lat, radius = 5000, skill } = req.query;
    if (!lng || !lat)
      return res.status(400).json({ success: false, message: "lng and lat required" });

    const filter = {
      isAvailableNow: true,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: Number(radius),
        },
      },
    };
    if (skill) filter.skills = skill;

    const volunteers = await Volunteer.find(filter)
      .populate("user", "name phone avatar")
      .limit(20);

    res.json({ success: true, volunteers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/volunteers/:id
exports.getVolunteer = async (req, res) => {
  try {
    const volunteer = await Volunteer.findById(req.params.id)
      .populate("user", "name phone email avatar bloodGroup");
    if (!volunteer)
      return res.status(404).json({ success: false, message: "Volunteer not found" });
    res.json({ success: true, volunteer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/volunteers/availability  — Toggle availability
exports.toggleAvailability = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOne({ user: req.user._id });
    if (!volunteer)
      return res.status(404).json({ success: false, message: "Volunteer profile not found" });

    volunteer.isAvailableNow = !volunteer.isAvailableNow;
    await volunteer.save();
    res.json({ success: true, isAvailableNow: volunteer.isAvailableNow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/volunteers/accept/:requestId  — Accept a request
exports.acceptRequest = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOne({ user: req.user._id });
    if (!volunteer)
      return res.status(404).json({ success: false, message: "Volunteer profile not found" });

    const Request = require("../models/Request");
    const request = await Request.findById(req.params.requestId);
    if (!request)
      return res.status(404).json({ success: false, message: "Request not found" });

    request.assignedTo.addToSet(req.user._id);
    request.status = "active";
    await request.save();

    volunteer.activeRequest = request._id;
    volunteer.isAvailableNow = false;
    await volunteer.save();

    await triggerAnalytics({
      event: "volunteer_accepted_request",
      volunteerId: volunteer._id,
      requestId: request._id,
      category: request.category,
    });

    res.json({ success: true, message: "Request accepted", request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/volunteers/me  — My volunteer profile
exports.getMyProfile = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOne({ user: req.user._id })
      .populate("user", "name phone email avatar");
    if (!volunteer)
      return res.status(404).json({ success: false, message: "Not registered as volunteer" });
    res.json({ success: true, volunteer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
