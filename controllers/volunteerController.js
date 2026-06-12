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


exports.getMyProfile = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOne({ user: req.user._id })
      .populate("user", "name phone email avatar");

    // Not registered as volunteer — return empty instead of 404
    // so frontend doesn't crash
    if (!volunteer) {
      return res.status(200).json({
        success: true,
        volunteer: null,
        isRegistered: false,
        message: "Not registered as volunteer yet",
      });
    }

    res.json({ success: true, volunteer, isRegistered: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// volunteerController.js mein ye 4 functions ADD karo (existing code ke neeche paste karo)

const Request = require("../models/Request");

// GET /api/volunteers/tasks  — Tasks near this volunteer
exports.getTasks = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOne({ user: req.user._id });

    // Volunteer registered nahi hai — empty list do, crash mat karo
    if (!volunteer) {
      return res.status(200).json({ success: true, tasks: [] });
    }

    // Nearby open requests fetch karo
    // Agar location hai to geo-query, warna latest requests
    let tasks;
    if (volunteer.location?.coordinates?.length === 2) {
      tasks = await Request.find({
        status: { $in: ["pending", "active"] },
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: volunteer.location.coordinates,
            },
            $maxDistance: 10000, // 10 km
          },
        },
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("requester", "name phone");
    } else {
      tasks = await Request.find({ status: { $in: ["pending", "active"] } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("requester", "name phone");
    }

    // Frontend ke liye shape karo
    const shaped = tasks.map((t) => ({
      _id:      t._id,
      title:    t.description || t.category,
      category: t.category,
      urgency:  t.urgency || "MEDIUM",
      distance: "Nearby",
      eta:      "~10 min",
      points:   50,
    }));

    res.json({ success: true, tasks: shaped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/volunteers/tasks/:taskId/accept
exports.acceptTask = async (req, res) => {
  try {
    const request = await Request.findById(req.params.taskId);
    if (!request)
      return res.status(404).json({ success: false, message: "Task not found" });

    request.assignedTo = request.assignedTo || [];
    if (!request.assignedTo.includes(req.user._id)) {
      request.assignedTo.push(req.user._id);
    }
    request.status = "active";
    await request.save();

    // Volunteer ko busy mark karo
    await Volunteer.findOneAndUpdate(
      { user: req.user._id },
      { isAvailableNow: false, activeRequest: request._id }
    );

    res.json({ success: true, message: "Task accepted", request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/volunteers/tasks/:taskId/decline
exports.declineTask = async (req, res) => {
  try {
    // Decline = sirf acknowledge karo, request wahi rehti hai
    res.json({ success: true, message: "Task declined" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/volunteers/duty  — Toggle on/off duty
exports.toggleDuty = async (req, res) => {
  try {
    const { onDuty } = req.body;

    const volunteer = await Volunteer.findOneAndUpdate(
      { user: req.user._id },
      { isAvailableNow: !!onDuty },
      { new: true }
    );

    if (!volunteer)
      return res.status(404).json({ success: false, message: "Volunteer profile not found" });

    res.json({ success: true, isAvailableNow: volunteer.isAvailableNow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};