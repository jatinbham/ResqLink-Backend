// middleware/jsonErrorMiddleware.js
// ─────────────────────────────────────────────────────────────────────────────
// body-parser ka JSON parse error gracefully handle karta hai
// server crash nahi hota, frontend ko clear error milta hai
// ─────────────────────────────────────────────────────────────────────────────

function jsonErrorMiddleware(err, req, res, next) {
  // body-parser JSON parse error ki pehchaan
  if (err.type === "entity.parse.failed" || err.status === 400) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body.",
      hint:    "body-parser ko valid JSON chahiye. String directly mat bhejo — object mein wrap karo.",
      example: { phone: "9568754698" },   // ← correct format example
    });
  }
  // Baaki errors aage pass karo
  next(err);
}

module.exports = jsonErrorMiddleware;