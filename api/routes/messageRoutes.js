const express = require("express");
const router = express.Router();

const authenticateToken = require("../middlewares/auth");
const MessageController = require("../controllers/messageController");

// Todas las rutas de mensajes requieren autenticación
router.use(authenticateToken);

// Crear un mensaje en una cotización
router.post("/:quotationId", (req, res) =>
  MessageController.createMessage(req, res)
);

// Obtener todos los mensajes de una cotización
router.get("/:quotationId/all", (req, res) =>
  MessageController.getMessagesByQuotation(req, res)
);

// Obtener los últimos N mensajes de una cotización
router.get("/:quotationId", (req, res) =>
  MessageController.getLatestMessagesByQuotation(req, res)
);

// Eliminar un mensaje específico
router.delete("/:messageId", (req, res) =>
  MessageController.deleteMessage(req, res)
);

module.exports = router;
