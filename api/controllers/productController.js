const productDAO = require("../dao/productDAO");
const Product = require("../models/product");

const createProduct = async (req, res) => {
  try {
    const product = await productDAO.createProduct(req.body);

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await productDAO.getProducts();

    res.json(products);
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

    res.json(updatedProduct);

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
  updateProduct,
  deleteProduct,
};