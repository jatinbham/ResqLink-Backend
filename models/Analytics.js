const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
  {
    event: { type: String, required: true }, // e.g. "request_created", "volunteer_joined"
    category: { type: String }, // blood, food, etc.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Aggregated snapshot (for analytics page KPIs)
    snapshot: {
      totalRequests: Number,
      fulfilledRequests: Number,
      activeVolunteers: Number,
      livesAssisted: Number,
    },
    n8nRunId: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Analytics", analyticsSchema);
