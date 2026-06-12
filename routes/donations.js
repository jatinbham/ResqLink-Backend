// routes/donations.js
const express = require("express");
const router  = express.Router();
const {
  getDonors,
  getBloodDrives,
  getBloodBankStock,
  getCriticalRequest,
  registerDonor,
  contactDonor,
  requestDonor,
} = require("../controllers/donationController");
const { protect } = require("../middleware/auth");

router.get("/donors",              getDonors);               // public — ?bloodGroup=O-
router.get("/drives",              getBloodDrives);          // public
router.get("/bank-stock",          getBloodBankStock);       // public
router.get("/critical",            getCriticalRequest);      // public
router.post("/register",           protect, registerDonor);  // become donor
router.post("/donors/:id/contact", protect, contactDonor);   // contact a donor
router.post("/donors/:id/request", protect, requestDonor);   // request a donor

module.exports = router;