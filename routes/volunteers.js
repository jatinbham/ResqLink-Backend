const express = require("express");
const router = express.Router();
const {
  register,
  getVolunteers,
  getNearby,
  getVolunteer,
  toggleAvailability,
  acceptRequest,
  getMyProfile,
} = require("../controllers/volunteerController");
const { protect } = require("../middleware/auth");

router.get("/nearby", getNearby);                         // public
router.get("/", getVolunteers);                           // public
router.get("/me", protect, getMyProfile);                 // my profile
router.get("/:id", getVolunteer);                         // public
router.post("/register", protect, register);              // become volunteer
router.patch("/availability", protect, toggleAvailability);
router.patch("/accept/:requestId", protect, acceptRequest);

module.exports = router;
