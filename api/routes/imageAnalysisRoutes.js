const express = require("express");
const imageAnalysisController = require("../controllers/imageAnalysisController");
const authenticateToken = require("../middlewares/auth");
const requireAdmin = require("../middlewares/requireAdmin");
const upload = require("../middlewares/upload");

const router = express.Router();

router.post(
  "/analyze",
  authenticateToken,
  requireAdmin,
  upload.single("image"),
  imageAnalysisController.analyzeImage,
);

module.exports = router;
