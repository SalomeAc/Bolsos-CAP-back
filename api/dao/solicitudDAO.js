const Solicitud = require("../models/solicitud");
const GlobalDAO = require("./globalDAO");

class SolicitudDAO extends GlobalDAO {
  constructor() {
    super(Solicitud);
  }

  async read(id) {
    return this.model
      .findById(id)
      .populate("product")
      .populate("user", "_id firstName lastName email")
      .populate("quotation");
  }

  async findByQuotation(quotationId) {
    return this.model
      .findOne({ quotation: quotationId })
      .populate("product")
      .populate("user", "_id firstName lastName email")
      .populate("quotation");
  }

  async getAll(filter = {}) {
    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("product")
      .populate("user", "_id firstName lastName email")
      .populate("quotation");
  }
}

module.exports = new SolicitudDAO();
