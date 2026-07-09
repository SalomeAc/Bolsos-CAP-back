const NotificationService = require("../../api/services/notificationService");
const NotificationDAO = require("../../api/dao/notificationDAO");
const MessageDAO = require("../../api/dao/messageDAO");

jest.mock("../../api/dao/notificationDAO");
jest.mock("../../api/dao/messageDAO");
jest.mock("../../api/models/user", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

describe("NotificationService status and admin final", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    NotificationService._createSystemMessage = jest
      .fn()
      .mockResolvedValue({ _id: "m1" });
    NotificationService._sendAdminEmail = jest.fn().mockResolvedValue({});
  });

  it("notifyClientStatusChanged crea notificación de producción", async () => {
    NotificationDAO.create.mockResolvedValue({ _id: "n1" });

    const result = await NotificationService.notifyClientStatusChanged(
      {
        _id: "q1",
        kind: "custom",
        user: { _id: "u1", firstName: "Ana" },
        customProduct: { description: "Bolso" },
      },
      "aceptada",
      "en_produccion",
    );

    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cambio_estado",
        recipient: "u1",
      }),
    );
    expect(result._id).toBe("n1");
  });

  it("notifyClientStatusChanged retorna null sin destinatario", async () => {
    const result = await NotificationService.notifyClientStatusChanged(
      { _id: "q1", kind: "catalog", product: { name: "Bolso" } },
      "aceptada",
      "completada",
    );
    expect(result).toBeNull();
  });

  it("notifyAdminFinalQuotationSent notifica admins", async () => {
    const User = require("../../api/models/user");
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "admin1", email: "admin@test.com" },
      ]),
    });
    NotificationDAO.create.mockResolvedValue({ _id: "n2" });

    const result = await NotificationService.notifyAdminFinalQuotationSent({
      _id: "q1",
      kind: "catalog",
      user: { _id: "u1", firstName: "Ana", lastName: "López" },
      product: { name: "Bolso clásico" },
      finalQuotation: { amount: 200000, currency: "COP" },
    });

    expect(result).toEqual(expect.objectContaining({ _id: "m1" }));
    expect(NotificationService._createSystemMessage).toHaveBeenCalled();
  });
});
