const express = require("express");
const router = express.Router();
const Request = require("../models/Request");
const Volunteer = require("../models/Volunteer");
const Alert = require("../models/Alert");

// GET /api/map/data?lng=&lat=&radius=
// Returns all nearby requests, volunteers, alerts in one call for the MapPage
router.get("/data", async (req, res) => {
  try {
    const { lng, lat, radius = 10000 } = req.query;
    if (!lng || !lat)
      return res.status(400).json({ success: false, message: "lng and lat required" });

    const geoQuery = {
      $near: {
        $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: Number(radius),
      },
    };

    const [requests, volunteers, alerts] = await Promise.all([
      Request.find({ status: { $in: ["pending", "active"] }, location: geoQuery })
        .populate("user", "name phone")
        .limit(50),
      Volunteer.find({ isAvailableNow: true, location: geoQuery })
        .populate("user", "name phone avatar")
        .limit(30),
      Alert.find({ isActive: true, location: geoQuery })
        .limit(20),
    ]);

    res.json({ success: true, requests, volunteers, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
