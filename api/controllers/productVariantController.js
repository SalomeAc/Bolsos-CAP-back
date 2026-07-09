const ProductVariantService = require("../services/productVariantService");

const listVariants = async (req, res) => {
  try {
    const { productId } = req.params;
    const sync = req.query.sync === "true";
    const variants = await ProductVariantService.listVariantsForProduct(
      productId,
      { sync },
    );
    res.json(variants);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const syncVariants = async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await ProductVariantService.syncVariantsForProduct(productId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateVariants = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variants } = req.body;

    await ProductVariantService.bulkUpdateVariants(productId, variants);
    const allVariants = await ProductVariantService.listVariantsForProduct(
      productId,
    );

    res.json(allVariants);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const deleted = await ProductVariantService.deleteVariantForProduct(
      productId,
      variantId,
    );

    res.json(deleted);
  } catch (error) {
    const status = error.message.includes("no encontrada") ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

module.exports = {
  listVariants,
  syncVariants,
  updateVariants,
  deleteVariant,
};
