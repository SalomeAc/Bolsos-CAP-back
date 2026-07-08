const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");
const SolicitudDAO = require("../../api/dao/solicitudDAO");
const NotificationService = require("../../api/services/notificationService");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/services/notificationService");
jest.mock("../../api/models/user", () => ({
  find: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue([
      { _id: "admin1", email: "admin@test.com", isAdmin: true, isActive: true },
    ]),
  }),
  findOne: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue({ _id: "admin1", isAdmin: true }),
  }),
}));

describe("QuotationController - flujo IA y finalQuotation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NotificationService.notifyClientQuotationSent.mockResolvedValue({});
    NotificationService.notifyAdminAiQuotationReady.mockResolvedValue([]);
  });

  it("setFinalQuotation copia aiQuotation.amount a finalQuotation al aceptar IA", async () => {
    const req = {
      params: { id: "q1" },
      body: {},
      user: { id: "admin1" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    QuotationDAO.read
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada_ia",
        kind: "custom",
        solicitud: "s1",
        aiQuotation: { amount: 180000, currency: "COP" },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada",
        finalQuotation: { amount: 180000, currency: "COP" },
      });

    QuotationDAO.update.mockResolvedValue({});
    QuotationDAO.unset.mockResolvedValue({});
    SolicitudDAO.update.mockResolvedValue({});

    await QuotationController.setFinalQuotation(req, res);

    expect(QuotationDAO.update).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({
        status: "cotizada",
        finalQuotation: expect.objectContaining({
          amount: 180000,
          currency: "COP",
          quotedBy: "admin1",
        }),
      }),
    );
    expect(NotificationService.notifyClientQuotationSent).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("onAiQuotationReady persiste precio_sugerido en aiQuotation", async () => {
    const req = {
      body: {
        quotationId: "q1",
        precio_sugerido: 220000,
        justificacion: "Material premium",
      },
      webhookPayload: { quotationId: "q1" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    QuotationDAO.read
      .mockResolvedValueOnce({
        _id: "q1",
        status: "pendiente",
        aiQuotation: {},
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada_ia",
        aiQuotation: { amount: 220000 },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada_ia",
        aiQuotation: { amount: 220000 },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada_ia",
        aiQuotation: { amount: 220000, adminNotifiedAt: new Date() },
      });

    QuotationDAO.update.mockResolvedValue({});
    QuotationDAO.patch.mockResolvedValue({});

    await QuotationController.onAiQuotationReady(req, res);

    expect(QuotationDAO.update).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({
        status: "cotizada_ia",
        aiQuotation: expect.objectContaining({
          amount: 220000,
          breakdown: "Material premium",
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("repara finalQuotation mal ubicado y lo mueve a aiQuotation", async () => {
    QuotationDAO.update.mockResolvedValue({});
    QuotationDAO.unset.mockResolvedValue({});
    QuotationDAO.read.mockResolvedValue({
      _id: "q1",
      status: "cotizada_ia",
      aiQuotation: { amount: 150000 },
    });

    const repaired = await QuotationController._repairMisplacedAiQuotation({
      _id: "q1",
      status: "cotizada_ia",
      aiQuotation: {},
      finalQuotation: { amount: 150000, currency: "COP", notes: "IA" },
    });

    expect(QuotationDAO.update).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({
        aiQuotation: expect.objectContaining({ amount: 150000 }),
        status: "cotizada_ia",
      }),
    );
    expect(QuotationDAO.unset).toHaveBeenCalledWith("q1", {
      finalQuotation: "",
    });
    expect(repaired.aiQuotation.amount).toBe(150000);
  });
});
