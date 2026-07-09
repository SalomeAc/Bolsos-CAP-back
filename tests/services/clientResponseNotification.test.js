const NotificationService = require("../../api/services/notificationService");
const MessageDAO = require("../../api/dao/messageDAO");
const NotificationDAO = require("../../api/dao/notificationDAO");

jest.mock("../../api/dao/messageDAO");
jest.mock("../../api/dao/notificationDAO");
jest.mock("../../api/utils/mailer", () => ({
  sendMail: jest.fn().mockResolvedValue({}),
}));
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

describe("NotificationService client response", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MessageDAO.create.mockResolvedValue({ _id: "msg1" });
    NotificationDAO.create.mockResolvedValue({ _id: "notif1" });
  });

  it("envía agradecimiento al cliente y aviso a la admin cuando acepta", async () => {
    const quotation = {
      _id: "q1",
      kind: "custom",
      user: { _id: "u1", firstName: "Ana", lastName: "López" },
      finalQuotation: { amount: 150000, currency: "COP" },
    };

    await NotificationService.notifyClientResponseInChat(quotation, "aceptada");

    expect(MessageDAO.create).toHaveBeenCalledTimes(2);
    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quotation: "q1",
        isSystemMessage: true,
        audience: "client",
        content: expect.stringContaining("Muchas gracias por aceptar"),
      }),
    );
    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quotation: "q1",
        isSystemMessage: true,
        audience: "admin",
        content: expect.stringContaining("aceptó la cotización"),
      }),
    );
  });

  it("envía mensaje de agradecimiento al cliente y aviso a la admin cuando rechaza", async () => {
    const quotation = {
      _id: "q1",
      kind: "custom",
      user: { _id: "u1", firstName: "Ana", lastName: "López" },
      customProduct: { description: "Bolso personalizado" },
      finalQuotation: { amount: 150000, currency: "COP" },
    };

    await NotificationService.notifyClientResponseInChat(quotation, "rechazada");

    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "client",
        content: expect.stringContaining("Gracias por tu respuesta"),
      }),
    );
    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "admin",
        content: expect.stringContaining("rechazó la cotización"),
      }),
    );
  });

  it("notifica en chat, campana y correo cuando el cliente decide", async () => {
    const { sendMail } = require("../../api/utils/mailer");
    const quotation = {
      _id: "q1",
      kind: "catalog",
      user: {
        _id: "u1",
        firstName: "Ana",
        lastName: "López",
        email: "ana@test.com",
      },
      product: { name: "Bolso Luna" },
      finalQuotation: { amount: 150000, currency: "COP" },
    };

    await NotificationService.notifyClientQuotationDecision(quotation, "aceptada");

    expect(MessageDAO.create).toHaveBeenCalledTimes(2);
    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: "u1",
        title: "¡Muchas gracias por tu pedido!",
      }),
    );
    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: "admin1",
        title: "El cliente aceptó la cotización",
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      "ana@test.com",
      expect.stringContaining("Muchas gracias"),
      expect.any(String),
    );
  });

  it("notifica en chat, campana y correo para cotización personalizada (IA)", async () => {
    const { sendMail } = require("../../api/utils/mailer");
    const quotation = {
      _id: "q2",
      kind: "custom",
      user: {
        _id: "u2",
        firstName: "Carlos",
        lastName: "Ruiz",
        email: "carlos@test.com",
      },
      customProduct: { description: "Bolso personalizado en cuero" },
      finalQuotation: { amount: 280000, currency: "COP" },
    };

    await NotificationService.notifyClientQuotationDecision(quotation, "rechazada");

    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "client",
        content: expect.stringContaining("Bolso personalizado en cuero"),
      }),
    );
    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "admin",
        content: expect.stringContaining("Carlos Ruiz rechazó la cotización"),
      }),
    );
    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: "u2",
        title: "Respuesta registrada",
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      "carlos@test.com",
      "Respuesta registrada",
      expect.stringContaining("Bolso personalizado en cuero"),
    );
  });

  it("notifica a la admin cuando el cliente rechaza", async () => {
    const quotation = {
      _id: "q1",
      kind: "catalog",
      user: {
        _id: "u1",
        firstName: "Ana",
        lastName: "López",
        email: "ana@test.com",
      },
      product: { name: "Bolso Luna" },
      finalQuotation: { amount: 150000, currency: "COP" },
      clientResponse: { decision: "rechazada" },
    };

    const notifications = await NotificationService.notifyAdminClientResponse(
      quotation,
      { decision: "rechazada" },
    );

    expect(notifications).toHaveLength(1);
    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "respuesta_cliente",
        title: "El cliente rechazó la cotización",
      }),
    );
  });
});

describe("NotificationService notifyClientQuotationSent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MessageDAO.create.mockResolvedValue({ _id: "msg1" });
    NotificationDAO.create.mockResolvedValue({ _id: "notif1" });
  });

  it("envía oferta con botones solo al cliente y aviso distinto a la admin", async () => {
    const quotation = {
      _id: "q1",
      kind: "catalog",
      user: {
        _id: "u1",
        firstName: "Ana",
        lastName: "López",
        email: "ana@test.com",
      },
      product: { name: "Bolso Luna" },
      finalQuotation: { amount: 150000, currency: "COP" },
    };

    await NotificationService.notifyClientQuotationSent(quotation);

    expect(MessageDAO.create).toHaveBeenCalledTimes(2);
    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quotation: "q1",
        isSystemMessage: true,
        audience: "client",
        messageType: "quotation_offer",
        content: expect.stringContaining("¿La aceptas?"),
      }),
    );
    expect(MessageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quotation: "q1",
        isSystemMessage: true,
        audience: "admin",
        content: expect.stringContaining("ha recibido la cotización"),
      }),
    );
    expect(MessageDAO.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "all",
      }),
    );
  });
});
