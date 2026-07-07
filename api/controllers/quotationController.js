const GlobalController = require("./globalController");
const QuotationDAO = require("../dao/quotationDAO");
const SolicitudDAO = require("../dao/solicitudDAO");
const UserDAO = require("../dao/userDAO");
const NotificationService = require("../services/notificationService");
const CloudinaryService = require("../services/cloudinaryService");

class QuotationController extends GlobalController {
  constructor() {
    super(QuotationDAO);
  }

  // --- Cliente: crear cotización (catálogo o personalizada) ---
  async createQuotation(req, res) {
    try {
      const { kind, product, customization, customProduct, quantity, notes } =
        req.body;

      if (!kind || !["catalog", "custom"].includes(kind)) {
        return res
          .status(400)
          .json({
            message: "El tipo de cotización debe ser 'catalog' o 'custom'",
          });
      }

      const data = {
        kind,
        user: req.user.id,
        quantity,
        notes,
        status: "pendiente",
      };

      if (kind === "catalog") {
        if (!product) {
          return res
            .status(400)
            .json({
              message: "Una cotización de catálogo requiere el producto",
            });
        }
        data.product = product;
        data.customization = customization;
      } else {
        data.customProduct = customProduct;
      }

      // HU2: crear solicitud y asociarla a la cotización
      const solicitudData = {
        user: req.user.id,
        kind,
        quantity: quantity || 1,
        notes,
        status: "pendiente",
      };

      if (kind === "catalog") {
        solicitudData.product = product;
        solicitudData.customization = customization;
      } else {
        solicitudData.customProduct = customProduct;
      }

      const solicitud = await SolicitudDAO.create(solicitudData);
      data.solicitud = solicitud._id;

      const quotation = await this.dao.create(data);

      // Vincular cotización en la solicitud (integridad bidireccional)
      await SolicitudDAO.update(solicitud._id, { quotation: quotation._id });

      // Poblar cotización con datos necesarios para la notificación
      const populatedQuotation = await this.dao.read(quotation._id);
      const populatedSolicitud = await SolicitudDAO.read(solicitud._id);

      // Enviar notificaciones (asíncrono, no bloquea)
      this._sendNotificationAsync(populatedQuotation, {
        solicitud: populatedSolicitud,
      }).catch((err) => {
        console.error("Error enviando notificaciones de cotización:", err);
      });

      return res.status(201).json(populatedQuotation);
    } catch (err) {
      if (err.name === "ValidationError") {
        const firstMessage = Object.values(err.errors)[0].message;
        return res.status(400).json({ message: firstMessage });
      }
      console.error("createQuotation error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al crear la cotización" });
    }
  }

  // --- Cliente: formulario de cotización personalizada (multipart + foto) ---
  async createCustomQuotationFromForm(req, res) {
    try {
      const dimensions = req.body.dimensions?.trim();
      const color = req.body.color?.trim();
      const material = req.body.material?.trim();
      const observaciones = req.body.observaciones?.trim() || "";

      if (!dimensions || !color || !material) {
        return res.status(400).json({
          message: "Dimensiones, color y material son obligatorios",
        });
      }

      let photoUrl = null;

      if (req.file) {
        const uploadResult = await CloudinaryService.uploadImageBuffer(
          req.file.buffer,
        );
        photoUrl = uploadResult.url;
      }

      const customProduct = {
        description: `Bolso personalizado en ${material}`,
        color,
        dimensions,
        materials: [material],
        ...(photoUrl ? { photo: photoUrl } : {}),
      };

      const solicitudData = {
        user: req.user.id,
        kind: "custom",
        quantity: 1,
        notes: observaciones || undefined,
        status: "pendiente",
        customProduct,
      };

      const solicitud = await SolicitudDAO.create(solicitudData);

      const quotationData = {
        kind: "custom",
        user: req.user.id,
        quantity: 1,
        notes: observaciones || undefined,
        status: "pendiente",
        solicitud: solicitud._id,
        customProduct,
      };

      const quotation = await this.dao.create(quotationData);
      await SolicitudDAO.update(solicitud._id, { quotation: quotation._id });

      const populatedQuotation = await this.dao.read(quotation._id);
      const populatedSolicitud = await SolicitudDAO.read(solicitud._id);

      this._sendNotificationAsync(populatedQuotation, {
        solicitud: populatedSolicitud,
        options: {
          fromCotizarForm: true,
          observaciones,
          photoUrl,
        },
      }).catch((err) => {
        console.error("Error enviando notificaciones de cotización:", err);
      });

      return res.status(201).json(populatedQuotation);
    } catch (err) {
      if (err.name === "ValidationError") {
        const firstMessage = Object.values(err.errors)[0].message;
        return res.status(400).json({ message: firstMessage });
      }

      console.error("createCustomQuotationFromForm error:", err);
      return res.status(400).json({
        message: err.message || "Error al procesar la cotización",
      });
    }
  }

  /**
   * Envía notificaciones de forma asíncrona (cliente + admin)
   * @param {Object} quotation - Cotización poblada
   * @param {Object} [context={}] - solicitud (HU2) y/o options del formulario /cotizar
   * @private
   */
  async _sendNotificationAsync(
    quotation,
    { solicitud = null, options = {} } = {},
  ) {
    try {
      await NotificationService.sendQuotationConfirmation(quotation, options);
      await NotificationService.notifyClientQuotationReceived(
        quotation,
        solicitud,
      );
      await NotificationService.notifyAdminNewRequest(quotation, solicitud);
      console.log(
        `[QUOTATION] ✓ Notificaciones completadas para cotización ${quotation._id}`,
      );
    } catch (err) {
      console.error(
        `[QUOTATION] ⚠️ Error en notificaciones para cotización ${quotation._id}:`,
        err.message,
      );
    }
  }

  // --- Cliente: listar mis cotizaciones ---
  async getMyQuotations(req, res) {
    try {
      const quotations = await this.dao.findByUser(req.user.id);
      return res.status(200).json(quotations);
    } catch (err) {
      console.error("getMyQuotations error:", err);
      return res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

  // --- Dueño o admin: detalle ---
  async getQuotation(req, res) {
    try {
      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const quotationUserId =
        quotation.user?._id?.toString() ||
        quotation.user?.toString() ||
        quotation.user;
      const currentUserId = req.user.id?.toString() || req.user.id;
      const isOwner = quotationUserId === currentUserId;
      const isAdmin = req.user.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "No autorizado" });
      }

      return res.status(200).json(quotation);
    } catch (err) {
      console.error("getQuotation error:", err);
      return res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

  // --- Admin: fijar la cotización final y enviarla al cliente ---
  async setFinalQuotation(req, res) {
    try {
      const { amount, currency, notes } = req.body;

      if (amount == null) {
        return res
          .status(400)
          .json({ message: "El monto de la cotización es requerido" });
      }

      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const updated = await this.dao.update(req.params.id, {
        finalQuotation: {
          amount,
          currency: currency || "COP",
          notes,
          quotedBy: req.user.id,
          quotedAt: new Date(),
        },
        status: "cotizada",
      });

      // HU2: actualizar estado de la solicitud asociada
      if (quotation.solicitud) {
        const solicitudId =
          quotation.solicitud?._id?.toString() ||
          quotation.solicitud?.toString() ||
          quotation.solicitud;
        await SolicitudDAO.update(solicitudId, { status: "cotizada" });
      }

      const populated = await this.dao.read(req.params.id);
      return res.status(200).json(populated);
    } catch (err) {
      console.error("setFinalQuotation error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al cotizar" });
    }
  }

  // --- Admin: guardar propuesta de IA (fase 4: por ahora almacena lo recibido) ---
  async setAiQuotation(req, res) {
    try {
      const { amount, currency, breakdown, model } = req.body;

      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const updated = await this.dao.update(req.params.id, {
        aiQuotation: {
          amount,
          currency: currency || "COP",
          breakdown,
          model,
          generatedAt: new Date(),
        },
        status: "cotizada_ia",
      });

      return res.status(200).json(updated);
    } catch (err) {
      console.error("setAiQuotation error:", err);
      return res
        .status(400)
        .json({
          message: err.message || "Error al guardar la propuesta de IA",
        });
    }
  }

  // --- Cliente: aceptar o rechazar la cotización ---
  async respondQuotation(req, res) {
    try {
      const { decision } = req.body; // "aceptada" | "rechazada"

      if (!["aceptada", "rechazada"].includes(decision)) {
        return res
          .status(400)
          .json({ message: "La decisión debe ser 'aceptada' o 'rechazada'" });
      }

      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const quotationUserId =
        quotation.user?._id?.toString() ||
        quotation.user?.toString() ||
        quotation.user;
      const currentUserId = req.user.id?.toString() || req.user.id;

      if (quotationUserId !== currentUserId) {
        return res.status(403).json({ message: "No autorizado" });
      }

      if (quotation.status !== "cotizada") {
        return res.status(409).json({
          message:
            "Solo se puede responder una cotización en estado 'cotizada'",
        });
      }

      const updated = await this.dao.update(req.params.id, {
        status: decision,
      });
      return res.status(200).json(updated);
    } catch (err) {
      console.error("respondQuotation error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al responder la cotización" });
    }
  }

  // --- Admin: avanzar el estado (revisión/producción) ---
  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const allowed = [
        "pendiente",
        "cotizada_ia",
        "en_revision",
        "cotizada",
        "aceptada",
        "rechazada",
        "en_produccion",
        "completada",
        "cancelada",
      ];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: `Estado no permitido. Use uno de: ${allowed.join(", ")}`,
        });
      }

      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const previousStatus = quotation.status;
      const updated = await this.dao.update(req.params.id, { status });
      const populatedQuotation = await this.dao.read(req.params.id);

      if (previousStatus !== status) {
        if (quotation.solicitud) {
          const solicitudId =
            quotation.solicitud?._id?.toString() ||
            quotation.solicitud?.toString() ||
            quotation.solicitud;
          await SolicitudDAO.update(solicitudId, { status });
        }

        await NotificationService.notifyClientStatusChanged(
          populatedQuotation,
          previousStatus,
          status,
        );
      }

      return res.status(200).json(populatedQuotation);
    } catch (err) {
      console.error("updateStatus error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al actualizar el estado" });
    }
  }

  // --- Admin: consultar trazabilidad solicitud ↔ cotización ---
  async getTraceability(req, res) {
    try {
      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      let solicitud = null;
      if (quotation.solicitud) {
        const solicitudId =
          quotation.solicitud?._id?.toString() ||
          quotation.solicitud?.toString() ||
          quotation.solicitud;
        solicitud = await SolicitudDAO.read(solicitudId);
      } else {
        solicitud = await SolicitudDAO.findByQuotation(req.params.id);
      }

      const timeline = this._buildTraceabilityTimeline(quotation, solicitud);

      return res.status(200).json({
        solicitud,
        cotizacion: {
          _id: quotation._id,
          status: quotation.status,
          kind: quotation.kind,
          quantity: quotation.quantity,
          notes: quotation.notes,
          aiQuotation: quotation.aiQuotation,
          finalQuotation: quotation.finalQuotation,
          createdAt: quotation.createdAt,
          updatedAt: quotation.updatedAt,
        },
        cliente: quotation.user,
        producto: quotation.product,
        timeline,
        integridad: {
          solicitudVinculada: !!solicitud,
          cotizacionVinculada: !!solicitud?.quotation,
          idsCoinciden:
            solicitud?.quotation?.toString() === quotation._id.toString() ||
            solicitud?.quotation?._id?.toString() === quotation._id.toString(),
        },
      });
    } catch (err) {
      console.error("getTraceability error:", err);
      return res
        .status(500)
        .json({ message: "Error al consultar trazabilidad" });
    }
  }

  _buildTraceabilityTimeline(quotation, solicitud) {
    const timeline = [];

    if (solicitud?.createdAt) {
      timeline.push({
        event: "solicitud_creada",
        date: solicitud.createdAt,
        description:
          `Solicitud ${solicitud.code || ""} registrada por el cliente`.trim(),
      });
    } else if (quotation.createdAt) {
      timeline.push({
        event: "solicitud_creada",
        date: quotation.createdAt,
        description: "Solicitud registrada por el cliente",
      });
    }

    if (quotation.aiQuotation?.generatedAt) {
      timeline.push({
        event: "cotizacion_ia",
        date: quotation.aiQuotation.generatedAt,
        description: "Propuesta de cotización generada por IA",
      });
    }

    if (quotation.finalQuotation?.quotedAt) {
      timeline.push({
        event: "cotizacion_final",
        date: quotation.finalQuotation.quotedAt,
        description: "Cotización final enviada por la administradora",
      });
    }

    if (quotation.status === "aceptada") {
      timeline.push({
        event: "aceptada",
        date: quotation.updatedAt,
        description: "Cotización aceptada por el cliente",
      });
    }

    if (quotation.status === "rechazada") {
      timeline.push({
        event: "rechazada",
        date: quotation.updatedAt,
        description: "Cotización rechazada por el cliente",
      });
    }

    if (
      ["en_produccion", "completada", "cancelada"].includes(quotation.status)
    ) {
      timeline.push({
        event: quotation.status,
        date: quotation.updatedAt,
        description: `Estado actualizado a: ${quotation.status}`,
      });
    }

    return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async _isAdmin(userId) {
    const user = await UserDAO.read(userId);
    return !!(user && user.isAdmin);
  }
}

module.exports = new QuotationController();
