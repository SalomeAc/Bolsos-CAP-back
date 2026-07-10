const NotificationService = require("../../api/services/notificationService");
const NotificationDAO = require("../../api/dao/notificationDAO");

jest.mock("../../api/dao/notificationDAO");
jest.mock("../../api/dao/messageDAO");
jest.mock("../../api/models/user", () => ({
  find: jest.fn(),
}));

const User = require("../../api/models/user");

describe("NotificationService notifyClientQuotationReceived branches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NotificationService._createSystemMessage = jest
      .fn()
      .mockResolvedValue({ _id: "m1" });
    NotificationService.notifyAdminFinalQuotationSent = jest
      .fn()
      .mockResolvedValue({ _id: "m2" });
  });

  it("crea notificación para catálogo con solicitud", async () => {
    NotificationDAO.create.mockResolvedValue({ _id: "n1" });

    const result = await NotificationService.notifyClientQuotationReceived(
      {
        _id: "q1",
        kind: "catalog",
        user: {
          _id: "u1",
          firstName: "Ana",
          email: "ana@test.com",
        },
        product: { name: "Bolso clásico" },
        quantity: 2,
        solicitud: { _id: "s1", code: "SOL-1" },
      },
      { _id: "s1", code: "SOL-1" },
    );

    expect(result._id).toBe("n1");
    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "confirmacion_cotizacion",
        metadata: expect.objectContaining({ productName: "Bolso clásico" }),
      }),
    );
  });

  it("notifyAdminAiQuotationReady maneja error de email sin fallar", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "admin1", email: "admin@test.com", isAdmin: true },
      ]),
    });
    NotificationDAO.create.mockResolvedValue({ _id: "n2" });
    NotificationService._adminAiProposalChatExists = jest
      .fn()
      .mockResolvedValue(false);
    NotificationService._sendAdminEmail = jest
      .fn()
      .mockRejectedValue(new Error("SMTP down"));
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
  });

  it("notifyClientQuotationSent envía oferta al cliente", async () => {
    const { sendMail } = require("../../api/utils/mailer");
    NotificationDAO.create.mockResolvedValue({ _id: "n1" });

    await NotificationService.notifyClientQuotationSent({
      _id: "q1",
      kind: "catalog",
      user: {
        _id: "u1",
        firstName: "Ana",
        email: "ana@test.com",
      },
      product: { name: "Bolso clásico" },
      finalQuotation: { amount: 180000, currency: "COP" },
    });

    expect(NotificationDAO.create).toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalled();
  });
});
