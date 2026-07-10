const ProductVariantService = require("../../api/services/productVariantService");
const ProductVariantDAO = require("../../api/dao/productVariantDAO");

jest.mock("../../api/models/product", () => ({
  findById: jest.fn(),
}));
jest.mock("../../api/dao/productVariantDAO", () => ({
  findByProductId: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  updatePricing: jest.fn(),
  findByProductAndSpecs: jest.fn(),
  deleteById: jest.fn(),
}));

const Product = require("../../api/models/product");
const {
  buildSku,
  resolveTotalPrice,
  resolveWorkHours,
} = require("../../api/services/productVariantService");

describe("ProductVariantService extended", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("buildSku genera sku legible", () => {
    expect(buildSku("BOL-01", "Negro", "Algodón", "26x22x8")).toContain("BOL-01");
  });

  it("resolveTotalPrice y resolveWorkHours usan alias", () => {
    expect(resolveTotalPrice({ precio_total: 99 })).toBe(99);
    expect(resolveWorkHours({ horas_trabajo: 8 })).toBe(8);
    expect(resolveWorkHours({})).toBe(6);
  });

  describe("syncVariantsForProduct", () => {
    it("retorna vacío si faltan combinaciones", async () => {
      Product.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "p1",
          color: [],
          dimensions: ["20"],
          materials: ["Lana"],
        }),
      });

      const result = await ProductVariantService.syncVariantsForProduct("p1");
      expect(result).toEqual({ created: 0, skipped: 0, total: 0, variants: [] });
    });

    it("crea variantes nuevas", async () => {
      Product.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "p1",
          code: "BOL",
          color: ["Rojo"],
          dimensions: ["20x15"],
          materials: ["Lana"],
        }),
      });
      ProductVariantDAO.findByProductAndSpecs.mockResolvedValue(null);
      ProductVariantDAO.create.mockResolvedValue({ _id: "v1" });
      ProductVariantDAO.findByProductId.mockResolvedValue([
        {
          _id: "v1",
          productId: "p1",
          color: "Rojo",
          material: "Lana",
          dimensions: "20x15",
          totalPrice: 0,
          materialPrice: 0,
          workHours: 6,
        },
      ]);

      const result = await ProductVariantService.syncVariantsForProduct("p1");

      expect(result.created).toBe(1);
      expect(result.variants).toHaveLength(1);
    });

    it("omite variantes existentes", async () => {
      Product.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "p1",
          code: "BOL",
          color: ["Rojo"],
          dimensions: ["20x15"],
          materials: ["Lana"],
        }),
      });
      ProductVariantDAO.findByProductAndSpecs.mockResolvedValue({ _id: "v1" });
      ProductVariantDAO.findByProductId.mockResolvedValue([]);

      const result = await ProductVariantService.syncVariantsForProduct("p1");

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
    });

    it("lanza error si producto no existe", async () => {
      Product.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ProductVariantService.syncVariantsForProduct("missing"),
      ).rejects.toThrow("Producto no encontrado");
    });

    it("omite duplicados por error de índice único", async () => {
      Product.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "p1",
          code: "BOL",
          color: ["Rojo"],
          dimensions: ["20x15"],
          materials: ["Lana"],
        }),
      });
      ProductVariantDAO.findByProductAndSpecs.mockResolvedValue(null);
      const duplicateError = new Error("duplicate");
      duplicateError.code = 11000;
      ProductVariantDAO.create.mockRejectedValue(duplicateError);
      ProductVariantDAO.findByProductId.mockResolvedValue([]);

      const result = await ProductVariantService.syncVariantsForProduct("p1");

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
    });
  });

  describe("bulkUpdateVariants", () => {
    it("rechaza arreglo inválido", async () => {
      await expect(
        ProductVariantService.bulkUpdateVariants("p1", "no-array"),
      ).rejects.toThrow("Se esperaba un arreglo de variantes");
    });

    it("actualiza variante por id", async () => {
      ProductVariantDAO.updatePricing.mockResolvedValue({
        _id: "v1",
        productId: "p1",
        color: "Rojo",
        material: "Lana",
        dimensions: "20x15",
        totalPrice: 120000,
        materialPrice: 30000,
        workHours: 6,
      });

      const updated = await ProductVariantService.bulkUpdateVariants("p1", [
        { _id: "v1", totalPrice: 120000, materialPrice: 30000, workHours: 6 },
      ]);

      expect(updated).toHaveLength(1);
      expect(updated[0].totalPrice).toBe(120000);
    });

    it("rechaza valores negativos", async () => {
      await expect(
        ProductVariantService.bulkUpdateVariants("p1", [
          { _id: "v1", totalPrice: -1, materialPrice: 0, workHours: 6 },
        ]),
      ).rejects.toThrow("no pueden ser negativos");
    });

    it("actualiza variante por combinación de specs", async () => {
      ProductVariantDAO.findByProductAndSpecs.mockResolvedValue({ _id: "v2" });
      ProductVariantDAO.updatePricing.mockResolvedValue({
        _id: "v2",
        productId: "p1",
        color: "Azul",
        material: "Algodón",
        dimensions: "25x20",
        totalPrice: 90000,
        materialPrice: 20000,
        workHours: 5,
      });

      const updated = await ProductVariantService.bulkUpdateVariants("p1", [
        {
          color: "Azul",
          material: "Algodón",
          dimensions: "25x20",
          totalPrice: 90000,
          materialPrice: 20000,
          workHours: 5,
        },
      ]);

      expect(updated).toHaveLength(1);
      expect(ProductVariantDAO.findByProductAndSpecs).toHaveBeenCalled();
    });
  });

  describe("listVariantsForProduct", () => {
    it("lista variantes sin sync", async () => {
      ProductVariantDAO.findByProductId.mockResolvedValue([
        {
          _id: "v1",
          productId: "p1",
          color: "Rojo",
          material: "Lana",
          dimensions: "20x15 cm",
          totalPrice: 100000,
          materialPrice: 20000,
          workHours: 6,
        },
      ]);

      const variants = await ProductVariantService.listVariantsForProduct("p1");
      expect(variants[0].dimensions).toBe("20x15");
    });

    it("sincroniza antes de listar cuando sync=true", async () => {
      Product.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "p1",
          color: [],
          dimensions: [],
          materials: [],
        }),
      });
      ProductVariantDAO.findByProductId.mockResolvedValue([]);

      const variants = await ProductVariantService.listVariantsForProduct("p1", {
        sync: true,
      });

      expect(variants).toEqual([]);
    });
  });

  describe("deleteVariantForProduct", () => {
    const variantId = "507f1f77bcf86cd799439011";

    it("elimina variante existente", async () => {
      ProductVariantDAO.findOne.mockResolvedValue({
        _id: variantId,
        productId: "p1",
      });
      ProductVariantDAO.deleteById.mockResolvedValue({
        _id: variantId,
        color: "Rojo",
        material: "Lana",
        dimensions: "20x15",
        totalPrice: 100000,
        materialPrice: 20000,
        workHours: 6,
      });

      const deleted = await ProductVariantService.deleteVariantForProduct(
        "p1",
        variantId,
      );

      expect(deleted.totalPrice).toBe(100000);
    });

    it("lanza error si variante no existe", async () => {
      ProductVariantDAO.findOne.mockResolvedValue(null);

      await expect(
        ProductVariantService.deleteVariantForProduct("p1", variantId),
      ).rejects.toThrow("Variante no encontrada");
    });
  });

  describe("findVariantForQuotation", () => {
    it("encuentra variante por specs", async () => {
      ProductVariantDAO.findByProductId.mockResolvedValue([
        {
          _id: "v1",
          color: "Rojo",
          material: "Lana",
          dimensions: "20x15",
          totalPrice: 100000,
          materialPrice: 20000,
          workHours: 6,
        },
      ]);

      const variant = await ProductVariantService.findVariantForQuotation("p1", {
        color: "Rojo",
        material: "Lana",
        dimensions: "20x15 cm",
      });

      expect(variant.totalPrice).toBe(100000);
    });

    it("retorna null sin productId", async () => {
      const variant = await ProductVariantService.findVariantForQuotation(null, {});
      expect(variant).toBeNull();
    });
  });
});
