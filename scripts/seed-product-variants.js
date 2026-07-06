// scripts/seed-product-variants.js
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../api/config/database");
const Product = require("../api/models/product");
const ProductVariant = require("../api/models/productVariant");

const DEFAULT_PRICE = Number(process.env.SEED_VARIANT_PRICE ?? 100000);
const DEFAULT_STOCK = Number(process.env.SEED_VARIANT_STOCK ?? 0);

function parseArgs() {
  const args = process.argv.slice(2);
  const productId = args.find((a) => a.startsWith("--productId="))?.split("=")[1];
  const dryRun = args.includes("--dry-run");
  return { productId, dryRun };
}

/** Producto cartesiano de arrays */
function cartesian(arrays) {
  return arrays.reduce(
    (acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])),
    [[]]
  );
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function buildSku(productCode, color, material, dimensions) {
  const base = productCode || "PRD";
  const parts = [slugify(color), slugify(material), slugify(dimensions)].join("-");
  return `${base}-${parts}`.slice(0, 120);
}

async function seedVariantsForProduct(product, { dryRun }) {
  const colors = (product.color || []).filter(Boolean);
  const dimensionsList = (product.dimensions || []).filter(Boolean);
  const materials = (product.materials || []).filter(Boolean);

  if (!colors.length || !dimensionsList.length || !materials.length) {
    console.warn(
      `[SKIP] Producto ${product._id} (${product.name}): arrays vacíos`,
      { colors: colors.length, dimensions: dimensionsList.length, materials: materials.length }
    );
    return { created: 0, skipped: 0, total: 0 };
  }

  const combos = cartesian([colors, dimensionsList, materials]);
  let created = 0;
  let skipped = 0;

  console.log(
    `\n[PRODUCT] ${product.name} (${product._id}) → ${combos.length} combinaciones`
  );

  for (const [color, dimensions, material] of combos) {
    const filter = {
      productId: product._id,
      color,
      material,
      dimensions,
    };

    const existing = await ProductVariant.findOne(filter).lean();
    if (existing) {
      skipped++;
      continue;
    }

    const variant = {
      productId: product._id,
      color,
      material,
      dimensions,
      price: DEFAULT_PRICE,
      stock: DEFAULT_STOCK,
      sku: buildSku(product.code, color, material, dimensions),
      embeddingDesactualizado: true,
    };

    if (dryRun) {
      console.log("  [DRY-RUN] crearía:", variant);
      created++;
      continue;
    }

    try {
      await ProductVariant.create(variant);
      created++;
    } catch (err) {
      if (err.code === 11000) {
        // sku duplicado u otro índice único
        console.warn(`  [SKIP duplicate] ${color} | ${material} | ${dimensions}`);
        skipped++;
      } else {
        throw err;
      }
    }
  }

  return { created, skipped, total: combos.length };
}

async function main() {
  const { productId, dryRun } = parseArgs();

  if (dryRun) {
    console.log("[DRY-RUN] No se escribirá en la BD");
  }

  await connectDB();

  const query = productId ? { _id: new mongoose.Types.ObjectId(productId) } : {};
  const products = await Product.find(query).lean();

  if (!products.length) {
    console.log("No se encontraron productos.");
    await disconnectDB();
    process.exit(0);
  }

  let totals = { created: 0, skipped: 0, total: 0 };

  for (const product of products) {
    const result = await seedVariantsForProduct(product, { dryRun });
    totals.created += result.created;
    totals.skipped += result.skipped;
    totals.total += result.total;
  }

  console.log("\n=== Resumen ===");
  console.log(`Combinaciones posibles: ${totals.total}`);
  console.log(`Creadas:               ${totals.created}`);
  console.log(`Omitidas (ya existían): ${totals.skipped}`);
  console.log(`Precio usado:          ${DEFAULT_PRICE}`);

  await disconnectDB();
}

main().catch(async (err) => {
  console.error("Error en seed-product-variants:", err);
  await disconnectDB();
  process.exit(1);
});