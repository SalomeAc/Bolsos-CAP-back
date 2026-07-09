jest.mock("../../api/config/cloudinary", () => ({
  uploader: {
    upload_stream: jest.fn(),
    destroy: jest.fn(),
  },
}));

const cloudinary = require("../../api/config/cloudinary");
const CloudinaryService = require("../../api/services/cloudinaryService");

describe("cloudinaryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isCloudinaryUrl", () => {
    it("detecta URLs de cloudinary", () => {
      expect(
        CloudinaryService.isCloudinaryUrl(
          "https://res.cloudinary.com/demo/image/upload/v123/folder/img.jpg",
        ),
      ).toBe(true);
      expect(CloudinaryService.isCloudinaryUrl("https://example.com/a.jpg")).toBe(
        false,
      );
    });
  });

  describe("getPublicIdFromUrl", () => {
    it("extrae public id de URL estándar", () => {
      const publicId = CloudinaryService.getPublicIdFromUrl(
        "https://res.cloudinary.com/demo/image/upload/v1710000000/Productos-Bolsos-CAP/bolso-1.jpg",
      );
      expect(publicId).toBe("Productos-Bolsos-CAP/bolso-1");
    });

    it("retorna null para URL inválida", () => {
      expect(CloudinaryService.getPublicIdFromUrl("not-a-url")).toBeNull();
      expect(CloudinaryService.getPublicIdFromUrl("https://example.com/x.jpg")).toBeNull();
    });
  });

  describe("uploadImageBuffer", () => {
    it("resuelve url y publicId al subir", async () => {
      cloudinary.uploader.upload_stream.mockImplementation((opts, cb) => ({
        end: () =>
          cb(null, {
            secure_url: "https://cdn.example.com/img.jpg",
            public_id: "folder/img",
          }),
      }));

      const result = await CloudinaryService.uploadImageBuffer(
        Buffer.from("fake"),
        CloudinaryService.FOLDERS.PRODUCTS,
      );

      expect(result).toEqual({
        url: "https://cdn.example.com/img.jpg",
        publicId: "folder/img",
      });
    });

    it("rechaza si cloudinary falla", async () => {
      cloudinary.uploader.upload_stream.mockImplementation((opts, cb) => ({
        end: () => cb(new Error("upload failed")),
      }));

      await expect(
        CloudinaryService.uploadImageBuffer(Buffer.from("x")),
      ).rejects.toThrow("upload failed");
    });
  });

  describe("deleteImageByPublicId", () => {
    it("elimina imagen por public id", async () => {
      cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });

      const result = await CloudinaryService.deleteImageByPublicId("folder/img");

      expect(result).toEqual({ publicId: "folder/img", result: "ok" });
    });

    it("lanza error con public id vacío", async () => {
      await expect(CloudinaryService.deleteImageByPublicId("")).rejects.toThrow(
        "Public ID de imagen inválido",
      );
    });

    it("lanza error si destroy falla", async () => {
      cloudinary.uploader.destroy.mockResolvedValue({ result: "failed" });

      await expect(
        CloudinaryService.deleteImageByPublicId("folder/img"),
      ).rejects.toThrow("No se pudo eliminar la imagen de Cloudinary");
    });
  });

  describe("deleteProductImage", () => {
    it("usa photoPublicId cuando existe", async () => {
      cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });

      await CloudinaryService.deleteProductImage({
        photoPublicId: "folder/img",
      });

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("folder/img", {
        resource_type: "image",
        invalidate: true,
      });
    });

    it("usa URL cloudinary como respaldo", async () => {
      cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });

      await CloudinaryService.deleteProductImage({
        photo:
          "https://res.cloudinary.com/demo/image/upload/v1/Productos-Bolsos-CAP/bolso.jpg",
      });

      expect(cloudinary.uploader.destroy).toHaveBeenCalled();
    });

    it("retorna null si no hay imagen cloudinary", async () => {
      const result = await CloudinaryService.deleteProductImage({
        photo: "https://example.com/local.jpg",
      });
      expect(result).toBeNull();
    });
  });
});
