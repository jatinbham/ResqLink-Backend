// controllers/donationController.js
const Donation = require("../models/Donation");
const User     = require("../models/User");

const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ── GET /api/donate/donors?bloodGroup=O-&search=rahul ────────────────────────
exports.getDonors = async (req, res) => {
  try {
    const { bloodGroup, search, page = 1, limit = 20 } = req.query;

    // Base filter — sirf woh users jo blood group set kar chuke hain
    const filter = { bloodGroup: { $in: VALID_BLOOD_GROUPS } };

    if (bloodGroup && VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      filter.bloodGroup = bloodGroup;
    }

    if (search && search.trim()) {
      filter.name = { $regex: search.trim(), $options: "i" };
    }

    const [donors, total] = await Promise.all([
      User.find(filter, "name bloodGroup location avatar isVerified")
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ]);

    const shaped = donors.map(d => ({
      _id:        d._id,
      name:       d.name,
      bloodGroup: d.bloodGroup,
      address:    d.location?.address || "Location not set",
      avatar:     d.avatar || "",
      isVerified: d.isVerified || false,
      status:     "live",
      tags:       [d.bloodGroup],
      distanceKm: null,
      rating:     null,
      available:  null,
      capacity:   null,
    }));

    res.json({ success: true, total, donors: shaped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/donate/drives ───────────────────────────────────────────────────
exports.getBloodDrives = async (req, res) => {
  try {
    const drives = await Donation.find({
      type:   "blood",
      status: { $in: ["pending", "collected"] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("donor", "name avatar")
      .lean();

    res.json({ success: true, drives });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/donate/bank-stock ───────────────────────────────────────────────
exports.getBloodBankStock = async (req, res) => {
  try {
    const stock = await Promise.all(
      VALID_BLOOD_GROUPS.map(async (bg) => {
        const count = await User.countDocuments({ bloodGroup: bg });
        return {
          bloodGroup: bg,
          count,
          status: count > 5 ? "available" : count > 0 ? "low" : "critical",
        };
      })
    );

    res.json({ success: true, stock });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/donate/critical ─────────────────────────────────────────────────
exports.getCriticalRequest = async (req, res) => {
  try {
    // Priority order: rarest groups pehle
    const priorityGroups = ["O-", "AB-", "B-", "A-"];
    let critical = null;

    for (const bg of priorityGroups) {
      const count = await User.countDocuments({ bloodGroup: bg });
      if (count === 0) {
        critical = {
          bloodGroup: bg,
          message:    `No ${bg} donors available — CRITICAL`,
          donation:   null,
        };
        break;
      }
    }

    if (!critical) {
      const latest = await Donation.findOne({ type: "blood", status: "pending" })
        .sort({ createdAt: -1 })
        .populate("donor", "name bloodGroup")
        .lean();

      if (latest) {
        critical = {
          bloodGroup: latest.donor?.bloodGroup || "Unknown",
          message:    "Urgent donation needed",
          donation:   latest,
        };
      }
    }

    // Critical na ho toh null — frontend banner nahi dikhayega
    res.json({ success: true, critical });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/donate/register ────────────────────────────────────────────────
exports.registerDonor = async (req, res) => {
  try {
    const { bloodGroup, location, notes } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!bloodGroup) {
      return res.status(400).json({
        success: false,
        message: "Blood group required",
      });
    }

    if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({
        success: false,
        message: `Invalid blood group. Valid values: ${VALID_BLOOD_GROUPS.join(", ")}`,
      });
    }

    // ── Update user + create donation record ────────────────────────────────
    const [, donation] = await Promise.all([
      User.findByIdAndUpdate(
        req.user._id,
        { bloodGroup },
        { returnDocument: "after" }
      ),
      Donation.create({
        donor:    req.user._id,
        type:     "blood",
        quantity: "1 unit",
        location: location || req.user.location,
        notes:    notes || "",
        status:   "pending",
      }),
    ]);

    res.status(201).json({
      success:  true,
      message:  `Registered as ${bloodGroup} donor successfully`,
      donation,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/donate/donors/:id/contact ─────────────────────────────────────
exports.contactDonor = async (req, res) => {
  try {
    const donor = await User.findById(req.params.id, "name phone email bloodGroup");
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }

    res.json({
      success: true,
      donor: {
        name:       donor.name,
        bloodGroup: donor.bloodGroup,
        // Phone sirf verified users ko milega
        phone: req.user?.isVerified ? donor.phone : null,
        email: req.user?.isVerified ? donor.email : null,
        verificationRequired: !req.user?.isVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/donate/donors/:id/request ─────────────────────────────────────
exports.requestDonor = async (req, res) => {
  try {
    const donor = await User.findById(req.params.id, "name bloodGroup");
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }

    // TODO: Yahan push notification / email bhej sakte ho
    res.json({
      success: true,
      message: `Request sent to ${donor.name}. They will be notified shortly.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};