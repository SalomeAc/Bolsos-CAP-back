const NotificationService = require("../../api/services/notificationService");
const NotificationDAO = require("../../api/dao/notificationDAO");
const { sendMail } = require("../../api/utils/mailer");

jest.mock("../../api/dao/notificationDAO");
jest.mock("../../api/utils/mailer");
jest.mock("../../api/models/user", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

const User = require("../../api/models/user");

describe("NotificationService - notifyAdminNewRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockQuotation = {
    _id: "quotation123",
    kind: "catalog",
    quantity: 2,
    createdAt: new Date("2026-06-16T10:00:00Z"),
    user: {
      _id: "user123",
      firstName: "Ana",
      lastName: "García",
      email: "ana@example.com",
    },
    product: { name: "Bolso Clásico" },
    solicitud: "solicitud123",
  };

  const mockSolicitud = {
    _id: "solicitud123",
    code: "SOL-123456",
  };

  it("debe crear notificación para cada administrador activo", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "admin1", email: "admin@example.com", isAdmin: true },
      ]),
    });

    NotificationDAO.create.mockResolvedValue({
      _id: "notif1",
      type: "nueva_solicitud",
      read: false,
    });
    sendMail.mockResolvedValue(true);

    const result = await NotificationService.notifyAdminNewRequest(
      mockQuotation,
      mockSolicitud
    );

    expect(result).toHaveLength(1);
    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "nueva_solicitud",
        quotation: "quotation123",
        solicitud: "solicitud123",
        recipient: "admin1",
        read: false,
        metadata: expect.objectContaining({
          clientName: "Ana García",
          productName: "Bolso Clásico",
          quantity: 2,
        }),
      })
    );
  });

  it("debe incluir datos básicos del pedido en el mensaje", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "admin1", email: "admin@example.com" },
      ]),
    });

    NotificationDAO.create.mockImplementation((data) =>
      Promise.resolve({ _id: "notif1", ...data })
    );
    sendMail.mockResolvedValue(true);

    await NotificationService.notifyAdminNewRequest(mockQuotation, mockSolicitud);

    expect(NotificationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Nueva solicitud de cotización",
        message: expect.stringMatching(/SOL-123456.*Bolso Clásico/s),
      })
    );
  });

  it("debe manejar ausencia de administradores sin lanzar error fatal", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const result = await NotificationService.notifyAdminNewRequest(mockQuotation);

    expect(result).toEqual([]);
    expect(NotificationDAO.create).not.toHaveBeenCalled();
  });

  it("debe continuar si falla el email pero la notificación en sistema se creó", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "admin1", email: "admin@example.com" },
      ]),
    });

    NotificationDAO.create.mockResolvedValue({ _id: "notif1" });
    sendMail.mockRejectedValue(new Error("SMTP error"));

    const result = await NotificationService.notifyAdminNewRequest(mockQuotation);

    expect(result).toHaveLength(1);
    expect(NotificationDAO.create).toHaveBeenCalled();
  });

  it("debe lanzar error si no hay cotización", async () => {
    await expect(
      NotificationService.notifyAdminNewRequest(null)
    ).rejects.toThrow("Cotización requerida");
  });
});
