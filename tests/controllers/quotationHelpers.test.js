const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");

describe("QuotationController helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    QuotationController._ensureAdminAiNotification = jest
      .fn()
      .mockResolvedValue({});
  });

  it("_normalizeDimensionsForAi compacta dimensiones", () => {
    expect(QuotationController._normalizeDimensionsForAi("26 x 22 x 8 cm")).toBe(
      "26x22x8cm",
    );
    expect(QuotationController._normalizeDimensionsForAi(null)).toBeNull();
  });

  it("_sanitizeQuotationForClient oculta IA al cliente", () => {
    const sanitized = QuotationController._sanitizeQuotationForClient({
      _id: "q1",
      status: "cotizada_ia",
      aiQuotation: { amount: 100000 },
      finalQuotation: null,
    });

    expect(sanitized.aiQuotation).toBeUndefined();
    expect(sanitized.status).toBe("pendiente");
  });

  it("_normalizeAiPayload acepta nombres de n8n", () => {
    const payload = QuotationController._normalizeAiPayload({
      precio_sugerido: "180000",
      justificacion: "Material premium",
      confianza: "alta",
    });

    expect(payload).toEqual(
      expect.objectContaining({
        amount: 180000,
        breakdown: "Material premium",
        confianza: "alta",
      }),
    );
  });

  it("_buildAiQuotationUpdate retorna null sin monto", () => {
    expect(
      QuotationController._buildAiQuotationUpdate({ justificacion: "solo texto" }),
    ).toBeNull();
  });

  it("_buildAiQuotationUpdate construye objeto completo", () => {
    const result = QuotationController._buildAiQuotationUpdate(
      { precio_sugerido: 200000, justificacion: "Detalle", model: "gemini" },
      {},
    );

    expect(result).toEqual(
      expect.objectContaining({
        amount: 200000,
        breakdown: "Detalle",
        model: "gemini",
        generatedAt: expect.any(Date),
      }),
    );
  });

  it("setAiQuotation guarda propuesta IA", async () => {
    QuotationDAO.read
      .mockResolvedValueOnce({ _id: "q1", aiQuotation: {} })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada_ia",
        aiQuotation: { amount: 150000 },
      });
    QuotationDAO.update.mockResolvedValue({});

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await QuotationController.setAiQuotation(
      {
        params: { id: "q1" },
        body: { precio_sugerido: 150000, justificacion: "IA" },
      },
      res,
    );

    expect(QuotationDAO.update).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("setAiQuotation retorna 400 sin monto", async () => {
    QuotationDAO.read.mockResolvedValue({ _id: "q1", aiQuotation: {} });
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await QuotationController.setAiQuotation(
      { params: { id: "q1" }, body: { justificacion: "sin monto" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("getTraceability retorna timeline", async () => {
    const SolicitudDAO = require("../../api/dao/solicitudDAO");
    QuotationDAO.read.mockResolvedValue({
      _id: "q1",
      status: "cotizada",
      solicitud: "s1",
      createdAt: new Date("2026-01-01"),
    });
    SolicitudDAO.read.mockResolvedValue({
      _id: "s1",
      code: "SOL-001",
      status: "cotizada",
    });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await QuotationController.getTraceability({ params: { id: "q1" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        cotizacion: expect.objectContaining({ _id: "q1" }),
        timeline: expect.any(Array),
      }),
    );
  });

  it("getTraceability retorna 404 si no existe", async () => {
    QuotationDAO.read.mockResolvedValue(null);
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await QuotationController.getTraceability({ params: { id: "q1" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
