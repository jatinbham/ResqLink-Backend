const express = require("express");
const router  = express.Router();
const {
  createRequest,
  getRequests,
  getNearbyRequests,
  getHospitals,
  getAIPreview,
  myRequests,
  getRequestStats,   // ← ab sahi se export ho raha hai
  getRequest,        // ← getRequestById nahi, getRequest hai tera controller mein
  updateStatus,
  deleteRequest,
} = require("../controllers/requestController");
const { protect, volunteerOrAdmin } = require("../middleware/auth");

// ══════════════════════════════════════════════════════
// STATIC ROUTES — hamesha /:id se PEHLE
// ══════════════════════════════════════════════════════
router.get("/nearby",     getNearbyRequests);           // public
router.get("/hospitals",  getHospitals);                // public
router.get("/my",         protect, myRequests);         // auth
router.get("/stats",      protect, getRequestStats);    // auth  ← FIX
router.post("/ai-preview", getAIPreview);               // public

// ══════════════════════════════════════════════════════
// COLLECTION ROUTES
// ══════════════════════════════════════════════════════
router.get("/",   getRequests);                         // public
router.post("/",  protect, createRequest);              // auth

// ══════════════════════════════════════════════════════
// DYNAMIC /:id ROUTES — hamesha sabse neeche
// ══════════════════════════════════════════════════════
router.get("/:id",              getRequest);
router.patch("/:id/status",     protect, volunteerOrAdmin, updateStatus);
router.delete("/:id",           protect, deleteRequest);

module.exports = router;