const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");
const SolicitudDAO = require("../../api/dao/solicitudDAO");
const NotificationService = require("../../api/services/notificationService");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/services/notificationService");

describe("QuotationController.updateStatus (HU-30)", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    NotificationService.notifyClientStatusChanged.mockResolvedValue({});
  });

  it("rechaza estado no permitido", async () => {
    const response = res();
    await QuotationController.updateStatus(
      { params: { id: "q1" }, body: { status: "invalido" } },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("retorna 404 si no existe cotización", async () => {
    const response = res();
    QuotationDAO.read.mockResolvedValue(null);

    await QuotationController.updateStatus(
      { params: { id: "q1" }, body: { status: "en_produccion" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("actualiza estado y notifica al cliente", async () => {
    const response = res();
    QuotationDAO.read
      .mockResolvedValueOnce({
        _id: "q1",
        status: "aceptada",
        solicitud: "s1",
        user: { _id: "u1", email: "c@test.com" },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "en_produccion",
        user: { _id: "u1", email: "c@test.com" },
      });
    QuotationDAO.update.mockResolvedValue({});
    SolicitudDAO.update.mockResolvedValue({});

    await QuotationController.updateStatus(
      { params: { id: "q1" }, body: { status: "en_produccion" } },
      response,
    );

    expect(QuotationDAO.update).toHaveBeenCalledWith("q1", {
      status: "en_produccion",
    });
    expect(SolicitudDAO.update).toHaveBeenCalledWith("s1", {
      status: "en_produccion",
    });
    expect(NotificationService.notifyClientStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "q1" }),
      "aceptada",
      "en_produccion",
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("no notifica si el estado no cambia", async () => {
    const response = res();
    QuotationDAO.read
      .mockResolvedValueOnce({ _id: "q1", status: "completada" })
      .mockResolvedValueOnce({ _id: "q1", status: "completada" });
    QuotationDAO.update.mockResolvedValue({});

    await QuotationController.updateStatus(
      { params: { id: "q1" }, body: { status: "completada" } },
      response,
    );

    expect(NotificationService.notifyClientStatusChanged).not.toHaveBeenCalled();
  });

  it("maneja error del DAO", async () => {
    const response = res();
    QuotationDAO.read.mockRejectedValue(new Error("DB"));

    await QuotationController.updateStatus(
      { params: { id: "q1" }, body: { status: "en_produccion" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
  });
});

describe("QuotationController.respondQuotation (HU-29)", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    NotificationService.notifyAdminClientResponse.mockResolvedValue({});
    NotificationService.notifyClientResponseInChat.mockResolvedValue({});
    NotificationService.sendAcceptanceEmailToClient.mockResolvedValue({});
    NotificationService.notifyClientStatusChanged.mockResolvedValue({});
  });

  it("rechaza decisión inválida", async () => {
    const response = res();
    await QuotationController.respondQuotation(
      { params: { id: "q1" }, body: { decision: "otro" }, user: { id: "u1" } },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("rechaza si no es el dueño", async () => {
    const response = res();
    QuotationDAO.read.mockResolvedValue({
      _id: "q1",
      status: "cotizada",
      user: "u2",
      finalQuotation: { amount: 100000 },
    });

    await QuotationController.respondQuotation(
      { params: { id: "q1" }, body: { decision: "aceptada" }, user: { id: "u1" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(403);
  });

  it("acepta cotización con precio final", async () => {
    const response = res();
    QuotationDAO.read
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada",
        user: "u1",
        finalQuotation: { amount: 150000 },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "aceptada",
        user: "u1",
      });
    QuotationDAO.update.mockResolvedValue({});

    await QuotationController.respondQuotation(
      { params: { id: "q1" }, body: { decision: "aceptada" }, user: { id: "u1" } },
      response,
    );

    expect(QuotationDAO.update).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({ status: "aceptada" }),
    );
    expect(NotificationService.sendAcceptanceEmailToClient).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("propone nuevo precio y pasa a en_revision", async () => {
    const response = res();
    QuotationDAO.read
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada",
        user: "u1",
        finalQuotation: { amount: 150000 },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "en_revision",
        user: "u1",
      });
    QuotationDAO.update.mockResolvedValue({});

    await QuotationController.respondQuotation(
      {
        params: { id: "q1" },
        body: { decision: "propuesta", proposedAmount: 120000, notes: "Menos" },
        user: { id: "u1" },
      },
      response,
    );

    expect(QuotationDAO.update).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({
        status: "en_revision",
        clientResponse: expect.objectContaining({ proposedAmount: 120000 }),
      }),
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("rechaza cotización del cliente", async () => {
    const response = res();
    QuotationDAO.read
      .mockResolvedValueOnce({
        _id: "q1",
        status: "cotizada",
        user: "u1",
        finalQuotation: { amount: 150000 },
      })
      .mockResolvedValueOnce({
        _id: "q1",
        status: "rechazada",
        user: "u1",
      });
    QuotationDAO.update.mockResolvedValue({});

    await QuotationController.respondQuotation(
      {
        params: { id: "q1" },
        body: { decision: "rechazada", notes: "No me convence" },
        user: { id: "u1" },
      },
      response,
    );

    expect(QuotationDAO.update).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({ status: "rechazada" }),
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
