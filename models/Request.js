const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: {
      type: String,
      enum: ["blood", "food", "medicine", "shelter", "transport", "medical"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "med", "high", "critical"],
      default: "high",
    },
    status: {
      type: String,
      enum: ["pending", "active", "fulfilled", "cancelled"],
      default: "pending",
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    // Location
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String },
    },

    // Category-specific details stored as flexible object
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    // e.g. blood: { bloodGroup, units }
    //      food: { servings, dietType }
    //      medicine: { medicineName, quantity }
    //      shelter: { persons, duration }
    //      transport: { from, to, persons }

    // Assigned responders/volunteers
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Nearby hospitals / resources from frontend data
    nearbyResources: [{ name: String, distance: String, contact: String }],

    // N8n workflow run ID (for tracking)
    n8nRunId: { type: String },

    fulfilledAt: { type: Date },
  },
  { timestamps: true }
);

requestSchema.index({ location: "2dsphere" });
requestSchema.index({ category: 1, status: 1 });
requestSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model("Request", requestSchema);
