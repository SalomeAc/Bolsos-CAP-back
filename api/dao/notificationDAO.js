const Notification = require("../models/notification");
const GlobalDAO = require("./globalDAO");

class NotificationDAO extends GlobalDAO {
  constructor() {
    super(Notification);
  }

  async findByRecipient(recipientId, { unreadOnly = false, limit = 50 } = {}) {
    const filter = { recipient: recipientId };
    if (unreadOnly) filter.read = false;

    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("quotation", "_id status kind createdAt")
      .populate("solicitud", "_id code status createdAt");
  }

  async countUnread(recipientId) {
    return this.model.countDocuments({ recipient: recipientId, read: false });
  }

  async markAsRead(id, recipientId) {
    return this.model.findOneAndUpdate(
      { _id: id, recipient: recipientId },
      { read: true },
      { new: true }
    );
  }

  async markAllAsRead(recipientId) {
    return this.model.updateMany(
      { recipient: recipientId, read: false },
      { read: true }
    );
  }

  async read(id) {
    return this.model
      .findById(id)
      .populate("quotation")
      .populate("solicitud")
      .populate("recipient", "_id firstName lastName email");
  }
}

module.exports = new NotificationDAO();
