const MessageDAO = require("../dao/messageDAO");
const NotificationDAO = require("../dao/notificationDAO");
const { sendMail } = require("../utils/mailer");

class NotificationService {
  /**
   * Genera y envía notificación de confirmación de cotización al cliente
   * @param {Object} quotation - Cotización poblada con user, product/customProduct
   * @returns {Promise<Object>} Mensaje de notificación creado
   */
  async sendQuotationConfirmation(quotation) {
    try {
      if (!quotation || !quotation.user || !quotation.user.email) {
        throw new Error("Cotización debe tener usuario con email");
      }

      console.log(`[NOTIFICATION] Iniciando notificación para cotización ${quotation._id}`);

      const content = this._buildNotificationContent(quotation);
      const emailHtml = this._buildEmailTemplate(content);

      console.log(`[NOTIFICATION] Creando mensaje del sistema...`);
      const systemMessage = await this._createSystemMessage(quotation, content);
      console.log(`[NOTIFICATION] Mensaje del sistema creado: ${systemMessage._id}`);

      console.log(`[NOTIFICATION] Enviando email a ${quotation.user.email}...`);
      await this._sendEmail(quotation.user.email, emailHtml);
      console.log(`[NOTIFICATION] ✓ Email enviado exitosamente a ${quotation.user.email}`);

      console.log(`[NOTIFICATION] ✓ Notificación completada para cotización ${quotation._id}`);
      return systemMessage;
    } catch (err) {
      console.error(`[NOTIFICATION ERROR] Error en sendQuotationConfirmation:`, err);
      throw err;
    }
  }

  /**
   * Notifica a la administradora sobre una nueva solicitud de cotización
   * @param {Object} quotation - Cotización poblada
   * @param {Object} solicitud - Solicitud asociada (opcional)
   * @returns {Promise<Array>} Notificaciones creadas para cada admin
   */
  async notifyAdminNewRequest(quotation, solicitud = null) {
    try {
      if (!quotation || !quotation._id) {
        throw new Error("Cotización requerida para notificar al admin");
      }

      const AdminUser = require("../models/user");
      const admins = await AdminUser.find({ isAdmin: true, isActive: true }).lean();

      if (!admins.length) {
        console.warn("[NOTIFICATION] No hay administradores activos para notificar");
        return [];
      }

      const clientName = [
        quotation.user?.firstName,
        quotation.user?.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || "Cliente";

      const productName =
        quotation.kind === "catalog"
          ? quotation.product?.name || "Producto de catálogo"
          : quotation.customProduct?.description || "Bolso personalizado";

      const solicitudCode = solicitud?.code || quotation.solicitud?.code;
      const title = "Nueva solicitud de cotización";
      const message = solicitudCode
        ? `${clientName} envió la solicitud ${solicitudCode}: ${productName} (x${quotation.quantity || 1})`
        : `${clientName} envió una nueva solicitud: ${productName} (x${quotation.quantity || 1})`;

      const notifications = [];

      for (const admin of admins) {
        const notificationData = {
          type: "nueva_solicitud",
          title,
          message,
          quotation: quotation._id,
          solicitud: solicitud?._id || quotation.solicitud?._id || quotation.solicitud,
          recipient: admin._id,
          read: false,
          metadata: {
            clientName,
            clientEmail: quotation.user?.email,
            productName,
            kind: quotation.kind,
            quantity: quotation.quantity || 1,
            requestDate: quotation.createdAt || new Date(),
          },
        };

        const notification = await NotificationDAO.create(notificationData);
        notifications.push(notification);
        console.log(
          `[NOTIFICATION] ✓ Notificación admin creada para ${admin.email}: ${notification._id}`
        );

        if (admin.email) {
          try {
            await this._sendAdminEmail(admin.email, title, message, quotation, solicitudCode);
          } catch (emailErr) {
            console.error(
              `[NOTIFICATION] Error enviando email admin a ${admin.email}:`,
              emailErr.message
            );
          }
        }
      }

      return notifications;
    } catch (err) {
      console.error(`[NOTIFICATION ERROR] Error en notifyAdminNewRequest:`, err);
      throw err;
    }
  }

  /**
   * @private
   */
  async _sendAdminEmail(adminEmail, title, message, quotation, solicitudCode) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>${title}</h2>
          <p>${message}</p>
          <p><strong>ID cotización:</strong> ${quotation._id}</p>
          ${solicitudCode ? `<p><strong>Código solicitud:</strong> ${solicitudCode}</p>` : ""}
          <p>Ingresa al panel de administración para atender esta solicitud.</p>
        </body>
      </html>
    `;
    await sendMail(adminEmail, title, html);
  }

  /**
   * Construye contenido de notificación basado en modalidad
   * @private
   */
  _buildNotificationContent(quotation) {
    const requestDate = new Date(quotation.createdAt).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let bagType, bagName, material, dimensions, color;

    if (quotation.kind === "catalog" && quotation.product) {
      bagType = quotation.product.type || "No especificado";
      bagName = quotation.product.name || "No especificado";
      material = quotation.customization?.type
        ? `${quotation.customization.type} - ${quotation.product.materials?.join(", ") || "No especificado"}`
        : quotation.product.materials?.join(", ") || "No especificado";
      dimensions = quotation.customization?.size || quotation.product.dimensions?.join(", ") || "No especificado";
      color = quotation.customization?.color || quotation.product.color?.join(", ") || "No especificado";
    } else if (quotation.kind === "custom" && quotation.customProduct) {
      const cp = quotation.customProduct;
      bagType = "Personalizado";
      bagName = cp.description || "Sin nombre";
      material = Array.isArray(cp.materials) ? cp.materials.join(", ") : cp.materials || "No especificado";
      dimensions = cp.dimensions || "No especificado";
      color = cp.color || "No especificado";
    } else {
      throw new Error("Estructura de cotización no válida");
    }

    return {
      bagType,
      bagName,
      material,
      dimensions,
      color,
      requestDate,
      status: "Pendiente",
    };
  }

  /**
   * Construye mensaje HTML para el email
   * @private
   */
  _buildEmailTemplate(content) {
    const { bagType, bagName, material, dimensions, color, requestDate, status } = content;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .info-item { margin-bottom: 15px; }
            .label { font-weight: bold; color: #2c3e50; }
            .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
            hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Cotización Registrada Correctamente</h2>
            </div>
            <div class="content">
              <p>Hemos recibido tu solicitud de cotización. Estos son los detalles de tu bolso:</p>
              <hr>
              <div class="info-item"><span class="label">Tipo de bolso:</span> ${bagType}</div>
              <div class="info-item"><span class="label">Nombre del bolso:</span> ${bagName}</div>
              <div class="info-item"><span class="label">Material:</span> ${material}</div>
              <div class="info-item"><span class="label">Dimensiones:</span> ${dimensions}</div>
              <div class="info-item"><span class="label">Color:</span> ${color}</div>
              <div class="info-item"><span class="label">Fecha de solicitud:</span> ${requestDate}</div>
              <div class="info-item"><span class="label">Estado actual:</span> <strong>${status}</strong></div>
              <hr>
              <p>Pronto recibirás nuevas actualizaciones sobre el estado de tu cotización.</p>
              <div class="footer">
                <p>Este es un mensaje automático. Por favor, no respondas a este email.</p>
                <p>Si tienes preguntas, ingresa a la plataforma para comunicarte con nuestro equipo.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Crea mensaje del sistema en la plataforma
   * @private
   */
  async _createSystemMessage(quotation, content) {
    const { bagType, bagName, material, dimensions, color, requestDate, status } = content;

    const messageContent = [
      "Cotización Registrada Correctamente",
      "",
      "Hemos recibido tu solicitud de cotización. Estos son los detalles:",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `Tipo de bolso: ${bagType}`,
      `Nombre del bolso: ${bagName}`,
      `Material: ${material}`,
      `Dimensiones: ${dimensions}`,
      `Color: ${color}`,
      `Fecha de solicitud: ${requestDate}`,
      `Estado actual: ${status}`,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "Pronto recibirás nuevas actualizaciones.",
    ].join("\n");

    const AdminUser = require("../models/user");
    const adminUser = await AdminUser.findOne({ isAdmin: true }).lean();
    const senderId = adminUser?._id || quotation.user._id;

    return await MessageDAO.create({
      quotation: quotation._id,
      sender: senderId,
      content: messageContent,
      isSystemMessage: true,
      attachments: [],
    });
  }

  /**
   * Envía email al usuario
   * @private
   */
  async _sendEmail(userEmail, htmlContent) {
    if (!userEmail) {
      throw new Error("Email del usuario requerido");
    }
    await sendMail(userEmail, "Cotización Registrada Correctamente", htmlContent);
  }
}

module.exports = new NotificationService();
