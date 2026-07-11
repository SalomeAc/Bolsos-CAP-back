const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");
const SolicitudDAO = require("../../api/dao/solicitudDAO");
const CloudinaryService = require("../../api/services/cloudinaryService");
const RekognitionService = require("../../api/services/rekognitionService");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/services/cloudinaryService");
jest.mock("../../api/services/rekognitionService");
jest.mock("../../api/services/productVariantService");
jest.mock("../../api/services/notificationService", () => ({
  sendQuotationConfirmation: jest.fn().mockResolvedValue({}),
  notifyAdminNewRequest: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../api/utils/aiWorkflowLogger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logQuotationState: jest.fn(),
  validateCustomProductForN8n: jest
    .fn()
    .mockReturnValue({ valid: true, snapshot: {} }),
}));

describe("QuotationController.createCustomQuotationFromForm (HU-12, HU-34)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    QuotationController._triggerAiQuotationWorkflow = jest
      .fn()
      .mockResolvedValue({ triggered: false });
    QuotationController._sendNotificationAsync = jest
      .fn()
      .mockResolvedValue({});
    QuotationController._sanitizeQuotationForClient = jest.fn((q) => q);
  });

  it("persiste observaciones dictadas en notes de cotización y solicitud", async () => {
    const req = {
      body: {
        dimensions: "30x20x10",
        color: "#d4c2ff",
        material: "Algodón",
        observaciones: "Quiero asas largas en color crema",
      },
      user: { id: "user123" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockSolicitud = { _id: "sol1" };
    const mockQuotation = { _id: "q1", status: "pendiente" };

    SolicitudDAO.create.mockResolvedValue(mockSolicitud);
    QuotationDAO.create.mockResolvedValue(mockQuotation);
    SolicitudDAO.update.mockResolvedValue({});
    QuotationDAO.read.mockResolvedValue({
      ...mockQuotation,
      notes: "Quiero asas largas en color crema",
    });
    SolicitudDAO.read.mockResolvedValue({
      ...mockSolicitud,
      notes: "Quiero asas largas en color crema",
    });

    await QuotationController.createCustomQuotationFromForm(req, res);

    expect(SolicitudDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: "Quiero asas largas en color crema",
      }),
    );
    expect(QuotationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: "Quiero asas largas en color crema",
      }),
    );
    expect(QuotationController._sendNotificationAsync).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        options: expect.objectContaining({
          observaciones: "Quiero asas largas en color crema",
          fromCotizarForm: true,
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rechaza formulario sin campos obligatorios", async () => {
    const req = {
      body: {
        dimensions: "",
        color: "#fff",
        material: "Lana",
        observaciones: "texto dictado",
      },
      user: { id: "user123" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await QuotationController.createCustomQuotationFromForm(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Dimensiones, color y material son obligatorios",
    });
    expect(SolicitudDAO.create).not.toHaveBeenCalled();
  });

  it("sube foto de referencia cuando se adjunta archivo", async () => {
    CloudinaryService.uploadImageBuffer.mockResolvedValue({
      url: "https://cdn.example.com/ref.jpg",
    });

    const req = {
      body: {
        dimensions: "25x18x8",
        color: "Rojo",
        material: "Lana",
        observaciones: "",
      },
      file: { buffer: Buffer.from("fake-image") },
      user: { id: "user123" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    SolicitudDAO.create.mockResolvedValue({ _id: "sol2" });
    QuotationDAO.create.mockResolvedValue({ _id: "q2" });
    SolicitudDAO.update.mockResolvedValue({});
    QuotationDAO.read.mockResolvedValue({ _id: "q2" });
    SolicitudDAO.read.mockResolvedValue({ _id: "sol2" });

    await QuotationController.createCustomQuotationFromForm(req, res);

    expect(CloudinaryService.uploadImageBuffer).toHaveBeenCalled();
    expect(QuotationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customProduct: expect.objectContaining({
          photo: "https://cdn.example.com/ref.jpg",
        }),
      }),
    );
  });

  it("valida la imagen con Rekognition antes de subirla a Cloudinary", async () => {
    RekognitionService.validateImage.mockResolvedValue(true);
    CloudinaryService.uploadImageBuffer.mockResolvedValue({
      url: "https://cdn.example.com/ref.jpg",
      publicId: "ref-id",
    });

    const req = {
      body: {
        dimensions: "25x18x8",
        color: "Rojo",
        material: "Lana",
        observaciones: "",
      },
      file: { buffer: Buffer.from("fake-image") },
      user: { id: "user123" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    SolicitudDAO.create.mockResolvedValue({ _id: "sol3" });
    QuotationDAO.create.mockResolvedValue({ _id: "q3" });
    SolicitudDAO.update.mockResolvedValue({});
    QuotationDAO.read.mockResolvedValue({ _id: "q3" });
    SolicitudDAO.read.mockResolvedValue({ _id: "sol3" });

    await QuotationController.createCustomQuotationFromForm(req, res);

    expect(RekognitionService.validateImage).toHaveBeenCalledWith(
      req.file.buffer,
    );
    expect(
      RekognitionService.validateImage.mock.invocationCallOrder[0],
    ).toBeLessThan(
      CloudinaryService.uploadImageBuffer.mock.invocationCallOrder[0],
    );
  });
});
