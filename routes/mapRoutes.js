const express = require("express");
const router = express.Router();
const Request = require("../models/Request"); // your requests model

router.get("/pins", async (req, res) => {
  try {
    const requests = await Request.find({ status: "active" })
      .select("title category urgency location createdAt")
      .lean();

    const pins = requests.map(r => ({
      _id: r._id,
      title: r.title,
      category: r.category,
      urgency: r.urgency,
      lat: r.location?.coordinates?.[1],
      lng: r.location?.coordinates?.[0],
      address: r.location?.address,
      createdAt: r.createdAt,
    }));

    res.json({ success: true, data: pins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;