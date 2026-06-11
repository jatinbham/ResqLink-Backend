const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    donorName: { type: String }, // for anonymous
    type: {
      type: String,
      enum: ["blood", "food", "medicine", "money", "clothes", "other"],
      required: true,
    },
    quantity: { type: String }, // "2 units", "5 kg", "₹500"
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String },
    },
    status: {
      type: String,
      enum: ["pending", "collected", "distributed", "cancelled"],
      default: "pending",
    },
    notes: { type: String },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    n8nRunId: { type: String },
  },
  { timestamps: true }
);

donationSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Donation", donationSchema);
