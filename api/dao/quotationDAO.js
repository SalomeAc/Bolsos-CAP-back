const Quotation = require("../models/quotation");
const GlobalDAO = require("./globalDAO");

class QuotationDAO extends GlobalDAO {
  constructor() {
    super(Quotation);
  }

  async findByUser(userId) {
    return this.model
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("product")
      .populate("solicitud")
      .populate("user", "_id firstName lastName email");
  }

  async findByStatus(status) {
    return this.model
      .find({ status })
      .sort({ createdAt: -1 })
      .populate("product")
      .populate("solicitud")
      .populate("user", "_id firstName lastName email");
  }

  async read(id) {
    return this.model
      .findById(id)
      .populate("product")
      .populate("solicitud")
      .populate("user", "_id firstName lastName email")
      .populate("finalQuotation.quotedBy", "_id firstName lastName email");
  }

  async getAll(filter = {}) {
    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("product")
      .populate("solicitud")
      .populate("user", "_id firstName lastName email");
  }
}

module.exports = new QuotationDAO();
