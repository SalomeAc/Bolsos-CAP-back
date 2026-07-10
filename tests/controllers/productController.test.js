jest.mock("../../api/dao/productDAO");
jest.mock("../../api/services/cloudinaryService");
jest.mock("../../api/models/product", () => ({
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

const productController = require("../../api/controllers/productController");
const productDAO = require("../../api/dao/productDAO");
const CloudinaryService = require("../../api/services/cloudinaryService");
const Product = require("../../api/models/product");

describe("productController", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getProducts", () => {
    it("retorna lista normalizada", async () => {
      const response = res();
      productDAO.getProducts.mockResolvedValue([
        {
          name: "Bolso",
          color: "Rojo",
          dimensions: ["20 cm"],
          materials: ["Lana"],
        },
      ]);

      await productController.getProducts({}, response);

      expect(response.json).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "Bolso",
          color: ["Rojo"],
          dimensions: ["20"],
          materials: ["Lana"],
        }),
      ]);
    });

    it("maneja error del DAO", async () => {
      const response = res();
      productDAO.getProducts.mockRejectedValue(new Error("DB down"));

      await productController.getProducts({}, response);

      expect(response.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getProductById", () => {
    it("retorna 404 si no existe", async () => {
      const response = res();
      productDAO.getProductById.mockResolvedValue(null);

      await productController.getProductById({ params: { id: "x" } }, response);

      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("retorna producto encontrado", async () => {
      const response = res();
      productDAO.getProductById.mockResolvedValue({
        _id: "p1",
        name: "Bolso",
        color: ["Negro"],
        dimensions: ["20"],
        materials: ["Algodón"],
      });

      await productController.getProductById({ params: { id: "p1" } }, response);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ _id: "p1", name: "Bolso" }),
      );
    });
  });

  describe("createProductFromForm", () => {
    it("valida campos obligatorios", async () => {
      const response = res();
      await productController.createProductFromForm(
        { body: { name: "Solo nombre" } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("requiere imagen", async () => {
      const response = res();
      await productController.createProductFromForm(
        {
          body: {
            name: "Bolso",
            description: "Desc",
            type: "Hombro",
            color: "Rojo",
            dimensions: "20x15x8",
            materials: "Lana",
          },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("crea producto con imagen", async () => {
      const response = res();
      CloudinaryService.uploadImageBuffer.mockResolvedValue({
        url: "https://cdn/img.jpg",
        publicId: "folder/img",
      });
      productDAO.createProduct.mockResolvedValue({
        _id: "p1",
        name: "Bolso",
        color: ["Rojo"],
        dimensions: ["20x15x8"],
        materials: ["Lana"],
        photo: "https://cdn/img.jpg",
      });

      await productController.createProductFromForm(
        {
          body: {
            name: "Bolso",
            description: "Desc",
            type: "Hombro",
            color: "Rojo",
            dimensions: "20x15x8",
            materials: "Lana",
          },
          file: { buffer: Buffer.from("img") },
        },
        response,
      );

      expect(response.status).toHaveBeenCalledWith(201);
      expect(productDAO.createProduct).toHaveBeenCalled();
    });
  });

  describe("deleteProduct", () => {
    it("elimina producto con imagen cloudinary", async () => {
      const response = res();
      productDAO.getProductById.mockResolvedValue({
        _id: "p1",
        photoPublicId: "folder/img",
      });
      CloudinaryService.deleteProductImage.mockResolvedValue({});
      Product.findByIdAndDelete.mockResolvedValue({});

      await productController.deleteProduct({ params: { id: "p1" } }, response);

      expect(CloudinaryService.deleteProductImage).toHaveBeenCalled();
      expect(response.json).toHaveBeenCalledWith({ message: "Producto eliminado" });
    });
  });

  describe("deleteProductPhoto", () => {
    it("retorna 400 si no hay imagen", async () => {
      const response = res();
      productDAO.getProductById.mockResolvedValue({
        _id: "p1",
        photo: "",
        save: jest.fn(),
      });

      await productController.deleteProductPhoto(
        { params: { id: "p1" } },
        response,
      );

      expect(response.status).toHaveBeenCalledWith(400);
    });
  });
});
