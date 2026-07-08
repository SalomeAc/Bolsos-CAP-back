require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../api/config/database");

const LEGACY_FIELDS = ["price", "precio_total", "precio_material", "horas_trabajo"];
const DEFAULT_WORK_HOURS = 6;

function resolveTotalPrice(doc) {
  return doc.totalPrice ?? doc.precio_total ?? doc.price ?? 0;
}

function resolveMaterialPrice(doc) {
  return doc.materialPrice ?? doc.precio_material ?? 0;
}

async function main() {
  await connectDB();
  const collection = mongoose.connection.collection("productvariants");
  const docs = await collection.find({}).toArray();

  let migrated = 0;

  for (const doc of docs) {
    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          totalPrice: resolveTotalPrice(doc),
          materialPrice: resolveMaterialPrice(doc),
          workHours: DEFAULT_WORK_HOURS,
        },
        $unset: Object.fromEntries(LEGACY_FIELDS.map((field) => [field, ""])),
      },
    );
    migrated++;
  }

  console.log(`Variantes actualizadas: ${migrated} / ${docs.length}`);
  console.log(`workHours fijado en ${DEFAULT_WORK_HOURS} para todas`);
  console.log("Campos finales: totalPrice, materialPrice, workHours");

  await disconnectDB();
}

main().catch(async (err) => {
  console.error("Error en migrate-product-variant-prices:", err);
  await disconnectDB();
  process.exit(1);
});
