const NotificationService = require("../../api/services/notificationService");
const MessageDAO = require("../../api/dao/messageDAO");
const { sendMail } = require("../../api/utils/mailer");

// Mock de las dependencias
jest.mock("../../api/dao/messageDAO");
jest.mock("../../api/utils/mailer");
jest.mock("../../api/models/user", () => ({
  findOne: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue({ _id: "admin1", isAdmin: true }),
  }),
}));

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendQuotationConfirmation - Modalidad Catalog", () => {
    it("debe crear un mensaje del sistema con el contenido correcto", async () => {
      const mockQuotation = {
        _id: "quotation123",
        kind: "catalog",
        user: {
          _id: "user123",
          firstName: "Juan",
          lastName: "Pérez",
          email: "juan@example.com",
        },
        product: {
          _id: "product123",
          name: "Bolso Clásico",
          type: "Shoulder Bag",
          materials: ["Cuero", "Algodón"],
          dimensions: ["30cm x 20cm", "25cm x 15cm"],
          color: ["Negro", "Marrón"],
        },
        customization: {
          type: "Cuero Premium",
          color: "Negro",
          size: "30cm x 20cm",
        },
        status: "pendiente",
        createdAt: new Date("2026-06-16T10:00:00Z"),
      };

      MessageDAO.create.mockResolvedValue({
        _id: "msg123",
        quotation: mockQuotation._id,
        sender: mockQuotation.user._id,
        isSystemMessage: true,
        content: expect.stringContaining("Cotización registrada"),
      });

      sendMail.mockResolvedValue(true);

      await NotificationService.sendQuotationConfirmation(mockQuotation);

      // Verificar que se creó mensaje del sistema (remitente = admin del sistema)
      expect(MessageDAO.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quotation: mockQuotation._id,
          sender: "admin1",
          isSystemMessage: true,
          content: expect.stringContaining("Cotización Registrada Correctamente"),
        })
      );

      // Verificar que contiene datos del producto
      const callArgs = MessageDAO.create.mock.calls[0][0];
      expect(callArgs.content).toContain("Bolso Clásico");
      expect(callArgs.content).toContain("Shoulder Bag");
      expect(callArgs.content).toContain("Negro");
      expect(callArgs.content).toContain("Pendiente");
    });

    it("debe enviar email con plantilla HTML correcta", async () => {
      const mockQuotation = {
        _id: "quotation123",
        kind: "catalog",
        user: {
          _id: "user123",
          firstName: "María",
          lastName: "García",
          email: "maria@example.com",
        },
        product: {
          name: "Bolso Tote",
          type: "Tote Bag",
          materials: ["Lona"],
          dimensions: ["40cm x 30cm"],
          color: ["Rojo"],
        },
        customization: {
          type: "Lona",
          color: "Rojo",
          size: "40cm x 30cm",
        },
        status: "pendiente",
        createdAt: new Date("2026-06-16T14:30:00Z"),
      };

      MessageDAO.create.mockResolvedValue({
        _id: "msg123",
      });

      sendMail.mockResolvedValue(true);

      await NotificationService.sendQuotationConfirmation(mockQuotation);

      // Verificar que se envió email
      expect(sendMail).toHaveBeenCalledWith(
        "maria@example.com",
        "Cotización Registrada Correctamente",
        expect.stringContaining("Bolso Tote")
      );

      const emailHtml = sendMail.mock.calls[0][2];
      expect(emailHtml).toContain("Tote Bag");
      expect(emailHtml).toContain("Rojo");
      expect(emailHtml).toContain("Pendiente");
      expect(emailHtml).toContain("Cotización Registrada Correctamente");
    });

    it("debe asociar la notificación al usuario propietario", async () => {
      const mockQuotation = {
        _id: "quotation456",
        kind: "catalog",
        user: {
          _id: "user456",
          email: "usuario@example.com",
        },
        product: {
          name: "Bolso",
          type: "Bag",
          materials: [],
          dimensions: [],
          color: [],
        },
        customization: {},
        status: "pendiente",
        createdAt: new Date(),
      };

      MessageDAO.create.mockResolvedValue({});
      sendMail.mockResolvedValue(true);

      await NotificationService.sendQuotationConfirmation(mockQuotation);

      expect(MessageDAO.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: "admin1",
        })
      );
    });
  });

  describe("sendQuotationConfirmation - Modalidad Custom", () => {
    it("debe generar contenido correcto para cotización personalizada", async () => {
      const mockQuotation = {
        _id: "quotation789",
        kind: "custom",
        user: {
          _id: "user789",
          email: "custom@example.com",
        },
        customProduct: {
          description: "Bolso de diseño único",
          color: "Azul Marino",
          dimensions: "35cm x 25cm x 10cm",
          materials: ["Cuero Ecológico", "Forro de Lino"],
        },
        status: "pendiente",
        createdAt: new Date("2026-06-16T09:15:00Z"),
      };

      MessageDAO.create.mockResolvedValue({});
      sendMail.mockResolvedValue(true);

      await NotificationService.sendQuotationConfirmation(mockQuotation);

      const messageCall = MessageDAO.create.mock.calls[0][0];
      expect(messageCall.content).toContain("Personalizado");
      expect(messageCall.content).toContain("Bolso de diseño único");
      expect(messageCall.content).toContain("Azul Marino");
      expect(messageCall.content).toContain("Cuero Ecológico");
      expect(messageCall.content).toContain("Forro de Lino");

      const emailCall = sendMail.mock.calls[0][2];
      expect(emailCall).toContain("Personalizado");
      expect(emailCall).toContain("Azul Marino");
    });
  });

  describe("Validaciones y Manejo de Errores", () => {
    it("debe lanzar error si quotation no tiene usuario", async () => {
      const invalidQuotation = {
        _id: "quotation999",
        kind: "catalog",
        user: null,
        status: "pendiente",
      };

      await expect(
        NotificationService.sendQuotationConfirmation(invalidQuotation)
      ).rejects.toThrow();
    });

    it("debe lanzar error si usuario no tiene email", async () => {
      const invalidQuotation = {
        _id: "quotation999",
        kind: "catalog",
        user: {
          _id: "user999",
          email: null,
        },
        status: "pendiente",
      };

      await expect(
        NotificationService.sendQuotationConfirmation(invalidQuotation)
      ).rejects.toThrow();
    });

    it("debe lanzar error si la estructura de la cotización no es válida", async () => {
      const invalidQuotation = {
        _id: "quotation999",
        kind: "unknown",
        user: {
          _id: "user999",
          email: "test@example.com",
        },
        status: "pendiente",
      };

      MessageDAO.create.mockResolvedValue({});
      sendMail.mockResolvedValue(true);

      await expect(
        NotificationService.sendQuotationConfirmation(invalidQuotation)
      ).rejects.toThrow();
    });

    it("debe capturar errores de sendMail sin romper el flujo", async () => {
      const mockQuotation = {
        _id: "quotation999",
        kind: "catalog",
        user: {
          _id: "user999",
          email: "test@example.com",
        },
        product: {
          name: "Bolso",
          type: "Bag",
          materials: [],
          dimensions: [],
          color: [],
        },
        customization: {},
        status: "pendiente",
        createdAt: new Date(),
      };

      MessageDAO.create.mockResolvedValue({ _id: "msg999" });
      sendMail.mockRejectedValue(new Error("Error enviando email"));

      await expect(
        NotificationService.sendQuotationConfirmation(mockQuotation)
      ).rejects.toThrow("Error enviando email");
    });
  });

  describe("Formato de contenido", () => {
    it("debe incluir todas las propiedades de la plantilla en el mensaje", async () => {
      const mockQuotation = {
        _id: "quotation123",
        kind: "catalog",
        user: {
          _id: "user123",
          email: "test@example.com",
        },
        product: {
          name: "Bolso Test",
          type: "Test Type",
          materials: ["Material1", "Material2"],
          dimensions: ["10cm"],
          color: ["Red"],
        },
        customization: {
          type: "Custom Type",
          color: "Blue",
          size: "20cm",
        },
        status: "pendiente",
        createdAt: new Date(),
      };

      MessageDAO.create.mockResolvedValue({});
      sendMail.mockResolvedValue(true);

      await NotificationService.sendQuotationConfirmation(mockQuotation);

      const callArgs = MessageDAO.create.mock.calls[0][0];
      expect(callArgs.content).toContain("Tipo de bolso");
      expect(callArgs.content).toContain("Nombre del bolso");
      expect(callArgs.content).toContain("Material");
      expect(callArgs.content).toContain("Dimensiones");
      expect(callArgs.content).toContain("Color");
      expect(callArgs.content).toContain("Fecha de solicitud");
      expect(callArgs.content).toContain("Estado actual");
      expect(callArgs.content).toContain("Pendiente");
    });
  });
});
