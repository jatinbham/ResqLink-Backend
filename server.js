require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const connectDB  = require("./config/db");
const mapRoutes  = require("./routes/mapRoutes");


const app = express();

// ── Connect DB ────────────────────────────────────────────────────────────────
connectDB();

// ── Core Middleware ───────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",       require("./routes/auth"));
app.use("/api/requests",   require("./routes/requests"));
app.use("/api/volunteers", require("./routes/volunteers"));
app.use("/api/alerts",     require("./routes/alerts"));
app.use("/api/analytics",  require("./routes/analytics"));
app.use("/api/donations",  require("./routes/donations"));
app.use("/api/admin",      require("./routes/admin"));
app.use("/api/map",        require("./routes/map"));
app.use("/api/map",        mapRoutes);
app.use("/api/stats",      require("./routes/stats"));
app.use("/api/donate",     require("./routes/donations"));
app.use("/api/transport",  require("./routes/transport"));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) =>
  res.json({ success: true, message: "ResQ Link backend running 🚑", timestamp: new Date() })
);

// ── N8n webhook callback ──────────────────────────────────────────────────────
app.post("/api/n8n/callback", (req, res) => {
  const { event, requestId, volunteerId, status, data } = req.body;
  console.log("[N8n Callback]", event, { requestId, volunteerId, status });
  res.json({ success: true, received: true });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);


// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚑 ResQ Link backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   N8n callback: http://localhost:${PORT}/api/n8n/callback\n`);
});