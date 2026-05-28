const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const authenticateToken = require("../middlewares/auth");
const requireAdmin = require("../middlewares/requireAdmin");

// Lectura pública del catálogo
router.get("/", productController.getProducts);
router.get("/:id", productController.getProductById);

// Gestión del catálogo: solo administradoras
router.post("/", authenticateToken, requireAdmin, productController.createProduct);
router.put("/:id", authenticateToken, requireAdmin, productController.updateProduct);
router.delete("/:id", authenticateToken, requireAdmin, productController.deleteProduct);

module.exports = router;
