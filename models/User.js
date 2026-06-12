const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String },
    // models/User.js
    role: {type: String, enum: ["user", "volunteer", "admin", "requester"], default: "user"},
    bloodGroup: { type: String, enum: ["A+","A-","B+","B-","AB+","AB-","O+","O-",""], default: "" },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String, default: "" },
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    avatar: { type: String, default: "" },
    otp: { type: String },
    otpExpiry: { type: Date },
    volunteerStats: {
      tasksCompleted: { type: Number, default: 0 },
      rating: { type: Number, default: 0 },
      badges: [String],
    },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });

// ✅ Fix: async middleware — no `next` parameter needed
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);