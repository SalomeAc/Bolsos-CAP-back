const mongoose = require("mongoose");

const SolicitudSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "El usuario es requerido"],
    },
    kind: {
      type: String,
      enum: ["catalog", "custom"],
      required: [true, "El tipo de solicitud (kind) es requerido"],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: function () {
        return this.kind === "catalog";
      },
    },
    customization: {
      type: { type: String },
      color: { type: String },
      size: { type: String },
      material: { type: String },
    },
    customProduct: {
      description: { type: String },
      color: { type: String },
      dimensions: { type: String },
      materials: { type: [String] },
      photo: { type: String },
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, "La cantidad mínima es 1"],
    },
    notes: { type: String },
    status: {
      type: String,
      enum: ["pendiente", "cotizada", "cancelada"],
      default: "pendiente",
    },
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

SolicitudSchema.pre("validate", async function () {
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
        "Una solicitud personalizada requiere descripción, color, dimensiones y materiales"
      );
    }
  }
});

SolicitudSchema.pre("save", async function () {
  if (!this.code) {
    const random = Math.floor(100000 + Math.random() * 900000);
    this.code = `SOL-${random}`;
  }
});

SolicitudSchema.index({ user: 1 });
SolicitudSchema.index({ status: 1 });
SolicitudSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Solicitud", SolicitudSchema);