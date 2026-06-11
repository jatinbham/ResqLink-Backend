const express = require("express");
const router = express.Router();
const {
  createAlert,
  getAlerts,
  getNearbyAlerts,
  resolveAlert,
  markSeen,
  deleteAlert,
} = require("../controllers/alertController");
const { protect, volunteerOrAdmin, adminOnly } = require("../middleware/auth");

router.get("/", getAlerts);                                         // public
router.get("/nearby", getNearbyAlerts);                             // public
router.post("/", protect, volunteerOrAdmin, createAlert);           // volunteer/admin
router.patch("/:id/resolve", protect, volunteerOrAdmin, resolveAlert);
router.patch("/:id/seen", protect, markSeen);
router.delete("/:id", protect, adminOnly, deleteAlert);

module.exports = router;
