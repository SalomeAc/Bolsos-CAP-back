require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../api/config/database");

async function main() {
  await connectDB();
  const collection = mongoose.connection.collection("productvariants");

  const withLegacyPrice = await collection
    .find({ price: { $exists: true }, precio_total: { $exists: false } })
    .toArray();

  let migrated = 0;
  for (const doc of withLegacyPrice) {
    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          precio_total: doc.price,
          precio_material: doc.precio_material ?? 0,
          horas_trabajo: doc.horas_trabajo ?? 0,
        },
        $unset: { price: "" },
      },
    );
    migrated++;
  }

  const missingDefaults = await collection.updateMany(
    {
      precio_total: { $exists: false },
      price: { $exists: false },
    },
    {
      $set: {
        precio_total: 0,
        precio_material: 0,
        horas_trabajo: 0,
      },
    },
  );

  console.log(`Migrados desde price: ${migrated}`);
  console.log(`Documentos con defaults aplicados: ${missingDefaults.modifiedCount}`);

  await disconnectDB();
}

main().catch(async (err) => {
  console.error("Error en migrate-product-variant-prices:", err);
  await disconnectDB();
  process.exit(1);
});
