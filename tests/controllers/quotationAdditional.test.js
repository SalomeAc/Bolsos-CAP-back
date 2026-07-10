const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/services/notificationService");

describe("QuotationController additional paths", () => {
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

  describe("setAiQuotation", () => {
    it("retorna 404 si no existe", async () => {
      QuotationDAO.read.mockResolvedValue(null);
      const response = res();
      await QuotationController.setAiQuotation(
        { params: { id: "q1" }, body: { amount: 100 } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("retorna 400 sin monto", async () => {
      QuotationDAO.read.mockResolvedValue({ _id: "q1", aiQuotation: {} });
      const response = res();
      await QuotationController.setAiQuotation(
        { params: { id: "q1" }, body: {} },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("guarda propuesta IA vía endpoint admin", async () => {
      QuotationDAO.read
        .mockResolvedValueOnce({ _id: "q1", aiQuotation: {} })
        .mockResolvedValueOnce({
          _id: "q1",
          status: "cotizada_ia",
          aiQuotation: { amount: 175000 },
        });
      QuotationDAO.update.mockResolvedValue({});
      const response = res();

      await QuotationController.setAiQuotation(
        {
          params: { id: "q1" },
          body: { precio_sugerido: 175000, justificacion: "Detalle" },
        },
        response,
      );

      expect(QuotationDAO.update).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
    });
  });

  describe("respondQuotation edge cases", () => {
    it("retorna 404 si cotización no existe", async () => {
      QuotationDAO.read.mockResolvedValue(null);
      const response = res();
      await QuotationController.respondQuotation(
        {
          params: { id: "q1" },
          body: { decision: "aceptada" },
          user: { id: "u1" },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("rechaza respuesta en estado incorrecto", async () => {
      QuotationDAO.read.mockResolvedValue({
        _id: "q1",
        status: "pendiente",
        user: "u1",
      });
      const response = res();
      await QuotationController.respondQuotation(
        {
          params: { id: "q1" },
          body: { decision: "aceptada" },
          user: { id: "u1" },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(409);
    });

    it("rechaza aceptar sin precio final", async () => {
      QuotationDAO.read.mockResolvedValue({
        _id: "q1",
        status: "cotizada",
        user: "u1",
        finalQuotation: {},
      });
      const response = res();
      await QuotationController.respondQuotation(
        {
          params: { id: "q1" },
          body: { decision: "aceptada" },
          user: { id: "u1" },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(409);
    });

    it("rechaza propuesta sin monto", async () => {
      QuotationDAO.read.mockResolvedValue({
        _id: "q1",
        status: "cotizada",
        user: "u1",
        finalQuotation: { amount: 100000 },
      });
      const response = res();
      await QuotationController.respondQuotation(
        {
          params: { id: "q1" },
          body: { decision: "propuesta" },
          user: { id: "u1" },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("maneja error interno", async () => {
      QuotationDAO.read.mockRejectedValue(new Error("DB"));
      const response = res();
      await QuotationController.respondQuotation(
        {
          params: { id: "q1" },
          body: { decision: "aceptada" },
          user: { id: "u1" },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getMyQuotations errors", () => {
    it("maneja error del DAO", async () => {
      QuotationDAO.findByUser.mockRejectedValue(new Error("DB"));
      const response = res();
      await QuotationController.getMyQuotations(
        { user: { id: "u1" } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(500);
    });
  });
});
