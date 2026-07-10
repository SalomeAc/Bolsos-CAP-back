const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");
const SolicitudDAO = require("../../api/dao/solicitudDAO");
const NotificationService = require("../../api/services/notificationService");
const ProductVariantService = require("../../api/services/productVariantService");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/dao/userDAO");
jest.mock("../../api/services/notificationService");
jest.mock("../../api/services/productVariantService");
jest.mock("../../api/utils/aiWorkflowLogger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logQuotationState: jest.fn(),
  logGenerationStart: jest.fn(),
  logGenerationEnd: jest.fn(),
  logSolicitudForN8n: jest.fn().mockReturnValue({ valid: true, issues: [] }),
  validateCustomProductForN8n: jest.fn().mockReturnValue({
    valid: true,
    snapshot: {},
  }),
  maskWebhookUrl: jest.fn(),
}));

describe("QuotationController.createQuotation catalog flow", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.N8N_WEBHOOK_URL;
    delete process.env.N8N_WEBHOOK_SECRET;
    NotificationService.notifyClientQuotationSent.mockResolvedValue({});
    NotificationService.notifyAdminNewRequest.mockResolvedValue([]);
    NotificationService.notifyAdminCatalogAutoQuoteSkipped.mockResolvedValue([]);
    QuotationController._triggerAiQuotationWorkflow = jest
      .fn()
      .mockResolvedValue({ triggered: false, reason: "catalog_not_supported" });
  });

  it("rechaza kind inválido", async () => {
    const response = res();
    await QuotationController.createQuotation(
      { body: { kind: "otro" }, user: { id: "u1" } },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("rechaza catálogo sin producto", async () => {
    const response = res();
    await QuotationController.createQuotation(
      { body: { kind: "catalog" }, user: { id: "u1" } },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("crea cotización de catálogo con auto-cotización aplicada", async () => {
    SolicitudDAO.create.mockResolvedValue({ _id: "s1" });
    SolicitudDAO.update.mockResolvedValue({});
    QuotationDAO.create.mockResolvedValue({ _id: "q1" });
    ProductVariantService.findVariantForQuotation.mockResolvedValue({
      totalPrice: 100000,
    });

    QuotationDAO.read
      .mockResolvedValueOnce({
        _id: "q1",
        kind: "catalog",
        quantity: 1,
        product: "p1",
        customization: {
          color: "Negro",
          material: "Algodón",
          size: "26x22x8",
        },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        kind: "catalog",
        status: "cotizada",
        finalQuotation: { amount: 100000 },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        kind: "catalog",
        status: "cotizada",
        finalQuotation: { amount: 100000 },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        kind: "catalog",
        status: "cotizada",
        finalQuotation: { amount: 100000 },
      });

    QuotationDAO.update.mockResolvedValue({});
    SolicitudDAO.read.mockResolvedValue({ _id: "s1", code: "SOL-1" });

    const response = res();
    await QuotationController.createQuotation(
      {
        user: { id: "u1" },
        body: {
          kind: "catalog",
          product: "p1",
          quantity: 1,
          customization: {
            color: "Negro",
            material: "Algodón",
            size: "26x22x8",
          },
        },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(201);
    expect(NotificationService.notifyClientQuotationSent).toHaveBeenCalled();
  });

  it("crea cotización custom y notifica pendiente", async () => {
    SolicitudDAO.create.mockResolvedValue({ _id: "s2" });
    SolicitudDAO.update.mockResolvedValue({});
    QuotationDAO.create.mockResolvedValue({ _id: "q2" });
    QuotationDAO.read.mockResolvedValue({
      _id: "q2",
      kind: "custom",
      status: "pendiente",
    });
    SolicitudDAO.read.mockResolvedValue({ _id: "s2" });
    NotificationService.sendQuotationConfirmation.mockResolvedValue({});
    NotificationService.notifyClientQuotationReceived.mockResolvedValue({});

    const response = res();
    await QuotationController.createQuotation(
      {
        user: { id: "u1" },
        body: {
          kind: "custom",
          customProduct: {
            description: "Bolso",
            color: "Rojo",
            materials: ["Lana"],
            dimensions: "20x15x10",
          },
        },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(201);
    expect(NotificationService.sendQuotationConfirmation).toHaveBeenCalled();
  });

  it("maneja ValidationError al crear", async () => {
    const err = new Error("validation");
    err.name = "ValidationError";
    err.errors = { quantity: { message: "Cantidad inválida" } };
    SolicitudDAO.create.mockRejectedValue(err);

    const response = res();
    await QuotationController.createQuotation(
      {
        user: { id: "u1" },
        body: {
          kind: "custom",
          customProduct: { description: "Bolso" },
        },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "Cantidad inválida" });
  });
});
