const NotificationService = require("../../api/services/notificationService");
const MessageDAO = require("../../api/dao/messageDAO");

jest.mock("../../api/dao/messageDAO");
jest.mock("../../api/dao/notificationDAO");
jest.mock("../../api/models/user", () => ({
  findOne: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue({ _id: "admin1", isAdmin: true }),
  }),
}));

describe("NotificationService sendQuotationConfirmation cotizar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MessageDAO.create.mockResolvedValue({ _id: "m1" });
  });

  it("envía confirmación desde formulario /cotizar con observaciones", async () => {
    const result = await NotificationService.sendQuotationConfirmation(
      {
        _id: "q1",
        kind: "custom",
        status: "pendiente",
        user: {
          _id: "u1",
          firstName: "Ana",
          lastName: "López",
          email: "ana@test.com",
        },
        customProduct: {
          description: "Bolso artesanal",
          color: "Rojo",
          materials: ["Lana"],
          dimensions: "20x15x10",
        },
        notes: "Urgente",
        createdAt: new Date("2026-01-15"),
      },
      {
        fromCotizarForm: true,
        observaciones: "Urgente",
        photoUrl: "https://cdn.example.com/ref.jpg",
      },
    );

    expect(result._id).toBe("m1");
    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Observaciones:"),
      }),
    );
  });
});
