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
  deleteById: jest.fn(),
}));

const ProductVariantDAO = require("../../api/dao/productVariantDAO");

describe("ProductVariantService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("normalizeDimensions", () => {
    it("normaliza espacios y sufijo cm para comparar dimensiones", () => {
      expect(normalizeDimensions("26 x 22 x 8 cm")).toBe("26x22x8");
      expect(normalizeDimensions("26 x 22 x8")).toBe("26x22x8");
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
          totalPrice: 150000,
          materialPrice: 40000,
          workHours: 6,
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
          totalPrice: 150000,
          workHours: 6,
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

  describe("deleteVariantForProduct", () => {
    const productId = "507f1f77bcf86cd799439011";
    const variantId = "507f1f77bcf86cd799439012";

    it("elimina una variante que pertenece al producto", async () => {
      ProductVariantDAO.findOne.mockResolvedValue({
        _id: variantId,
        productId,
        color: "Negro",
        material: "Algodón",
        dimensions: "26 x 22 x 8",
        totalPrice: 150000,
        materialPrice: 40000,
        workHours: 6,
        sku: "PRD-negro-algodon-26x22x8",
        stock: 0,
      });
      ProductVariantDAO.deleteById.mockResolvedValue({
        _id: variantId,
        productId,
        color: "Negro",
        material: "Algodón",
        dimensions: "26 x 22 x 8",
        totalPrice: 150000,
        materialPrice: 40000,
        workHours: 6,
        sku: "PRD-negro-algodon-26x22x8",
        stock: 0,
      });

      const deleted = await ProductVariantService.deleteVariantForProduct(
        productId,
        variantId,
      );

      expect(ProductVariantDAO.findOne).toHaveBeenCalledWith({
        _id: variantId,
      });
      expect(ProductVariantDAO.deleteById).toHaveBeenCalledWith(variantId);
      expect(deleted).toEqual(
        expect.objectContaining({
          _id: variantId,
          totalPrice: 150000,
        }),
      );
    });

    it("lanza error si la variante no pertenece al producto", async () => {
      ProductVariantDAO.findOne.mockResolvedValue(null);

      await expect(
        ProductVariantService.deleteVariantForProduct(
          productId,
          "507f1f77bcf86cd799439099",
        ),
      ).rejects.toThrow("Variante no encontrada para este producto");
    });
  });
});
