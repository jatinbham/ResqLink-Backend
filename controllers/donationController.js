const Donation = require("../models/Donation");
const Analytics = require("../models/Analytics");
const { triggerDonation, triggerAnalytics } = require("../utils/n8n");

// POST /api/donations
exports.createDonation = async (req, res) => {
  try {
    const { type, quantity, location, notes, donorName } = req.body;

    if (!type)
      return res.status(400).json({ success: false, message: "Donation type required" });

    const donation = await Donation.create({
      donor: req.user?._id || undefined,
      donorName: donorName || req.user?.name || "Anonymous",
      type,
      quantity,
      location,
      notes,
    });

    // ── N8n Trigger ──────────────────────────────────────────────
    const n8nPayload = {
      event: "donation_created",
      donationId: donation._id,
      type,
      quantity,
      location,
      donor: {
        id: req.user?._id,
        name: donation.donorName,
        phone: req.user?.phone,
      },
      createdAt: donation.createdAt,
    };
    const n8nRes = await triggerDonation(n8nPayload);
    if (n8nRes?.runId) {
      donation.n8nRunId = n8nRes.runId;
      await donation.save();
    }

    await Analytics.create({
      event: "donation_created",
      category: type,
      userId: req.user?._id,
      meta: { donationId: donation._id, quantity },
    });
    await triggerAnalytics({ event: "donation_created", type, quantity });

    res.status(201).json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/donations
exports.getDonations = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const donations = await Donation.find(filter)
      .populate("donor", "name phone")
      .populate("collectedBy", "name phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Donation.countDocuments(filter);
    res.json({ success: true, total, donations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/donations/:id/status (admin/volunteer)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["pending", "collected", "distributed", "cancelled"];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(status === "collected" && { collectedBy: req.user._id }),
      },
      { new: true }
    );

    if (!donation)
      return res.status(404).json({ success: false, message: "Donation not found" });

    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
