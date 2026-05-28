const Quotation = require("../models/quotation");
const GlobalDAO = require("./globalDAO");

class QuotationDAO extends GlobalDAO {
  constructor() {
    super(Quotation);
  }

  async findByUser(userId) {
    return this.model.find({ user: userId }).sort({ createdAt: -1 });
  }

  async findByStatus(status) {
    return this.model.find({ status }).sort({ createdAt: -1 });
  }
}

module.exports = new QuotationDAO();
