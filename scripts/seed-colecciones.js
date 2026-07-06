// scripts/seed-colecciones.js (ejemplo)
require("dotenv").config();
const { connectDB, disconnectDB } = require("../api/config/database");
const ProductVariant = require("../api/models/productVariant");
const CoeficienteAjuste = require("../api/models/coeficienteAjuste");

async function main() {
  await connectDB();

  // Solo si ya tienes un Product en la BD:
  // await ProductVariant.create({ productId: "...", color: "...", material: "...", dimensions: "26 x 22 x 8", price: 100000 });

  await CoeficienteAjuste.create({
    tipo: "material",
    clave: "cuero_vegano_vs_sintetico",
    valorPorcentual: 8.0,
  });

  await disconnectDB();
}

main();