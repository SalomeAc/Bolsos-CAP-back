const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "El nombre es requerido"],
    trim: true,
  },

  description: {
    type: String,
    required: [true, "La descripción es requerida"],
  },

  color: {
    type: [String],
    required: true,
  },

  dimensions: {
    type: [String],
    required: true,
  },

  materials: {
    type: [String],
    required: true,
  },

  type: {
    type: String,
    required: true,
  },

  photo: {
    type: String,
    required: true,
  },

  code: {
    type: String,
    unique: true,
  },
});

ProductSchema.pre("save", function () {
  if (!this.code) {
    this.code = `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
  }
});

module.exports = mongoose.model("Product", ProductSchema);