const QuotationController = require("../../api/controllers/quotationController");
const QuotationDAO = require("../../api/dao/quotationDAO");
const SolicitudDAO = require("../../api/dao/solicitudDAO");
const NotificationService = require("../../api/services/notificationService");
const ProductVariantService = require("../../api/services/productVariantService");

jest.mock("../../api/dao/quotationDAO");
jest.mock("../../api/dao/solicitudDAO");
jest.mock("../../api/services/notificationService");
jest.mock("../../api/services/productVariantService");

describe("QuotationController - Trazabilidad (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ProductVariantService.findVariantForQuotation.mockResolvedValue(null);
    NotificationService.notifyClientQuotationReceived.mockResolvedValue({});
    NotificationService.notifyClientQuotationSent.mockResolvedValue({});
  });

  describe("createQuotation - Asociación solicitud ↔ cotización", () => {
    it("debe crear solicitud y vincularla a la cotización", async () => {
      const req = {
        body: {
          kind: "catalog",
          product: "product123",
          customization: { type: "Cuero", color: "Negro", size: "30cm" },
          quantity: 1,
          notes: "Urgente",
        },
        user: { id: "user123" },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockSolicitud = { _id: "solicitud123", code: "SOL-123456" };
      const mockQuotation = {
        _id: "quotation123",
        solicitud: "solicitud123",
        status: "pendiente",
      };
      const populatedQuotation = {
        ...mockQuotation,
        user: { _id: "user123", email: "user@example.com" },
        product: { name: "Bolso" },
      };

      SolicitudDAO.create.mockResolvedValue(mockSolicitud);
      QuotationDAO.create.mockResolvedValue(mockQuotation);
      SolicitudDAO.update.mockResolvedValue({ ...mockSolicitud, quotation: "quotation123" });
      QuotationDAO.read.mockResolvedValue(populatedQuotation);
      SolicitudDAO.read.mockResolvedValue({ ...mockSolicitud, quotation: "quotation123" });
      NotificationService.sendQuotationConfirmation.mockResolvedValue({});
      NotificationService.notifyAdminNewRequest.mockResolvedValue([{}]);
      NotificationService.notifyClientQuotationReceived.mockResolvedValue({});

      await QuotationController.createQuotation(req, res);

      expect(SolicitudDAO.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: "user123",
          kind: "catalog",
          product: "product123",
          status: "pendiente",
        })
      );

      expect(QuotationDAO.create).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitud: "solicitud123",
          status: "pendiente",
        })
      );

      expect(SolicitudDAO.update).toHaveBeenCalledWith("solicitud123", {
        quotation: "quotation123",
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(populatedQuotation);
    });
  });

  describe("getTraceability", () => {
    it("debe retornar trazabilidad completa con integridad de datos", async () => {
      const req = { params: { id: "quotation123" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockQuotation = {
        _id: "quotation123",
        status: "cotizada",
        kind: "catalog",
        quantity: 1,
        createdAt: new Date("2026-06-16T10:00:00Z"),
        updatedAt: new Date("2026-06-17T10:00:00Z"),
        solicitud: "solicitud123",
        user: { _id: "user123", firstName: "Ana", lastName: "García" },
        product: { name: "Bolso Clásico" },
        finalQuotation: {
          amount: 150000,
          currency: "COP",
          quotedAt: new Date("2026-06-17T09:00:00Z"),
        },
      };

      const mockSolicitud = {
        _id: "solicitud123",
        code: "SOL-123456",
        status: "cotizada",
        createdAt: new Date("2026-06-16T10:00:00Z"),
        quotation: "quotation123",
      };

      QuotationDAO.read.mockResolvedValue(mockQuotation);
      SolicitudDAO.read.mockResolvedValue(mockSolicitud);

      await QuotationController.getTraceability(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitud: mockSolicitud,
          cotizacion: expect.objectContaining({
            _id: "quotation123",
            status: "cotizada",
          }),
          integridad: expect.objectContaining({
            solicitudVinculada: true,
            cotizacionVinculada: true,
            idsCoinciden: true,
          }),
          timeline: expect.arrayContaining([
            expect.objectContaining({ event: "solicitud_creada" }),
            expect.objectContaining({ event: "cotizacion_final" }),
          ]),
        })
      );
    });

    it("debe retornar 404 si la cotización no existe", async () => {
      const req = { params: { id: "inexistente" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      QuotationDAO.read.mockResolvedValue(null);

      await QuotationController.getTraceability(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("setFinalQuotation - Actualizar solicitud", () => {
    it("debe marcar la solicitud como cotizada al fijar cotización final", async () => {
      const req = {
        params: { id: "quotation123" },
        body: { amount: 200000, currency: "COP", notes: "Incluye envío" },
        user: { id: "admin1" },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      QuotationDAO.read
        .mockResolvedValueOnce({
          _id: "quotation123",
          solicitud: "solicitud123",
          status: "cotizada_ia",
        })
        .mockResolvedValueOnce({ _id: "quotation123", status: "cotizada" });

      QuotationDAO.update.mockResolvedValue({ _id: "quotation123", status: "cotizada" });
      QuotationDAO.unset.mockResolvedValue({});
      SolicitudDAO.update.mockResolvedValue({ _id: "solicitud123", status: "cotizada" });
      NotificationService.notifyClientQuotationSent.mockResolvedValue({});

      await QuotationController.setFinalQuotation(req, res);

      expect(SolicitudDAO.update).toHaveBeenCalledWith("solicitud123", {
        status: "cotizada",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
