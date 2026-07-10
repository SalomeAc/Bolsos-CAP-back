const NotificationService = require("../../api/services/notificationService");
const NotificationDAO = require("../../api/dao/notificationDAO");

jest.mock("../../api/dao/notificationDAO");
jest.mock("../../api/dao/messageDAO");
jest.mock("../../api/models/user", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

const User = require("../../api/models/user");

describe("NotificationService branches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NotificationService._createSystemMessage = jest
      .fn()
      .mockResolvedValue({ _id: "m1" });
    NotificationService._sendAdminEmail = jest.fn().mockResolvedValue({});
  });

  it("notifyAdminClientResponse retorna vacío sin admins", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const result = await NotificationService.notifyAdminClientResponse(
      {
        _id: "q1",
        user: { firstName: "Ana" },
        customProduct: { description: "Bolso" },
      },
      { decision: "aceptada" },
    );

    expect(result).toEqual([]);
  });

  it("notifyAdminClientResponse notifica admins activos", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "admin1", email: "admin@test.com", isAdmin: true },
      ]),
    });
    NotificationDAO.create.mockResolvedValue({ _id: "n1" });

    const result = await NotificationService.notifyAdminClientResponse(
      {
        _id: "q1",
        user: { firstName: "Ana", lastName: "López" },
        customProduct: { description: "Bolso" },
      },
      { decision: "rechazada", notes: "Muy caro" },
    );

    expect(result).toHaveLength(1);
    expect(NotificationDAO.create).toHaveBeenCalled();
  });

  it("notifyClientQuotationReceived retorna null sin usuario", async () => {
    const result = await NotificationService.notifyClientQuotationReceived({
      _id: "q1",
      kind: "custom",
      user: null,
    });
    expect(result).toBeNull();
  });

  it("notifyAdminCatalogAutoQuoteSkipped retorna vacío sin admins", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const result = await NotificationService.notifyAdminCatalogAutoQuoteSkipped(
      { _id: "q1", user: { firstName: "Ana" }, product: { name: "Bolso" } },
      { code: "SOL-1" },
      { reason: "no_variant" },
    );

    expect(result).toEqual([]);
  });
});
