const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const productVariantController = require("../controllers/productVariantController");
const authenticateToken = require("../middlewares/auth");
const requireAdmin = require("../middlewares/requireAdmin");
const upload = require("../middlewares/upload");

// Lectura pública del catálogo
router.get("/", productController.getProducts);
router.post(
  "/form",
  authenticateToken,
  requireAdmin,
  upload.single("photo"),
  (req, res) => productController.createProductFromForm(req, res),
);
router.delete(
  "/:id/photo",
  authenticateToken,
  requireAdmin,
  productController.deleteProductPhoto,
);
router.get("/:productId/variants", authenticateToken, requireAdmin, productVariantController.listVariants);
router.put("/:productId/variants", authenticateToken, requireAdmin, productVariantController.updateVariants);
router.delete(
  "/:productId/variants/:variantId",
  authenticateToken,
  requireAdmin,
  productVariantController.deleteVariant,
);
router.post("/:productId/variants/sync", authenticateToken, requireAdmin, productVariantController.syncVariants);
router.get("/:id", productController.getProductById);

// Gestión del catálogo: solo administradoras (multipart + foto)
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  upload.single("photo"),
  (req, res) => productController.createProductFromForm(req, res),
);
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  upload.single("photo"),
  (req, res) => productController.updateProductFromForm(req, res),
);
router.delete("/:id", authenticateToken, requireAdmin, productController.deleteProduct);

module.exports = router;
