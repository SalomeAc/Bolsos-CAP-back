const GlobalController = require("./globalController");
const MessageDAO = require("../dao/messageDAO");
const QuotationDAO = require("../dao/quotationDAO");

class MessageController extends GlobalController {
  constructor() {
    super(MessageDAO);
  }

  // --- Crear mensaje ---
  async createMessage(req, res) {
    try {
      const { quotationId, content, attachments } = req.body;

      // Validar que la cotización exista
      const quotation = await QuotationDAO.read(quotationId);
      if (!quotation) {
        return res
          .status(404)
          .json({ message: "Cotización no encontrada" });
      }

      // Validar que el usuario sea propietario de la cotización o administrador
      // Extraer el ID del usuario de la cotización (puede ser objeto o string)
      const quotationUserId = quotation.user?._id?.toString() || quotation.user?.toString() || quotation.user;
      const currentUserId = req.user.id?.toString() || req.user.id;
      const isOwner = quotationUserId === currentUserId;
      const isAdmin = req.user.isAdmin === true;

      console.log("DEBUG createMessage:", {
        quotationUserId,
        currentUserId,
        isOwner,
        isAdmin,
        quotationUserObj: quotation.user
      });

      if (!isOwner && !isAdmin) {
        return res
          .status(403)
          .json({ message: "No tienes permiso para enviar mensajes en esta cotización" });
      }

      // Validar contenido
      if (!content || content.trim().length === 0) {
        return res
          .status(400)
          .json({ message: "El contenido del mensaje es requerido" });
      }

      const messageData = {
        quotation: quotationId,
        sender: req.user.id,
        content: content.trim(),
        attachments: attachments || [],
      };

      const message = await this.dao.create(messageData);
      
      // Poblar el remitente en la respuesta
      const populatedMessage = await this.dao.model.findById(message._id).populate("sender", "firstName lastName email");
      
      return res.status(201).json(populatedMessage);
    } catch (err) {
      console.error("createMessage error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al enviar el mensaje" });
    }
  }

  // --- Obtener mensajes de una cotización ---
  async getMessagesByQuotation(req, res) {
    try {
      const { quotationId } = req.params;

      // Validar que la cotización exista
      const quotation = await QuotationDAO.read(quotationId);
      if (!quotation) {
        return res
          .status(404)
          .json({ message: "Cotización no encontrada" });
      }

      // Validar que el usuario sea propietario de la cotización o administrador
      const quotationUserId = quotation.user?._id?.toString() || quotation.user?.toString() || quotation.user;
      const currentUserId = req.user.id?.toString() || req.user.id;
      const isOwner = quotationUserId === currentUserId;
      const isAdmin = req.user.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res
          .status(403)
          .json({ message: "No tienes permiso para ver los mensajes de esta cotización" });
      }

      const messages = await this.dao.findByQuotation(quotationId, {
        includeAdminOnly: isAdmin,
      });
      return res.status(200).json(messages);
    } catch (err) {
      console.error("getMessagesByQuotation error:", err);
      return res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

  // --- Obtener últimos mensajes de una cotización ---
  async getLatestMessagesByQuotation(req, res) {
    try {
      const { quotationId } = req.params;
      const { limit } = req.query;

      // Validar que la cotización exista
      const quotation = await QuotationDAO.read(quotationId);
      if (!quotation) {
        return res
          .status(404)
          .json({ message: "Cotización no encontrada" });
      }

      // Validar que el usuario sea propietario de la cotización o administrador
      const quotationUserId = quotation.user?._id?.toString() || quotation.user?.toString() || quotation.user;
      const currentUserId = req.user.id?.toString() || req.user.id;
      const isOwner = quotationUserId === currentUserId;
      const isAdmin = req.user.isAdmin === true;

      console.log("\n========== DEBUG getLatestMessages ==========");
      console.log("quotationId:", quotationId);
      console.log("quotation.user objeto:", JSON.stringify(quotation.user, null, 2));
      console.log("quotationUserId (extraído):", quotationUserId, "tipo:", typeof quotationUserId);
      console.log("currentUserId (del JWT):", currentUserId, "tipo:", typeof currentUserId);
      console.log("isOwner:", isOwner);
      console.log("isAdmin:", isAdmin);
      console.log("req.user completo:", JSON.stringify(req.user, null, 2));
      console.log("===========================================\n");

      if (!isOwner && !isAdmin) {
        console.log("❌ ACCESS DENIED");
        return res
          .status(403)
          .json({ message: "No tienes permiso para ver los mensajes de esta cotización" });
      }

      console.log("✅ ACCESS GRANTED");
      const messages = await this.dao.findLatestByQuotation(
        quotationId,
        limit ? parseInt(limit) : 50,
        { includeAdminOnly: isAdmin },
      );
      // Revertir para que los más recientes estén al final
      return res.status(200).json(messages.reverse());
    } catch (err) {
      console.error("getLatestMessagesByQuotation error:", err);
      return res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

  // --- Eliminar mensaje (solo el remitente o admin) ---
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;

      const message = await this.dao.read(messageId);
      if (!message) {
        return res
          .status(404)
          .json({ message: "Mensaje no encontrado" });
      }

      const senderId = message.sender?._id?.toString() || message.sender?.toString() || message.sender;
      const currentUserId = req.user.id?.toString() || req.user.id;
      const isOwner = senderId === currentUserId;
      const isAdmin = req.user.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res
          .status(403)
          .json({ message: "No tienes permiso para eliminar este mensaje" });
      }

      await this.dao.delete(messageId);
      return res
        .status(200)
        .json({ message: "Mensaje eliminado exitosamente" });
    } catch (err) {
      console.error("deleteMessage error:", err);
      return res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }
}

module.exports = new MessageController();
