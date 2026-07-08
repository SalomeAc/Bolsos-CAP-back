const mongoose = require("mongoose");


const VECTOR_SEARCH_INDEX_NAME = "product_variant_embedding_index";

/**
 * Arma el texto de entrada para generar el embedding de una variante.
 * @param {Object} variant - Documento ProductVariant (plain object o doc Mongoose).
 * @param {Object} product - Product padre con al menos type y description.
 * @returns {string}
 */
function armarTextoEmbedding(variant, product) {
  const partes = [
    product?.type,
    product?.description,
    variant.color,
    variant.material,
    variant.dimensions,
    variant.descriptionImagen,
  ].filter(Boolean);

  return partes.join(" | ");
}

const ProductVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "El producto padre es requerido"],
      index: true,
    },
    color: {
      type: String,
      required: [true, "El color es requerido"],
      trim: true,
    },
    material: {
      type: String,
      required: [true, "El material es requerido"],
      trim: true,
    },
    dimensions: {
      type: String,
      required: [true, "Las dimensiones son requeridas"],
      trim: true,
    },
    precio_total: {
      type: Number,
      required: [true, "El precio total es requerido"],
      min: [0, "El precio total no puede ser negativo"],
      default: 0,
    },
    precio_material: {
      type: Number,
      default: 0,
      min: [0, "El precio del material no puede ser negativo"],
    },
    horas_trabajo: {
      type: Number,
      default: 0,
      min: [0, "Las horas de trabajo no pueden ser negativas"],
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, "El stock no puede ser negativo"],
    },
    photo: { type: String },
    descriptionImagen: { type: String, default: null },
    embedding: {
      type: [Number],
      default: [],
    },
    embeddingDesactualizado: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

ProductVariantSchema.index({
  productId: 1,
  color: 1,
  material: 1,
  dimensions: 1,
});

ProductVariantSchema.pre("save", async function () {
  const camposEmbedding = [
    "color",
    "material",
    "dimensions",
    "photo",
    "descriptionImagen",
  ];
  const algunoModificado = camposEmbedding.some((campo) =>
    this.isModified(campo)
  );

  if (algunoModificado) {
    this.embeddingDesactualizado = true;
  }
});

/**
 * Busca variantes similares por similitud coseno sobre el embedding.
 * Requiere el índice vectorial VECTOR_SEARCH_INDEX_NAME en Atlas.
 *
 * @param {number[]} queryVector - Vector de consulta (768 dimensiones).
 * @param {number} [limit=3]
 * @returns {Promise<Array>}
 */
ProductVariantSchema.statics.buscarSimilares = async function (
  queryVector,
  limit = 3
) {
  return this.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_SEARCH_INDEX_NAME,
        path: "embedding",
        queryVector,
        numCandidates: Math.max(limit * 10, 50),
        limit,
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $unwind: {
        path: "$product",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        distanciaVector: { $meta: "vectorSearchScore" },
      },
    },
    {
      $project: {
        productId: 1,
        color: 1,
        material: 1,
        dimensions: 1,
        precio_total: 1,
        precio_material: 1,
        horas_trabajo: 1,
        sku: 1,
        stock: 1,
        photo: 1,
        descriptionImagen: 1,
        distanciaVector: 1,
        product: {
          name: "$product.name",
          type: "$product.type",
          photo: "$product.photo",
        },
      },
    },
  ]);
};

const ProductVariant = mongoose.model("ProductVariant", ProductVariantSchema);

module.exports = ProductVariant;
module.exports.armarTextoEmbedding = armarTextoEmbedding;
module.exports.VECTOR_SEARCH_INDEX_NAME = VECTOR_SEARCH_INDEX_NAME;
