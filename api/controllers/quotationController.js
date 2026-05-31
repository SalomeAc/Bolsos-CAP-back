const GlobalController = require("./globalController");
const QuotationDAO = require("../dao/quotationDAO");
const UserDAO = require("../dao/userDAO");

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
          .json({ message: "El tipo de cotización debe ser 'catalog' o 'custom'" });
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
            .json({ message: "Una cotización de catálogo requiere el producto" });
        }
        data.product = product;
        data.customization = customization;
      } else {
        data.customProduct = customProduct;
      }

      const quotation = await this.dao.create(data);
      return res.status(201).json(quotation);
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

      const quotationUserId = quotation.user?._id?.toString() || quotation.user?.toString() || quotation.user;
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

      return res.status(200).json(updated);
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
        .json({ message: err.message || "Error al guardar la propuesta de IA" });
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

      const quotationUserId = quotation.user?._id?.toString() || quotation.user?.toString() || quotation.user;
      const currentUserId = req.user.id?.toString() || req.user.id;
      
      if (quotationUserId !== currentUserId) {
        return res.status(403).json({ message: "No autorizado" });
      }

      if (quotation.status !== "cotizada") {
        return res.status(409).json({
          message: "Solo se puede responder una cotización en estado 'cotizada'",
        });
      }

      const updated = await this.dao.update(req.params.id, { status: decision });
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
        "en_revision",
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

      const updated = await this.dao.update(req.params.id, { status });
      return res.status(200).json(updated);
    } catch (err) {
      console.error("updateStatus error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al actualizar el estado" });
    }
  }

  async _isAdmin(userId) {
    const user = await UserDAO.read(userId);
    return !!(user && user.isAdmin);
  }
}

module.exports = new QuotationController();
