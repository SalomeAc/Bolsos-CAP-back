const mongoose = require("mongoose");

const CoeficienteAjusteSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ["material", "caracteristica"],
      required: [true, "El tipo de coeficiente es requerido"],
    },
    clave: {
      type: String,
      required: [true, "La clave es requerida"],
      unique: true,
      trim: true,
    },
    valorPorcentual: {
      type: Number,
      required: [true, "El valor porcentual es requerido"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoeficienteAjuste", CoeficienteAjusteSchema);
