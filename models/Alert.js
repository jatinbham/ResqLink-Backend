const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["critical", "warning", "info", "resolved"],
      default: "info",
    },
    category: {
      type: String,
      enum: ["blood", "food", "medicine", "shelter", "transport", "general"],
      default: "general",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String },
      radius: { type: Number, default: 5000 }, // meters
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
    n8nRunId: { type: String },
    // Who has seen/acknowledged this alert
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

alertSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Alert", alertSchema);
