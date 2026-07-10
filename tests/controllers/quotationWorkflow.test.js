const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");
const SolicitudDAO = require("../../api/dao/solicitudDAO");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/services/notificationService", () => ({
  notifyAdminNewRequest: jest.fn().mockResolvedValue([]),
  notifyClientQuotationReceived: jest.fn().mockResolvedValue({}),
  notifyAdminAiQuotationReady: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../api/utils/aiWorkflowLogger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logGenerationStart: jest.fn(),
  logGenerationEnd: jest.fn(),
  logSolicitudForN8n: jest.fn().mockReturnValue({ valid: true, issues: [] }),
  logQuotationState: jest.fn(),
  logFetchError: jest.fn(),
  maskWebhookUrl: jest.fn((url) => url),
  getLogFilePath: jest.fn(() => "/tmp/ai-workflow.log"),
  validateCustomProductForN8n: jest.fn().mockReturnValue({ valid: true, issues: [], snapshot: {} }),
}));

describe("QuotationController reads", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    QuotationController._ensureAdminAiNotification = jest
      .fn()
      .mockResolvedValue(true);
  });

  it("getMyQuotations retorna cotizaciones sanitizadas", async () => {
    const response = res();
    QuotationDAO.findByUser.mockResolvedValue([
      { _id: "q1", status: "cotizada_ia", aiQuotation: { amount: 1 } },
    ]);

    await QuotationController.getMyQuotations(
      { user: { id: "u1" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json.mock.calls[0][0][0]).not.toHaveProperty("aiQuotation");
  });

  it("getQuotation retorna 404 si no existe", async () => {
    const response = res();
    QuotationDAO.read.mockResolvedValue(null);

    await QuotationController.getQuotation(
      { params: { id: "q1" }, user: { id: "u1" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("getQuotation permite admin ver IA", async () => {
    const response = res();
    QuotationDAO.read.mockResolvedValue({
      _id: "q1",
      user: "u2",
      status: "cotizada_ia",
      aiQuotation: { amount: 100000 },
    });

    await QuotationController.getQuotation(
      { params: { id: "q1" }, user: { id: "admin1", isAdmin: true } },
      response,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ aiQuotation: { amount: 100000 } }),
    );
  });

  it("getQuotation rechaza usuario no autorizado", async () => {
    const response = res();
    QuotationDAO.read.mockResolvedValue({
      _id: "q1",
      user: "u2",
      status: "cotizada",
    });

    await QuotationController.getQuotation(
      { params: { id: "q1" }, user: { id: "u1" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(403);
  });

  it("getQuotation maneja error interno", async () => {
    const response = res();
    QuotationDAO.read.mockRejectedValue(new Error("DB"));

    await QuotationController.getQuotation(
      { params: { id: "q1" }, user: { id: "u1" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("getAll retorna listado admin", async () => {
    const response = res();
    QuotationDAO.getAll.mockResolvedValue([
      { _id: "q1", status: "pendiente", aiQuotation: {} },
      { _id: "q2", status: "cotizada_ia", aiQuotation: { amount: 120000 } },
    ]);
    QuotationDAO.read.mockResolvedValue({
      _id: "q2",
      status: "cotizada_ia",
      aiQuotation: { amount: 120000 },
    });

    await QuotationController.getAll({ query: {} }, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalled();
  });

  it("getAll maneja error interno", async () => {
    const response = res();
    QuotationDAO.getAll.mockRejectedValue(new Error("DB"));

    await QuotationController.getAll({ query: {} }, response);

    expect(response.status).toHaveBeenCalledWith(500);
  });
});

describe("QuotationController._triggerAiQuotationWorkflow", () => {
  const originalUrl = process.env.N8N_WEBHOOK_URL;
  const originalSecret = process.env.N8N_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    QuotationController._watchAiQuotationCompletion = jest
      .fn()
      .mockResolvedValue(true);
    SolicitudDAO.read.mockResolvedValue({
      _id: "s1",
      customProduct: {
        description: "Bolso",
        color: "Rojo",
        materials: ["Lana"],
        dimensions: "20x15x10",
      },
    });
  });

  afterEach(() => {
    process.env.N8N_WEBHOOK_URL = originalUrl;
    process.env.N8N_WEBHOOK_SECRET = originalSecret;
  });

  it("omite IA para cotizaciones de catálogo", async () => {
    const result = await QuotationController._triggerAiQuotationWorkflow({
      quotationId: "q1",
      solicitudId: "s1",
      kind: "catalog",
    });

    expect(result.reason).toBe("catalog_not_supported");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("omite IA sin configuración n8n", async () => {
    delete process.env.N8N_WEBHOOK_URL;
    delete process.env.N8N_WEBHOOK_SECRET;

    const result = await QuotationController._triggerAiQuotationWorkflow({
      quotationId: "q1",
      solicitudId: "s1",
      kind: "custom",
    });

    expect(result.reason).toBe("missing_config");
  });

  it("dispara webhook para custom cuando está configurado", async () => {
    process.env.N8N_WEBHOOK_URL = "https://n8n.example/webhook";
    process.env.N8N_WEBHOOK_SECRET = "secret";
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok",
    });

    const result = await QuotationController._triggerAiQuotationWorkflow({
      quotationId: "q1",
      solicitudId: "s1",
      kind: "custom",
    });

    expect(global.fetch).toHaveBeenCalled();
    expect(result.triggered).toBe(true);
  });

  it("maneja rechazo del webhook n8n", async () => {
    process.env.N8N_WEBHOOK_URL = "https://n8n.example/webhook";
    process.env.N8N_WEBHOOK_SECRET = "secret";
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "error",
    });

    const result = await QuotationController._triggerAiQuotationWorkflow({
      quotationId: "q1",
      solicitudId: "s1",
      kind: "custom",
    });

    expect(result.triggered).toBe(false);
    expect(result.reason).toBe("webhook_rejected");
  });
});

describe("QuotationController._persistAiQuotationFromPayload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persiste payload de n8n en aiQuotation", async () => {
    QuotationDAO.read
      .mockResolvedValueOnce({ _id: "q1", aiQuotation: {} })
      .mockResolvedValueOnce({ _id: "q1", aiQuotation: { amount: 150000 } });
    QuotationDAO.update.mockResolvedValue({});

    const result = await QuotationController._persistAiQuotationFromPayload(
      "q1",
      { precio_sugerido: 150000, justificacion: "Detalle" },
    );

    expect(QuotationDAO.update).toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
