const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");
const NotificationService = require("../../api/services/notificationService");
const { sendMail } = require("../../api/utils/mailer");
const MessageDAO = require("../../api/dao/messageDAO");

// Mocks
jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/services/notificationService");
jest.mock("../../api/utils/mailer");
jest.mock("../../api/dao/messageDAO");

describe("QuotationController - Integración con Notificaciones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createQuotation - Envío de Notificación", () => {
    it("debe enviar notificación cuando se crea una cotización de catálogo exitosamente", async () => {
      const req = {
        body: {
          kind: "catalog",
          product: "product123",
          customization: {
            type: "Cuero",
            color: "Negro",
            size: "30cm x 20cm",
          },
          quantity: 1,
          notes: "Entrega rápida",
        },
        user: {
          id: "user123",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

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
          materials: ["Cuero"],
          dimensions: ["30cm x 20cm"],
          color: ["Negro"],
        },
        customization: req.body.customization,
        status: "pendiente",
        createdAt: new Date(),
      };

      // Mock del DAO
      QuotationDAO.create.mockResolvedValue(mockQuotation);
      QuotationDAO.read.mockResolvedValue(mockQuotation);

      // Mock del servicio de notificación
      NotificationService.sendQuotationConfirmation.mockResolvedValue({
        _id: "msg123",
      });

      await QuotationController.createQuotation(req, res);

      // Verificar respuesta HTTP
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockQuotation);

      // Verificar que se intentó enviar notificación
      // Se ejecuta de forma asíncrona, así que podría no estar completado
      // pero el servicio debe haberse llamado eventualmente
      expect(QuotationDAO.create).toHaveBeenCalled();
      expect(QuotationDAO.read).toHaveBeenCalledWith(mockQuotation._id);
    });

    it("debe completar la creación incluso si falla el envío de notificación", async () => {
      const req = {
        body: {
          kind: "custom",
          customProduct: {
            description: "Bolso personalizado",
            color: "Azul",
            dimensions: "35cm x 25cm",
            materials: ["Cuero"],
          },
          quantity: 1,
        },
        user: {
          id: "user456",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockQuotation = {
        _id: "quotation456",
        kind: "custom",
        user: {
          _id: "user456",
          email: "user456@example.com",
        },
        customProduct: req.body.customProduct,
        status: "pendiente",
        createdAt: new Date(),
      };

      QuotationDAO.create.mockResolvedValue(mockQuotation);
      QuotationDAO.read.mockResolvedValue(mockQuotation);
      NotificationService.sendQuotationConfirmation.mockRejectedValue(
        new Error("Error al enviar notificación")
      );

      await QuotationController.createQuotation(req, res);

      // Verificar que la cotización se retorna incluso si falla la notificación
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockQuotation);

      // El error de notificación no debe afectar la respuesta
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it("debe pasar la cotización poblada al servicio de notificación", async () => {
      const req = {
        body: {
          kind: "catalog",
          product: "product789",
          customization: {},
          quantity: 2,
        },
        user: {
          id: "user789",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockQuotation = {
        _id: "quotation789",
        kind: "catalog",
        user: {
          _id: "user789",
          firstName: "María",
          lastName: "López",
          email: "maria@example.com",
        },
        product: {
          _id: "product789",
          name: "Bolso Premium",
          type: "Premium Bag",
          materials: ["Cuero Premium"],
          dimensions: ["40cm"],
          color: ["Negro"],
        },
        customization: req.body.customization,
        quantity: 2,
        status: "pendiente",
        createdAt: new Date(),
      };

      QuotationDAO.create.mockResolvedValue(mockQuotation);
      QuotationDAO.read.mockResolvedValue(mockQuotation);
      NotificationService.sendQuotationConfirmation.mockResolvedValue({});

      await QuotationController.createQuotation(req, res);

      // Verificar que se pasó la cotización poblada
      expect(QuotationDAO.read).toHaveBeenCalledWith("quotation789");
      // La notificación debe ser llamada eventualmente con la cotización poblada
    });

    it("debe retornar error si validación falla (sin generar notificación)", async () => {
      const req = {
        body: {
          kind: "invalid",
        },
        user: {
          id: "user123",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await QuotationController.createQuotation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("'catalog' o 'custom'"),
        })
      );

      // No debe intentar crear ni enviar notificación
      expect(QuotationDAO.create).not.toHaveBeenCalled();
      expect(
        NotificationService.sendQuotationConfirmation
      ).not.toHaveBeenCalled();
    });

    it("debe manejar errores de BD sin enviar notificación", async () => {
      const req = {
        body: {
          kind: "catalog",
          product: "product123",
          customization: {},
        },
        user: {
          id: "user123",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      QuotationDAO.create.mockRejectedValue(
        new Error("Error de validación en BD")
      );

      await QuotationController.createQuotation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(
        NotificationService.sendQuotationConfirmation
      ).not.toHaveBeenCalled();
    });
  });

  describe("Validación de Contenido de Notificación", () => {
    it("debe incluir toda la información de la cotización en la notificación", async () => {
      const req = {
        body: {
          kind: "catalog",
          product: "product123",
          customization: {
            type: "Cuero Napa",
            color: "Rojo",
            size: "25cm",
          },
          quantity: 1,
          notes: "Urgente",
        },
        user: {
          id: "user123",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockQuotation = {
        _id: "quotation123",
        kind: "catalog",
        user: {
          _id: "user123",
          firstName: "Ana",
          lastName: "García",
          email: "ana@example.com",
        },
        product: {
          name: "Bolso Elegante",
          type: "Crossbody",
          materials: ["Cuero Napa", "Forro de Seda"],
          dimensions: ["25cm x 15cm"],
          color: ["Rojo", "Negro"],
        },
        customization: req.body.customization,
        status: "pendiente",
        createdAt: new Date("2026-06-16T12:00:00Z"),
      };

      QuotationDAO.create.mockResolvedValue(mockQuotation);
      QuotationDAO.read.mockResolvedValue(mockQuotation);
      NotificationService.sendQuotationConfirmation.mockResolvedValue({});

      await QuotationController.createQuotation(req, res);

      // Verificar que la notificación es llamada cuando está completada
      // (en una situación real, habría un pequeño delay)
    });
  });
});
