const ProductVariantService = require("../../api/services/productVariantService");
const {
  normalizeDimensions,
  variantKey,
} = require("../../api/services/productVariantService");

jest.mock("../../api/models/product");
jest.mock("../../api/dao/productVariantDAO", () => ({
  findByProductId: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  findByProductAndSpecs: jest.fn(),
}));

const ProductVariantDAO = require("../../api/dao/productVariantDAO");

describe("ProductVariantService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("normalizeDimensions", () => {
    it("normaliza espacios y sufijo cm para comparar dimensiones", () => {
      expect(normalizeDimensions("26 x 22 x 8 cm")).toBe("26x22x8");
      expect(normalizeDimensions("26x22x8")).toBe("26x22x8");
    });
  });

  describe("variantKey", () => {
    it("genera clave comparable en minúsculas", () => {
      expect(variantKey("Negro", "Algodón", "26 x 22 x 8 cm")).toBe(
        variantKey("negro", "algodón", "26x22x8"),
      );
    });
  });

  describe("findVariantForQuotation", () => {
    it("encuentra variante por combinación normalizada", async () => {
      ProductVariantDAO.findByProductId.mockResolvedValue([
        {
          _id: "v1",
          productId: "p1",
          color: "Negro",
          material: "Algodón",
          dimensions: "26 x 22 x 8",
          precio_total: 150000,
          precio_material: 40000,
          horas_trabajo: 3,
        },
      ]);

      const variant = await ProductVariantService.findVariantForQuotation("p1", {
        color: "negro",
        material: "algodón",
        dimensions: "26 x 22 x 8 cm",
      });

      expect(variant).toEqual(
        expect.objectContaining({
          _id: "v1",
          precio_total: 150000,
        }),
      );
    });

    it("retorna null si no hay variante", async () => {
      ProductVariantDAO.findByProductId.mockResolvedValue([]);

      const variant = await ProductVariantService.findVariantForQuotation("p1", {
        color: "Rojo",
        material: "Cuero",
        dimensions: "30 x 20 x 10",
      });

      expect(variant).toBeNull();
    });
  });
});
