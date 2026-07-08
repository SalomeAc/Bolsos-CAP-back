const QuotationController = require("../../api/controllers/quotationController");
const ProductVariantService = require("../../api/services/productVariantService");
const NotificationService = require("../../api/services/notificationService");

jest.mock("../../api/services/productVariantService");
jest.mock("../../api/services/notificationService");
jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/dao/userDAO");
jest.mock("../../api/utils/aiWorkflowLogger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logQuotationState: jest.fn(),
  logGenerationStart: jest.fn(),
  logGenerationEnd: jest.fn(),
  logSolicitudForN8n: jest.fn().mockReturnValue({ valid: true, issues: [] }),
  validateCustomProductForN8n: jest.fn(),
  maskWebhookUrl: jest.fn(),
}));

const QuotationDAO = require("../../api/dao/quotationDAO");
const SolicitudDAO = require("../../api/dao/solicitudDAO");

describe("QuotationController catalog auto quote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aplica cotización automática cuando existe variante con precio", async () => {
    ProductVariantService.findVariantForQuotation.mockResolvedValue({
      precio_total: 120000,
    });

    QuotationDAO.read = jest
      .fn()
      .mockResolvedValueOnce({
        _id: "q1",
        kind: "catalog",
        quantity: 2,
        product: "p1",
        customization: {
          color: "Negro",
          material: "Algodón",
          size: "26 x 22 x 8",
        },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        kind: "catalog",
        status: "cotizada",
        finalQuotation: { amount: 240000 },
      });

    QuotationDAO.update = jest.fn().mockResolvedValue({});
    SolicitudDAO.update = jest.fn().mockResolvedValue({});

    const applied = await QuotationController._applyCatalogAutoQuotation(
      "q1",
      "s1",
    );

    expect(applied).toBe(true);
    expect(QuotationDAO.update).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({
        status: "cotizada",
        finalQuotation: expect.objectContaining({ amount: 240000 }),
      }),
    );
    expect(SolicitudDAO.update).toHaveBeenCalledWith("s1", {
      status: "cotizada",
    });
  });

  it("no aplica cotización automática si precio_total es 0", async () => {
    ProductVariantService.findVariantForQuotation.mockResolvedValue({
      precio_total: 0,
    });

    QuotationDAO.read = jest.fn().mockResolvedValue({
      _id: "q1",
      kind: "catalog",
      product: "p1",
      customization: { color: "Negro", material: "Algodón", size: "26 x 22 x 8" },
    });
    QuotationDAO.update = jest.fn();

    const applied = await QuotationController._applyCatalogAutoQuotation(
      "q1",
      "s1",
    );

    expect(applied).toBe(false);
    expect(QuotationDAO.update).not.toHaveBeenCalled();
  });

  it("envía mensaje de cotización lista cuando autoQuotedCatalog es true", async () => {
    NotificationService.notifyClientQuotationSent.mockResolvedValue({});
    NotificationService.notifyAdminNewRequest.mockResolvedValue([]);

    await QuotationController._sendNotificationAsync(
      { _id: "q1", finalQuotation: { amount: 120000 } },
      { solicitud: { _id: "s1" }, options: { autoQuotedCatalog: true } },
    );

    expect(NotificationService.notifyClientQuotationSent).toHaveBeenCalled();
    expect(NotificationService.notifyAdminNewRequest).toHaveBeenCalled();
    expect(NotificationService.sendQuotationConfirmation).not.toHaveBeenCalled();
    expect(
      NotificationService.notifyClientQuotationReceived,
    ).not.toHaveBeenCalled();
  });

  it("usa flujo pendiente cuando autoQuotedCatalog es false", async () => {
    NotificationService.sendQuotationConfirmation.mockResolvedValue({});
    NotificationService.notifyClientQuotationReceived.mockResolvedValue({});
    NotificationService.notifyAdminNewRequest.mockResolvedValue([]);

    await QuotationController._sendNotificationAsync(
      { _id: "q1" },
      { solicitud: { _id: "s1" }, options: { autoQuotedCatalog: false } },
    );

    expect(NotificationService.sendQuotationConfirmation).toHaveBeenCalled();
    expect(NotificationService.notifyClientQuotationReceived).toHaveBeenCalled();
    expect(NotificationService.notifyClientQuotationSent).not.toHaveBeenCalled();
  });
});
