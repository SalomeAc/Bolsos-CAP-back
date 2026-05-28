const Product = require("../models/product");

const createProduct = async (data) => {
  return await Product.create(data);
};

const getProducts = async () => {
  return await Product.find();
};

const updateProduct = async (id, data) => {
  return await Product.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
};

const deleteProduct = async (id) => {
  return await Product.findByIdAndDelete(id);
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
};