const NotificationService = require("../../api/services/notificationService");
const MessageDAO = require("../../api/dao/messageDAO");
const { sendMail } = require("../../api/utils/mailer");

jest.mock("../../api/dao/notificationDAO");
jest.mock("../../api/dao/messageDAO");
jest.mock("../../api/models/user", () => ({
  findOne: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue({ _id: "admin1", isAdmin: true }),
  }),
}));

describe("NotificationService chat and email", () => {
  const baseQuotation = {
    _id: "q1",
    kind: "custom",
    user: {
      _id: "u1",
      firstName: "Ana",
      lastName: "López",
      email: "ana@test.com",
    },
    customProduct: { description: "Bolso artesanal" },
    finalQuotation: { amount: 150000, currency: "COP" },
    status: "aceptada",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MessageDAO.create.mockResolvedValue({ _id: "m1" });
  });

  it("notifyClientResponseInChat registra rechazo", async () => {
    const result = await NotificationService.notifyClientResponseInChat(
      baseQuotation,
      "rechazada",
    );

    expect(MessageDAO.create).toHaveBeenCalled();
    expect(result._id).toBe("m1");
  });

  it("notifyClientResponseInChat registra propuesta de precio", async () => {
    await NotificationService.notifyClientResponseInChat(
      {
        ...baseQuotation,
        clientResponse: { proposedAmount: 120000, currency: "COP" },
      },
      "propuesta",
    );

    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("120"),
      }),
    );
  });

  it("sendAcceptanceEmailToClient envía correo", async () => {
    await NotificationService.sendAcceptanceEmailToClient(baseQuotation);

    expect(sendMail).toHaveBeenCalledWith(
      "ana@test.com",
      "Confirmación de pedido aceptado",
      expect.stringContaining("Bolso artesanal"),
    );
  });

  it("sendAcceptanceEmailToClient falla sin email", async () => {
    await expect(
      NotificationService.sendAcceptanceEmailToClient({
        ...baseQuotation,
        user: { firstName: "Ana" },
      }),
    ).rejects.toThrow("Cotización debe tener usuario con email");
  });
});
