const express = require("express");
const router = express.Router();
const {
  getUsers,
  changeRole,
  toggleBan,
  getOverview,
  verifyVolunteer,
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");

// All admin routes are protected + admin only
router.use(protect, adminOnly);

router.get("/overview", getOverview);
router.get("/users", getUsers);
router.patch("/users/:id/role", changeRole);
router.patch("/users/:id/ban", toggleBan);
router.patch("/volunteers/:id/verify", verifyVolunteer);

module.exports = router;
