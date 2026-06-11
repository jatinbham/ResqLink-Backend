const express = require("express");
const router = express.Router();
const {
  createRequest,
  getRequests,
  getNearbyRequests,
  getRequest,
  updateStatus,
  deleteRequest,
  myRequests,
} = require("../controllers/requestController");
const { protect, volunteerOrAdmin } = require("../middleware/auth");

router.get("/nearby", getNearbyRequests);          // public
router.get("/", getRequests);                       // public
router.get("/my", protect, myRequests);             // logged-in user
router.get("/:id", getRequest);                     // public
router.post("/", protect, createRequest);           // logged-in user
router.patch("/:id/status", protect, volunteerOrAdmin, updateStatus);
router.delete("/:id", protect, deleteRequest);

module.exports = router;
