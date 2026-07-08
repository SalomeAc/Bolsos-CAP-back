const Product = require("../models/product");
const ProductVariantDAO = require("../dao/productVariantDAO");

function cartesian(arrays) {
  return arrays.reduce(
    (acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])),
    [[]],
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

function normalizeDimensions(value) {
  if (!value) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s*cm\s*$/i, "")
    .replace(/\s*[xX×]\s*/g, "x")
    .replace(/\s+/g, "");
}

function normalizeToken(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

function variantKey(color, material, dimensions) {
  return [
    normalizeToken(color),
    normalizeToken(material),
    normalizeDimensions(dimensions),
  ].join("|");
}

function resolveTotalPrice(doc) {
  return doc.totalPrice ?? doc.precio_total ?? doc.price ?? 0;
}

function resolveMaterialPrice(doc) {
  return doc.materialPrice ?? doc.precio_material ?? 0;
}

function resolveWorkHours(doc) {
  const value = doc.workHours ?? doc.horas_trabajo;
  return value != null && value !== "" ? Number(value) : 6;
}

function toPublicVariant(doc) {
  if (!doc) return doc;
  return {
    _id: doc._id,
    productId: doc.productId,
    color: doc.color,
    material: doc.material,
    dimensions: doc.dimensions,
    totalPrice: resolveTotalPrice(doc),
    materialPrice: resolveMaterialPrice(doc),
    workHours: resolveWorkHours(doc),
    sku: doc.sku || "",
    stock: doc.stock ?? 0,
  };
}

class ProductVariantService {
  normalizeDimensions = normalizeDimensions;

  async syncVariantsForProduct(productId) {
    const product = await Product.findById(productId).lean();
    if (!product) {
      throw new Error("Producto no encontrado");
    }

    const colors = (product.color || []).filter(Boolean);
    const dimensionsList = (product.dimensions || []).filter(Boolean);
    const materials = (product.materials || []).filter(Boolean);

    if (!colors.length || !dimensionsList.length || !materials.length) {
      return { created: 0, skipped: 0, total: 0, variants: [] };
    }

    const combos = cartesian([colors, dimensionsList, materials]);
    let created = 0;
    let skipped = 0;

    for (const [color, dimensions, material] of combos) {
      const existing = await ProductVariantDAO.findByProductAndSpecs(productId, {
        color,
        material,
        dimensions,
      });

      if (existing) {
        skipped++;
        continue;
      }

      try {
        await ProductVariantDAO.create({
          productId,
          color,
          material,
          dimensions,
          totalPrice: 0,
          materialPrice: 0,
          workHours: 6,
          stock: 0,
          sku: buildSku(product.code, color, material, dimensions),
          embeddingDesactualizado: true,
        });
        created++;
      } catch (err) {
        if (err.code !== 11000) {
          throw err;
        }
        skipped++;
      }
    }

    const variants = await ProductVariantDAO.findByProductId(productId);
    return {
      created,
      skipped,
      total: combos.length,
      variants: variants.map(toPublicVariant),
    };
  }

  async listVariantsForProduct(productId, { sync = false } = {}) {
    if (sync) {
      await this.syncVariantsForProduct(productId);
    }

    const variants = await ProductVariantDAO.findByProductId(productId);
    return variants.map(toPublicVariant);
  }

  async bulkUpdateVariants(productId, variants = []) {
    if (!Array.isArray(variants)) {
      throw new Error("Se esperaba un arreglo de variantes");
    }

    const updated = [];

    for (const item of variants) {
      const totalPrice = Number(
        item.totalPrice ?? item.precio_total ?? item.price ?? 0,
      );
      const materialPrice = Number(
        item.materialPrice ?? item.precio_material ?? 0,
      );
      const workHours = Number(
        item.workHours ?? item.horas_trabajo ?? 6,
      );

      if (
        Number.isNaN(totalPrice) ||
        Number.isNaN(materialPrice) ||
        Number.isNaN(workHours)
      ) {
        throw new Error("Los valores numéricos de la variante no son válidos");
      }

      if (totalPrice < 0 || materialPrice < 0 || workHours < 0) {
        throw new Error("Los precios y horas no pueden ser negativos");
      }

      let doc = null;
      const variantUpdate = { totalPrice, materialPrice, workHours };

      if (item._id) {
        doc = await ProductVariantDAO.updatePricing(item._id, variantUpdate);
      } else if (item.color && item.material && item.dimensions) {
        const existing = await ProductVariantDAO.findByProductAndSpecs(
          productId,
          {
            color: item.color,
            material: item.material,
            dimensions: item.dimensions,
          },
        );

        if (existing) {
          doc = await ProductVariantDAO.updatePricing(existing._id, variantUpdate);
        }
      }

      if (doc) {
        updated.push(toPublicVariant(doc));
      }
    }

    return updated;
  }

  async findVariantForQuotation(productId, { color, material, dimensions }) {
    if (!productId) return null;

    const targetKey = variantKey(color, material, dimensions);
    const variants = await ProductVariantDAO.findByProductId(productId);

    const exact = variants.find(
      (variant) =>
        variantKey(variant.color, variant.material, variant.dimensions) ===
        targetKey,
    );

    if (exact) {
      return toPublicVariant(exact);
    }

    const loose = variants.find((variant) => {
      const sameColor = normalizeToken(variant.color) === normalizeToken(color);
      const sameMaterial =
        normalizeToken(variant.material) === normalizeToken(material);
      const sameDimensions =
        normalizeDimensions(variant.dimensions) ===
        normalizeDimensions(dimensions);
      return sameColor && sameMaterial && sameDimensions;
    });

    return loose ? toPublicVariant(loose) : null;
  }
}

module.exports = new ProductVariantService();
module.exports.normalizeDimensions = normalizeDimensions;
module.exports.variantKey = variantKey;
module.exports.buildSku = buildSku;
module.exports.resolveTotalPrice = resolveTotalPrice;
module.exports.resolveWorkHours = resolveWorkHours;
