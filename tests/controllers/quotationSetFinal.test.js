const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");
const SolicitudDAO = require("../../api/dao/solicitudDAO");
const NotificationService = require("../../api/services/notificationService");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/services/notificationService");
jest.mock("../../api/utils/aiWorkflowLogger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logQuotationState: jest.fn(),
}));

describe("QuotationController.setFinalQuotation", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.resetAllMocks();
    NotificationService.notifyClientQuotationSent.mockResolvedValue({});
    QuotationController._repairMisplacedAiQuotation = jest
      .fn()
      .mockImplementation(async (q) => q);
  });

  it("retorna 404 si no existe", async () => {
    QuotationDAO.read.mockResolvedValue(null);
    const response = res();
    await QuotationController.setFinalQuotation(
      { params: { id: "q1" }, body: { amount: 100000 }, user: { id: "admin" } },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("rechaza monto inválido", async () => {
    QuotationDAO.read.mockResolvedValue({
      _id: "q1",
      status: "cotizada_ia",
      aiQuotation: {},
    });
    const response = res();
    await QuotationController.setFinalQuotation(
      { params: { id: "q1" }, body: {}, user: { id: "admin" } },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("envía cotización final usando monto IA", async () => {
    QuotationDAO.read
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada_ia",
        solicitud: "s1",
        aiQuotation: { amount: 180000, currency: "COP" },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada",
        finalQuotation: { amount: 180000 },
      });
    QuotationDAO.update.mockResolvedValue({});
    QuotationDAO.patch.mockResolvedValue({});
    QuotationDAO.unset.mockResolvedValue({});
    SolicitudDAO.update.mockResolvedValue({});

    const response = res();
    await QuotationController.setFinalQuotation(
      {
        params: { id: "q1" },
        body: { clientNotes: "Incluye envío" },
        user: { id: "admin1" },
      },
      response,
    );

    expect(QuotationDAO.update).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({
        status: "cotizada",
        finalQuotation: expect.objectContaining({ amount: 180000 }),
      }),
    );
    expect(SolicitudDAO.update).toHaveBeenCalledWith("s1", {
      status: "cotizada",
    });
    expect(NotificationService.notifyClientQuotationSent).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("rechaza estado no permitido", async () => {
    QuotationDAO.read.mockResolvedValue({
      _id: "q1",
      status: "aceptada",
      finalQuotation: { amount: 100000 },
    });
    const response = res();
    await QuotationController.setFinalQuotation(
      { params: { id: "q1" }, body: { amount: 100000 }, user: { id: "admin" } },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(409);
  });

  it("maneja error al guardar", async () => {
    QuotationDAO.read.mockRejectedValue(new Error("DB"));
    const response = res();
    await QuotationController.setFinalQuotation(
      { params: { id: "q1" }, body: { amount: 100000 }, user: { id: "admin" } },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
  });
});

describe("QuotationController.onAiQuotationReady", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.resetAllMocks();
    QuotationController._repairMisplacedAiQuotation = jest
      .fn()
      .mockImplementation(async (q) => q);
    QuotationController._persistAiQuotationFromPayload = jest
      .fn()
      .mockResolvedValue(null);
    QuotationController._ensureAdminAiNotification = jest
      .fn()
      .mockResolvedValue(true);
  });

  it("rechaza sin quotationId", async () => {
    const response = res();
    await QuotationController.onAiQuotationReady({ body: {} }, response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("procesa callback de n8n", async () => {
    QuotationDAO.read
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada_ia",
        aiQuotation: { amount: 150000, adminNotifiedAt: new Date() },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada_ia",
        aiQuotation: { amount: 150000, adminNotifiedAt: new Date() },
      });

    const response = res();
    await QuotationController.onAiQuotationReady(
      {
        body: { quotationId: "q1", precio_sugerido: 150000 },
        webhookPayload: { quotationId: "q1" },
      },
      response,
    );

    expect(QuotationController._ensureAdminAiNotification).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, quotationId: "q1" }),
    );
  });
});
