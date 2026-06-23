const NotificationDAO = require("../dao/notificationDAO");

class NotificationController {
  async getMyNotifications(req, res) {
    try {
      const unreadOnly = req.query.unread === "true";
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

      const notifications = await NotificationDAO.findByRecipient(req.user.id, {
        unreadOnly,
        limit,
      });

      return res.status(200).json(notifications);
    } catch (err) {
      console.error("getMyNotifications error:", err);
      return res
        .status(500)
        .json({ message: "Error al obtener notificaciones" });
    }
  }

  async getUnreadCount(req, res) {
    try {
      const count = await NotificationDAO.countUnread(req.user.id);
      return res.status(200).json({ count });
    } catch (err) {
      console.error("getUnreadCount error:", err);
      return res
        .status(500)
        .json({ message: "Error al contar notificaciones" });
    }
  }

  async markAsRead(req, res) {
    try {
      const notification = await NotificationDAO.markAsRead(
        req.params.id,
        req.user.id
      );

      if (!notification) {
        return res.status(404).json({ message: "Notificación no encontrada" });
      }

      return res.status(200).json(notification);
    } catch (err) {
      console.error("markAsRead error:", err);
      return res
        .status(500)
        .json({ message: "Error al marcar notificación como leída" });
    }
  }

  async markAllAsRead(req, res) {
    try {
      await NotificationDAO.markAllAsRead(req.user.id);
      return res.status(200).json({ message: "Todas las notificaciones marcadas como leídas" });
    } catch (err) {
      console.error("markAllAsRead error:", err);
      return res
        .status(500)
        .json({ message: "Error al marcar notificaciones como leídas" });
    }
  }
}

module.exports = new NotificationController();
