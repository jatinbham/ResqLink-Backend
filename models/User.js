const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String },
    role: { type: String, enum: ["user", "volunteer", "admin"], default: "user" },
    bloodGroup: { type: String, enum: ["A+","A-","B+","B-","AB+","AB-","O+","O-",""] , default: "" },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      address: { type: String, default: "" },
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    avatar: { type: String, default: "" },
    // OTP
    otp: { type: String },
    otpExpiry: { type: Date },
    // Volunteer stats (if role is volunteer)
    volunteerStats: {
      tasksCompleted: { type: Number, default: 0 },
      rating: { type: Number, default: 0 },
      badges: [String],
    },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
