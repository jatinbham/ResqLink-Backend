// controllers/transportController.js
const User     = require("../models/User");
const Donation = require("../models/Donation");

const VEHICLE_TYPES = ["Ambulance", "ICU Van", "Evacuation", "Wheelchair", "Volunteer car"];

// ── GET /api/transport/stats ──────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [total, active, critical] = await Promise.all([
      Donation.countDocuments({ type: "transport" }),
      Donation.countDocuments({ type: "transport", status: "pending" }),
      Donation.countDocuments({ type: "transport", status: "pending", notes: /urgent|critical/i }),
    ]);

    res.json({
      success: true,
      stats: {
        vehiclesOnline:  active,
        criticalRequests: critical,
        totalVehicles:   total,
        avgEta:          "—",
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/transport/vehicles?search=&tags= ─────────────────────────────────
exports.getVehicles = async (req, res) => {
  try {
    const { search = "", tags = "", page = 1, limit = 20 } = req.query;

    const filter = { type: "transport", status: { $in: ["pending", "collected"] } };

    if (search.trim()) {
      filter.$or = [
        { "location.address": { $regex: search.trim(), $options: "i" } },
        { notes:              { $regex: search.trim(), $options: "i" } },
      ];
    }

    const vehicles = await Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("donor", "name avatar phone isVerified location")
      .lean();

    const tagList = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];

    const shaped = vehicles
      .map(v => ({
        _id:        v._id,
        name:       v.donor?.name || "Anonymous",
        avatar:     v.donor?.avatar || "",
        isVerified: v.donor?.isVerified || false,
        address:    v.location?.address || v.donor?.location?.address || "Location not set",
        status:     v.status === "pending" ? "live" : "offline",
        tags:       v.quantity ? [v.quantity] : [],
        notes:      v.notes || "",
        distanceKm: null,
        eta:        null,
        rating:     null,
      }))
      .filter(v => tagList.length === 0 || tagList.some(t => v.tags.includes(t)));

    res.json({ success: true, total: shaped.length, items: shaped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/transport/critical ───────────────────────────────────────────────
exports.getCriticalRequest = async (req, res) => {
  try {
    const urgent = await Donation.findOne({
      type:   "transport",
      status: "pending",
      notes:  { $regex: /urgent|critical|emergency/i },
    })
      .sort({ createdAt: -1 })
      .populate("donor", "name")
      .lean();

    const critical = urgent
      ? {
          title:    "Urgent transport needed",
          meta:     urgent.location?.address || "Location not set",
          donation: urgent,
        }
      : null;

    res.json({ success: true, critical });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/transport/register ──────────────────────────────────────────────
exports.registerVehicle = async (req, res) => {
  try {
    const { vehicleType, location, notes } = req.body;

    if (!vehicleType) {
      return res.status(400).json({ success: false, message: "Vehicle type required" });
    }
    if (!VEHICLE_TYPES.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid vehicle type. Valid: ${VEHICLE_TYPES.join(", ")}`,
      });
    }

    const donation = await Donation.create({
      donor:    req.user._id,
      type:     "transport",
      quantity: vehicleType,
      location: location || req.user.location,
      notes:    notes || "",
      status:   "pending",
    });

    res.status(201).json({
      success: true,
      message: `${vehicleType} registered successfully`,
      donation,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/transport/:id/request ──────────────────────────────────────────
exports.requestTransport = async (req, res) => {
  try {
    const vehicle = await Donation.findById(req.params.id).populate("donor", "name");
    if (!vehicle) {
      return res.status(404).json({ success: false, message: "Vehicle not found" });
    }

    // TODO: push notification / n8n workflow trigger
    res.json({
      success: true,
      message: `Transport request sent to ${vehicle.donor?.name || "driver"}. They will be notified shortly.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};