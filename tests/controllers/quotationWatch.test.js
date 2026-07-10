const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");
const SolicitudDAO = require("../../api/dao/solicitudDAO");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/services/notificationService", () => ({
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
}));

describe("QuotationController._watchAiQuotationCompletion", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    QuotationController._ensureAdminAiNotification = jest
      .fn()
      .mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("detecta cotizada_ia y notifica admin", async () => {
    let reads = 0;
    QuotationDAO.read.mockImplementation(async () => {
      reads += 1;
      if (reads === 1) {
        return { _id: "q1", status: "pendiente" };
      }
      return {
        _id: "q1",
        status: "cotizada_ia",
        aiQuotation: { amount: 120000, model: "gemini" },
      };
    });

    const watchPromise = QuotationController._watchAiQuotationCompletion("q1", {
      solicitudId: "s1",
      attempts: 2,
      intervalMs: 1000,
    });

    await jest.runAllTimersAsync();
    const result = await watchPromise;

    expect(result).toBe(true);
    expect(QuotationController._ensureAdminAiNotification).toHaveBeenCalled();
  });

  it("retorna false si cambia a estado inesperado", async () => {
    let reads = 0;
    QuotationDAO.read.mockImplementation(async () => {
      reads += 1;
      if (reads === 1) {
        return { _id: "q1", status: "pendiente" };
      }
      return { _id: "q1", status: "rechazada", aiQuotation: null };
    });

    const watchPromise = QuotationController._watchAiQuotationCompletion("q1", {
      attempts: 2,
      intervalMs: 500,
    });

    await jest.runAllTimersAsync();
    const result = await watchPromise;

    expect(result).toBe(false);
  });

  it("agota intentos sin propuesta IA", async () => {
    QuotationDAO.read.mockResolvedValue({ _id: "q1", status: "pendiente" });
    SolicitudDAO.read.mockResolvedValue({ _id: "s1", code: "SOL-1" });

    const watchPromise = QuotationController._watchAiQuotationCompletion("q1", {
      solicitudId: "s1",
      attempts: 2,
      intervalMs: 100,
    });

    await jest.runAllTimersAsync();
    const result = await watchPromise;

    expect(result).toBe(false);
    expect(SolicitudDAO.read).toHaveBeenCalledWith("s1");
  });
});
