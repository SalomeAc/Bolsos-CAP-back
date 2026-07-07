const mongoose = require("mongoose");

const QuotationSchema = new mongoose.Schema(
  {
    // Modalidad: producto del catálogo personalizado | producto personalizado
    kind: {
      type: String,
      enum: ["catalog", "custom"],
      required: [true, "El tipo de cotización (kind) es requerido"],
    },

    // Cotizar requiere login: la cotización se asocia siempre a un usuario.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "El usuario es requerido"],
    },

    // Solicitud original asociada (trazabilidad HU2)
    solicitud: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Solicitud",
    },

    // --- Modalidad "catalog" ---
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: function () {
        return this.kind === "catalog";
      },
    },
    customization: {
      type: { type: String }, // tipo de bolso elegido
      color: { type: String },
      size: { type: String }, // "tamaño"
      material: { type: String },
    },

    // --- Modalidad "custom" ---
    customProduct: {
      description: { type: String },
      color: { type: String },
      dimensions: { type: String },
      materials: { type: [String] },
      photo: { type: String }, // foto de referencia que aporta el cliente
    },

    quantity: {
      type: Number,
      default: 1,
      min: [1, "La cantidad mínima es 1"],
    },
    notes: { type: String },

    status: {
      type: String,
      enum: [
        "pendiente",
        "cotizada_ia",
        "en_revision",
        "cotizada",
        "aceptada",
        "rechazada",
        "en_produccion",
        "completada",
        "cancelada",
      ],
      default: "pendiente",
    },

    // Propuesta de IA (fase 4)
    aiQuotation: {
      amount: { type: Number },
      currency: { type: String, default: "COP" },
      breakdown: { type: String },
      model: { type: String },
      generatedAt: { type: Date },
    },

    // Cotización final de la administradora
    finalQuotation: {
      amount: { type: Number },
      currency: { type: String, default: "COP" },
      notes: { type: String },
      quotedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      quotedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Validación condicional de la modalidad "custom".
// En Mongoose 9 los pre-hooks usan promesas (no se recibe `next`).
QuotationSchema.pre("validate", async function () {
  if (this.kind === "custom") {
    const cp = this.customProduct || {};
    if (
      !cp.description ||
      !cp.color ||
      !cp.dimensions ||
      !cp.materials ||
      cp.materials.length === 0
    ) {
      throw new Error(
        "Una cotización personalizada requiere descripción, color, dimensiones y materiales"
      );
    }
  }
});

QuotationSchema.index({ user: 1 });
QuotationSchema.index({ status: 1 });
QuotationSchema.index({ solicitud: 1 });
QuotationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Quotation", QuotationSchema);
