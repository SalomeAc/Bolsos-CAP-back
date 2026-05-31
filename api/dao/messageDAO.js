const GlobalDAO = require("./globalDAO");
const Message = require("../models/message");

class MessageDAO extends GlobalDAO {
  constructor() {
    super(Message);
  }

  // Obtener todos los mensajes de una cotización ordenados por fecha
  async findByQuotation(quotationId) {
    return await this.model
      .find({ quotation: quotationId })
      .populate("sender", "firstName lastName email")
      .sort({ createdAt: 1 })
      .exec();
  }

  // Obtener los últimos N mensajes de una cotización
  async findLatestByQuotation(quotationId, limit = 50) {
    return await this.model
      .find({ quotation: quotationId })
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
