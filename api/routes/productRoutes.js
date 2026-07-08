const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const productVariantController = require("../controllers/productVariantController");
const authenticateToken = require("../middlewares/auth");
const requireAdmin = require("../middlewares/requireAdmin");

// Lectura pública del catálogo
router.get("/", productController.getProducts);
router.get("/:productId/variants", authenticateToken, requireAdmin, productVariantController.listVariants);
router.put("/:productId/variants", authenticateToken, requireAdmin, productVariantController.updateVariants);
router.post("/:productId/variants/sync", authenticateToken, requireAdmin, productVariantController.syncVariants);
router.get("/:id", productController.getProductById);

// Gestión del catálogo: solo administradoras
router.post("/", authenticateToken, requireAdmin, productController.createProduct);
router.put("/:id", authenticateToken, requireAdmin, productController.updateProduct);
router.delete("/:id", authenticateToken, requireAdmin, productController.deleteProduct);

module.exports = router;
