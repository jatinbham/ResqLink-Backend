const express = require("express");
const router = express.Router();
const {
  createDonation,
  getDonations,
  updateStatus,
} = require("../controllers/donationController");
const { protect, volunteerOrAdmin } = require("../middleware/auth");

router.get("/", getDonations);                                   // public
router.post("/", createDonation);                                // public (anonymous allowed)
router.patch("/:id/status", protect, volunteerOrAdmin, updateStatus);

module.exports = router;
