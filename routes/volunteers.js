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
  getTasks,
  acceptTask,
  declineTask,
  toggleDuty,
} = require("../controllers/volunteerController");
const { protect } = require("../middleware/auth");

router.get("/nearby",   getNearby);                              // public
router.get("/",         getVolunteers);                          // public
router.get("/me",       protect, getMyProfile);                  // my profile
router.get("/profile",  protect, getMyProfile);                  // alias for /me

router.get("/tasks",                   protect, getTasks);       // tasks near me
router.post("/tasks/:taskId/accept",   protect, acceptTask);     // accept task
router.post("/tasks/:taskId/decline",  protect, declineTask);    // decline task
router.post("/duty",                   protect, toggleDuty);     // on/off duty

// ⚠️  /:id MUST be last — warna /tasks, /profile sab isko match kar lete
router.get("/:id",      getVolunteer);                           // public
router.post("/register",          protect, register);
router.patch("/availability",     protect, toggleAvailability);
router.patch("/accept/:requestId",protect, acceptRequest);

module.exports = router;