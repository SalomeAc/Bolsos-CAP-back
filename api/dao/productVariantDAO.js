const ProductVariant = require("../models/productVariant");

class ProductVariantDAO {
  async findByProductId(productId) {
    return ProductVariant.find({ productId })
      .sort({ color: 1, material: 1, dimensions: 1 })
      .lean();
  }

  async findOne(filter) {
    return ProductVariant.findOne(filter).lean();
  }

  async create(data) {
    return ProductVariant.create(data);
  }

  async updateById(id, data) {
    return ProductVariant.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).lean();
  }

  async updatePricing(id, { totalPrice, materialPrice, workHours }) {
    return ProductVariant.findByIdAndUpdate(
      id,
      {
        $set: { totalPrice, materialPrice, workHours },
        $unset: {
          price: "",
          precio_total: "",
          precio_material: "",
          horas_trabajo: "",
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();
  }

  async findByProductAndSpecs(productId, { color, material, dimensions }) {
    return ProductVariant.findOne({
      productId,
      color,
      material,
      dimensions,
    }).lean();
  }
}

module.exports = new ProductVariantDAO();
