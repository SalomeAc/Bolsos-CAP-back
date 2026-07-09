jest.mock("../../api/services/productVariantService");

const ProductVariantService = require("../../api/services/productVariantService");
const {
  listVariants,
  syncVariants,
  updateVariants,
  deleteVariant,
} = require("../../api/controllers/productVariantController");

describe("productVariantController", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("listVariants retorna variantes", async () => {
    ProductVariantService.listVariantsForProduct.mockResolvedValue([
      { _id: "v1" },
    ]);
    const response = res();

    await listVariants(
      { params: { productId: "p1" }, query: { sync: "true" } },
      response,
    );

    expect(ProductVariantService.listVariantsForProduct).toHaveBeenCalledWith(
      "p1",
      { sync: true },
    );
    expect(response.json).toHaveBeenCalledWith([{ _id: "v1" }]);
  });

  it("syncVariants sincroniza variantes", async () => {
    ProductVariantService.syncVariantsForProduct.mockResolvedValue({
      created: 1,
    });
    const response = res();

    await syncVariants({ params: { productId: "p1" } }, response);

    expect(response.json).toHaveBeenCalledWith({ created: 1 });
  });

  it("updateVariants actualiza y lista", async () => {
    ProductVariantService.bulkUpdateVariants.mockResolvedValue({});
    ProductVariantService.listVariantsForProduct.mockResolvedValue([
      { _id: "v1", totalPrice: 100 },
    ]);
    const response = res();

    await updateVariants(
      {
        params: { productId: "p1" },
        body: { variants: [{ _id: "v1", totalPrice: 100 }] },
      },
      response,
    );

    expect(ProductVariantService.bulkUpdateVariants).toHaveBeenCalled();
    expect(response.json).toHaveBeenCalled();
  });

  it("deleteVariant retorna 404 si no existe", async () => {
    ProductVariantService.deleteVariantForProduct.mockRejectedValue(
      new Error("Variante no encontrada"),
    );
    const response = res();

    await deleteVariant(
      { params: { productId: "p1", variantId: "v1" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("listVariants maneja error", async () => {
    ProductVariantService.listVariantsForProduct.mockRejectedValue(
      new Error("Producto inválido"),
    );
    const response = res();

    await listVariants({ params: { productId: "bad" }, query: {} }, response);

    expect(response.status).toHaveBeenCalledWith(400);
  });
});
