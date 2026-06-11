const express = require("express");
const router = express.Router();
const {
  getSummary,
  getEvents,
  logEvent,
  getLeaderboard,
} = require("../controllers/analyticsController");
const { protect, adminOnly } = require("../middleware/auth");

router.get("/summary", protect, getSummary);           // admin/volunteer dashboard
router.get("/events", protect, adminOnly, getEvents);  // admin only
router.get("/leaderboard", getLeaderboard);            // public
router.post("/event", logEvent);                       // frontend can log events freely

module.exports = router;
