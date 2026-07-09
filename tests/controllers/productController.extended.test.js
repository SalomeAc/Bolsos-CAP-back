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

describe("productController extended", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  const validBody = {
    name: "Bolso",
    description: "Desc",
    type: "Hombro",
    color: "Rojo",
    dimensions: "20x15x8",
    materials: "Lana",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createProduct", () => {
    it("crea producto vía JSON", async () => {
      productDAO.createProduct.mockResolvedValue({
        _id: "p1",
        name: "Bolso",
        color: ["Rojo"],
        dimensions: ["20x15x8"],
        materials: ["Lana"],
      });
      const response = res();

      await productController.createProduct(
        { body: { name: "Bolso", color: "Rojo,Azul", dimensions: "20 cm" } },
        response,
      );

      expect(response.status).toHaveBeenCalledWith(201);
      expect(productDAO.createProduct).toHaveBeenCalled();
    });

    it("crea producto con color en arreglo", async () => {
      productDAO.createProduct.mockResolvedValue({
        _id: "p1",
        name: "Bolso",
        color: ["Rojo", "Azul"],
        dimensions: ["20"],
        materials: ["Lana"],
      });
      const response = res();

      await productController.createProduct(
        { body: { name: "Bolso", color: ["Rojo", "Azul"] } },
        response,
      );

      expect(response.status).toHaveBeenCalledWith(201);
    });

    it("maneja error de validación", async () => {
      productDAO.createProduct.mockRejectedValue(new Error("Invalid"));
      const response = res();
      await productController.createProduct({ body: {} }, response);
      expect(response.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateProduct", () => {
    it("actualiza producto existente", async () => {
      productDAO.getProductById.mockResolvedValue({
        _id: "p1",
        photo: "https://cdn/img.jpg",
      });
      Product.findByIdAndUpdate.mockResolvedValue({
        _id: "p1",
        name: "Nuevo",
        color: ["Verde"],
        dimensions: ["20"],
        materials: ["Lana"],
        photo: "https://cdn/img.jpg",
      });
      const response = res();

      await productController.updateProduct(
        { params: { id: "p1" }, body: { name: "Nuevo", color: "Verde" } },
        response,
      );

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Nuevo" }),
      );
    });

    it("retorna 404 si no existe", async () => {
      productDAO.getProductById.mockResolvedValue(null);
      const response = res();
      await productController.updateProduct(
        { params: { id: "x" }, body: {} },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("requiere imagen si producto no tiene foto", async () => {
      productDAO.getProductById.mockResolvedValue({ _id: "p1", photo: "" });
      const response = res();
      await productController.updateProduct(
        { params: { id: "p1" }, body: { name: "X" } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateProductFromForm", () => {
    it("actualiza con nueva imagen", async () => {
      productDAO.getProductById.mockResolvedValue({
        _id: "p1",
        photo: "https://old/img.jpg",
        photoPublicId: "old",
      });
      CloudinaryService.deleteProductImage.mockResolvedValue({});
      CloudinaryService.uploadImageBuffer.mockResolvedValue({
        url: "https://new/img.jpg",
        publicId: "new",
      });
      Product.findByIdAndUpdate.mockResolvedValue({
        _id: "p1",
        ...validBody,
        color: ["Rojo"],
        dimensions: ["20x15x8"],
        materials: ["Lana"],
        photo: "https://new/img.jpg",
      });
      const response = res();

      await productController.updateProductFromForm(
        {
          params: { id: "p1" },
          body: validBody,
          file: { buffer: Buffer.from("img") },
        },
        response,
      );

      expect(CloudinaryService.uploadImageBuffer).toHaveBeenCalled();
      expect(response.json).toHaveBeenCalled();
    });

    it("actualiza sin cambiar imagen", async () => {
      productDAO.getProductById.mockResolvedValue({
        _id: "p1",
        photo: "https://cdn/img.jpg",
      });
      Product.findByIdAndUpdate.mockResolvedValue({
        _id: "p1",
        name: "Bolso",
        color: ["Rojo"],
        dimensions: ["20x15x8"],
        materials: ["Lana"],
        photo: "https://cdn/img.jpg",
      });
      const response = res();

      await productController.updateProductFromForm(
        { params: { id: "p1" }, body: validBody },
        response,
      );

      expect(response.json).toHaveBeenCalled();
    });

    it("valida campos obligatorios", async () => {
      productDAO.getProductById.mockResolvedValue({ _id: "p1", photo: "x" });
      const response = res();
      await productController.updateProductFromForm(
        { params: { id: "p1" }, body: { name: "Solo" } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("retorna 404 si producto no existe", async () => {
      productDAO.getProductById.mockResolvedValue(null);
      const response = res();
      await productController.updateProductFromForm(
        { params: { id: "x" }, body: validBody },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(404);
    });
  });

  describe("deleteProductPhoto", () => {
    it("elimina foto del producto", async () => {
      const save = jest.fn().mockResolvedValue({});
      productDAO.getProductById.mockResolvedValue({
        _id: "p1",
        photo: "https://cdn/img.jpg",
        photoPublicId: "folder/img",
        save,
      });
      CloudinaryService.deleteProductImage.mockResolvedValue({});
      const response = res();

      await productController.deleteProductPhoto(
        { params: { id: "p1" } },
        response,
      );

      expect(CloudinaryService.deleteProductImage).toHaveBeenCalled();
      expect(save).toHaveBeenCalled();
      expect(response.json).toHaveBeenCalled();
    });
  });

  describe("deleteProduct", () => {
    it("maneja error al eliminar", async () => {
      productDAO.getProductById.mockResolvedValue({ _id: "p1", photo: "" });
      Product.findByIdAndDelete.mockRejectedValue(new Error("DB"));
      const response = res();
      await productController.deleteProduct({ params: { id: "p1" } }, response);
      expect(response.status).toHaveBeenCalledWith(500);
    });
  });
});
