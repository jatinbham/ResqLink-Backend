// routes/stats.js
const express = require("express");
const router  = express.Router();

// GET /api/stats/live
router.get("/live", async (req, res) => {
  try {
    return res.json({
      donors:     42,
      shelters:   15,
      vehicles:   28,
      responders: 97,
    });
  } catch (err) {
    console.error("[stats/live]", err);
    return res.status(500).json({ error: "Failed to fetch live stats" });
  }
});

// GET /api/stats/resources
router.get("/resources", async (req, res) => {
  try {
    return res.json({
      bloodDonor:  42,
      transport:   28,
      medicines:   310,
      foodPackets: 520,
      shelter:     870,
    });
  } catch (err) {
    console.error("[stats/resources]", err);
    return res.status(500).json({ error: "Failed to fetch resource counts" });
  }
});

module.exports = router;