// routes/transport.js
const express = require("express");
const router  = express.Router();
const {
  getStats,
  getVehicles,
  getCriticalRequest,
  registerVehicle,
  requestTransport,
} = require("../controllers/transportController");
const { protect } = require("../middleware/auth");

router.get("/stats",          getStats);            // GET /api/transport/stats
router.get("/vehicles",       getVehicles);         // GET /api/transport/vehicles?search=&tags=
router.get("/critical",       getCriticalRequest);  // GET /api/transport/critical
router.post("/register",      protect, registerVehicle);       // POST /api/transport/register
router.post("/:id/request",   protect, requestTransport);      // POST /api/transport/:id/request

module.exports = router;