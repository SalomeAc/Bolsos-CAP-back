const GlobalDAO = require("./globalDAO");
const Message = require("../models/message");

class MessageDAO extends GlobalDAO {
  constructor() {
    super(Message);
  }

  _clientMessageFilter(includeAdminOnly) {
    if (includeAdminOnly) {
      return {};
    }

    return {
      audience: { $ne: "admin" },
      content: {
        $not: /^Propuesta de cotización generada por IA/m,
      },
    };
  }

  // Obtener todos los mensajes de una cotización ordenados por fecha
  async findByQuotation(quotationId, { includeAdminOnly = true } = {}) {
    const filter = {
      quotation: quotationId,
      ...this._clientMessageFilter(includeAdminOnly),
    };

    return await this.model
      .find(filter)
      .populate("sender", "firstName lastName email")
      .sort({ createdAt: 1 })
      .exec();
  }

  // Obtener los últimos N mensajes de una cotización
  async findLatestByQuotation(quotationId, limit = 50, { includeAdminOnly = true } = {}) {
    const filter = {
      quotation: quotationId,
      ...this._clientMessageFilter(includeAdminOnly),
    };

    return await this.model
      .find(filter)
      .populate("sender", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // Obtener mensajes enviados por un usuario
  async findBySender(senderId) {
    return await this.model
      .find({ sender: senderId })
      .populate("quotation", "kind status")
      .sort({ createdAt: -1 })
      .exec();
  }

  // Contar mensajes no leídos en una cotización
  async countByQuotation(quotationId) {
    return await this.model.countDocuments({ quotation: quotationId });
  }
}

module.exports = new MessageDAO();
