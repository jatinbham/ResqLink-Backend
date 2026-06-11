const mongoose = require("mongoose");

const volunteerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skills: [{ type: String }], // e.g. ["first-aid", "driving", "blood-donation"]
    availability: {
      type: String,
      enum: ["always", "weekdays", "weekends", "on-call"],
      default: "on-call",
    },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String },
    },
    bloodGroup: { type: String, default: "" },
    isAvailableNow: { type: Boolean, default: true },
    activeRequest: { type: mongoose.Schema.Types.ObjectId, ref: "Request", default: null },

    // Stats
    tasksCompleted: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    badges: [{ type: String }],
    streakDays: { type: Number, default: 0 },
    points: { type: Number, default: 0 },

    // N8n run ID
    n8nRunId: { type: String },

    verifiedAt: { type: Date },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

volunteerSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Volunteer", volunteerSchema);
