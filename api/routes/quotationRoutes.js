const express = require("express");
const router = express.Router();

const authenticateToken = require("../middlewares/auth");
const requireAdmin = require("../middlewares/requireAdmin");
const QuotationController = require("../controllers/quotationController");

// Todas las rutas de cotizaciones requieren login.
router.use(authenticateToken);

// --- Cliente ---
router.post("/", (req, res) => QuotationController.createQuotation(req, res));
router.get("/mine", (req, res) => QuotationController.getMyQuotations(req, res));
router.put("/:id/respond", (req, res) =>
  QuotationController.respondQuotation(req, res)
);

// --- Admin ---
router.get("/", requireAdmin, (req, res) =>
  QuotationController.getAll(req, res)
);
router.put("/:id/ai-quote", requireAdmin, (req, res) =>
  QuotationController.setAiQuotation(req, res)
);
router.put("/:id/quote", requireAdmin, (req, res) =>
  QuotationController.setFinalQuotation(req, res)
);
router.put("/:id/status", requireAdmin, (req, res) =>
  QuotationController.updateStatus(req, res)
);
router.delete("/:id", requireAdmin, (req, res) =>
  QuotationController.delete(req, res)
);

// --- Dueño o admin (debe ir después de las rutas específicas como /mine) ---
router.get("/:id", (req, res) => QuotationController.getQuotation(req, res));

module.exports = router;
