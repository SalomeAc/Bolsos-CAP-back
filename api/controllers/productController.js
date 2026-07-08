const productDAO = require("../dao/productDAO");
const Product = require("../models/product");
const ProductVariantService = require("../services/productVariantService");

const toArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => toArray(item)).map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
};

const normalizeProduct = (product) => {
  if (!product) return product;

  const plainProduct = product.toObject ? product.toObject() : { ...product };

  return {
    ...plainProduct,
    color: toArray(plainProduct.color || plainProduct.colors),
    dimensions: toArray(plainProduct.dimensions || plainProduct.dimension),
    materials: toArray(plainProduct.materials),
  };
};

const createProduct = async (req, res) => {
  try {
    const product = await productDAO.createProduct(req.body);
    await ProductVariantService.syncVariantsForProduct(product._id).catch((err) => {
      console.warn(
        `[PRODUCT] No se pudieron sincronizar variantes para ${product._id}:`,
        err.message,
      );
    });

    res.status(201).json(normalizeProduct(product));
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await productDAO.getProducts();

    res.json(products.map(normalizeProduct));
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await productDAO.getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    res.json(normalizeProduct(product));
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    await ProductVariantService.syncVariantsForProduct(updatedProduct._id).catch(
      (err) => {
        console.warn(
          `[PRODUCT] No se pudieron sincronizar variantes para ${updatedProduct._id}:`,
          err.message,
        );
      },
    );

    res.json(normalizeProduct(updatedProduct));
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {

    const deletedProduct = await Product.findByIdAndDelete(
      req.params.id
    );

    if (!deletedProduct) {
      return res.status(404).json({
        error: "Producto no encontrado"
      });
    }

    res.json({
      message: "Producto eliminado"
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};