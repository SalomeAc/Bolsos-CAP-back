const express = require("express");
const router = express.Router();

const authenticateToken = require("../middlewares/auth");
const NotificationController = require("../controllers/notificationController");

router.use(authenticateToken);

router.get("/", (req, res) =>
  NotificationController.getMyNotifications(req, res)
);

router.get("/unread-count", (req, res) =>
  NotificationController.getUnreadCount(req, res)
);

router.put("/read-all", (req, res) =>
  NotificationController.markAllAsRead(req, res)
);

router.put("/:id/read", (req, res) =>
  NotificationController.markAsRead(req, res)
);

module.exports = router;
