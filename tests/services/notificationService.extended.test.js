const NotificationService = require("../../api/services/notificationService");
const NotificationDAO = require("../../api/dao/notificationDAO");
const MessageDAO = require("../../api/dao/messageDAO");

jest.mock("../../api/dao/notificationDAO");
jest.mock("../../api/dao/messageDAO");
jest.mock("../../api/models/user", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

const User = require("../../api/models/user");

describe("NotificationService extended", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("notifyClientQuotationReceived crea notificación", async () => {
    NotificationDAO.create.mockResolvedValue({ _id: "n1" });

    const result = await NotificationService.notifyClientQuotationReceived(
      {
        _id: "q1",
        kind: "custom",
        user: {
          _id: "u1",
          firstName: "Ana",
          lastName: "López",
          email: "ana@test.com",
        },
        customProduct: { description: "Bolso custom" },
        quantity: 1,
      },
      { _id: "s1", code: "SOL-001" },
    );

    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "confirmacion_cotizacion",
        recipient: "u1",
      }),
    );
    expect(result._id).toBe("n1");
  });

  it("notifyAdminAiQuotationReady notifica admins", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "admin1", email: "admin@test.com", isAdmin: true },
      ]),
    });
    NotificationDAO.create.mockResolvedValue({ _id: "n2" });
    MessageDAO.create = jest.fn().mockResolvedValue({ _id: "m1" });
    NotificationService._adminAiProposalChatExists = jest
      .fn()
      .mockResolvedValue(false);
    NotificationService._sendAdminEmail = jest.fn().mockResolvedValue({});
    NotificationService._createSystemMessage = jest
      .fn()
      .mockResolvedValue({ _id: "m1" });

    const notifications = await NotificationService.notifyAdminAiQuotationReady({
      _id: "q1",
      kind: "custom",
      user: { firstName: "Ana", email: "ana@test.com" },
      customProduct: { description: "Bolso" },
      solicitud: { code: "SOL-1" },
      aiQuotation: {
        amount: 180000,
        currency: "COP",
        breakdown: "Material premium",
      },
    });

    expect(notifications).toHaveLength(1);
    expect(NotificationService._createSystemMessage).toHaveBeenCalled();
  });

  it("notifyAdminAiQuotationReady retorna vacío sin monto IA", async () => {
    const result = await NotificationService.notifyAdminAiQuotationReady({
      _id: "q1",
      aiQuotation: {},
    });
    expect(result).toEqual([]);
  });

  it("notifyAdminCatalogAutoQuoteSkipped notifica admins", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "admin1", email: "admin@test.com" },
      ]),
    });
    NotificationDAO.create.mockResolvedValue({ _id: "n3" });
    NotificationService._createSystemMessage = jest
      .fn()
      .mockResolvedValue({ _id: "m1" });

    const notifications = await NotificationService.notifyAdminCatalogAutoQuoteSkipped(
      {
        _id: "q1",
        kind: "catalog",
        user: { firstName: "Ana", lastName: "López" },
        product: { name: "Bolso clásico" },
        quantity: 2,
      },
      { _id: "s1", code: "SOL-99" },
      {
        reason: "zero_price",
        lookupSpecs: { color: "Rojo", material: "Lana", dimensions: "20x15" },
        totalPrice: 0,
      },
    );

    expect(notifications).toHaveLength(1);
    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cotizacion_auto_pendiente" }),
    );
  });

  it("notifyAdminCatalogAutoQuoteSkipped retorna vacío sin datos", async () => {
    const result = await NotificationService.notifyAdminCatalogAutoQuoteSkipped(
      null,
      null,
      {},
    );
    expect(result).toEqual([]);
  });
});
