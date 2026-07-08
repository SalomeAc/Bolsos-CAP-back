const MessageDAO = require("../dao/messageDAO");
const NotificationDAO = require("../dao/notificationDAO");
const { sendMail } = require("../utils/mailer");

class NotificationService {
  /**
   * Genera y envía notificación de confirmación de cotización al cliente
   * @param {Object} quotation - Cotización poblada con user, product/customProduct
   * @param {Object} [options]
   * @param {boolean} [options.fromCotizarForm=false] - true si viene del formulario /cotizar
   * @param {string} [options.observaciones] - texto del campo observaciones
   * @param {string} [options.photoUrl] - URL de Cloudinary
   * @returns {Promise<Object>} Mensaje de notificación creado
   */
  async sendQuotationConfirmation(quotation, options = {}) {
    try {
      const { fromCotizarForm = false } = options;

      if (!quotation || !quotation.user || !quotation.user.email) {
        throw new Error("Cotización debe tener usuario con email");
      }

      console.log(
        `[NOTIFICATION] Iniciando notificación para cotización ${quotation._id}` +
          (fromCotizarForm ? " (formulario Cotizar)" : ""),
      );

      const content = this._buildNotificationContent(quotation);

      const messageContent = fromCotizarForm
        ? this._buildCotizarFormSystemMessageContent(
            quotation,
            content,
            options,
          )
        : this._buildStandardSystemMessageContent(content);

      const attachments = fromCotizarForm
        ? this._resolveCotizarFormAttachments(quotation, options)
        : [];

      const emailHtml = fromCotizarForm
        ? this._buildEmailTemplate(content, {
            ...options,
            fromCotizarForm: true,
          })
        : this._buildEmailTemplate(content);

      console.log(`[NOTIFICATION] Creando mensaje del sistema...`);
      const systemMessage = await this._createSystemMessage(
        quotation,
        messageContent,
        attachments,
      );
      console.log(
        `[NOTIFICATION] Mensaje del sistema creado: ${systemMessage._id}`,
      );

      console.log(`[NOTIFICATION] Enviando email a ${quotation.user.email}...`);
      await this._sendEmail(quotation.user.email, emailHtml);
      console.log(
        `[NOTIFICATION] ✓ Email enviado exitosamente a ${quotation.user.email}`,
      );

      console.log(
        `[NOTIFICATION] ✓ Notificación completada para cotización ${quotation._id}`,
      );
      return systemMessage;
    } catch (err) {
      console.error(
        `[NOTIFICATION ERROR] Error en sendQuotationConfirmation:`,
        err,
      );
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
      const admins = await AdminUser.find({
        isAdmin: true,
        isActive: true,
      }).lean();

      if (!admins.length) {
        console.warn(
          "[NOTIFICATION] No hay administradores activos para notificar",
        );
        return [];
      }

      const clientName =
        [quotation.user?.firstName, quotation.user?.lastName]
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
          solicitud:
            solicitud?._id || quotation.solicitud?._id || quotation.solicitud,
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
          `[NOTIFICATION] ✓ Notificación admin creada para ${admin.email}: ${notification._id}`,
        );

        if (admin.email) {
          try {
            await this._sendAdminEmail(
              admin.email,
              title,
              message,
              quotation,
              solicitudCode,
            );
          } catch (emailErr) {
            console.error(
              `[NOTIFICATION] Error enviando email admin a ${admin.email}:`,
              emailErr.message,
            );
          }
        }
      }

      return notifications;
    } catch (err) {
      console.error(
        `[NOTIFICATION ERROR] Error en notifyAdminNewRequest:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Crea una notificación para el cliente cuando la solicitud fue recibida
   * @param {Object} quotation - Cotización poblada
   * @param {Object} solicitud - Solicitud asociada (opcional)
   * @returns {Promise<Object|null>} Notificación creada o null si no aplica
   */
  async notifyClientQuotationReceived(quotation, solicitud = null) {
    try {
      if (!quotation || !quotation._id) {
        throw new Error("Cotización requerida para notificar al cliente");
      }

      const recipientId = quotation.user?._id || quotation.user;
      if (!recipientId) {
        console.warn(
          "[NOTIFICATION] No se encontró usuario para notificar recepción",
        );
        return null;
      }

      const clientName =
        [quotation.user?.firstName, quotation.user?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || "Cliente";
      const productName =
        quotation.kind === "catalog"
          ? quotation.product?.name || "producto de catálogo"
          : quotation.customProduct?.description || "bolso personalizado";
      const solicitudCode = solicitud?.code || quotation.solicitud?.code;
      const title = "Solicitud de cotización recibida";
      const message = solicitudCode
        ? `${clientName}, hemos recibido tu solicitud ${solicitudCode} para ${productName}.`
        : `${clientName}, hemos recibido tu solicitud de cotización para ${productName}.`;

      const notification = await NotificationDAO.create({
        type: "confirmacion_cotizacion",
        title,
        message,
        quotation: quotation._id,
        solicitud:
          solicitud?._id || quotation.solicitud?._id || quotation.solicitud,
        recipient: recipientId,
        read: false,
        metadata: {
          clientName,
          productName,
          kind: quotation.kind,
          quantity: quotation.quantity || 1,
          requestDate: quotation.createdAt || new Date(),
        },
      });

      console.log(
        `[NOTIFICATION] ✓ Notificación cliente creada: ${notification._id}`,
      );
      return notification;
    } catch (err) {
      console.error(
        `[NOTIFICATION ERROR] Error en notifyClientQuotationReceived:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Notifica a la administradora que la propuesta de IA está lista para revisar.
   * @param {Object} quotation - Cotización poblada con aiQuotation
   * @returns {Promise<Array>}
   */
  async notifyAdminAiQuotationReady(quotation) {
    try {
      if (!quotation?.aiQuotation?.amount) {
        return [];
      }

      const AdminUser = require("../models/user");
      const admins = await AdminUser.find({
        isAdmin: true,
        isActive: true,
      }).lean();

      if (!admins.length) {
        return [];
      }

      const clientName =
        [quotation.user?.firstName, quotation.user?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || "Cliente";
      const productName =
        quotation.kind === "catalog"
          ? quotation.product?.name || "Producto de catálogo"
          : quotation.customProduct?.description || "Bolso personalizado";
      const amountText = this._formatCurrency(
        quotation.aiQuotation.amount,
        quotation.aiQuotation.currency || "COP",
      );
      const solicitudCode = quotation.solicitud?.code;
      const title = "Cotización generada por IA";
      const message = solicitudCode
        ? `La IA sugirió ${amountText} para ${solicitudCode} (${productName}). Revisa y envía al cliente.`
        : `La IA sugirió ${amountText} para la solicitud de ${clientName}: ${productName}.`;

      const notifications = [];

      for (const admin of admins) {
        const notification = await NotificationDAO.create({
          type: "cotizacion_ia_lista",
          title,
          message,
          quotation: quotation._id,
          solicitud: quotation.solicitud?._id || quotation.solicitud,
          recipient: admin._id,
          read: false,
          metadata: {
            clientName,
            clientEmail: quotation.user?.email,
            productName,
            kind: quotation.kind,
            quantity: quotation.quantity || 1,
            requestDate: quotation.aiQuotation.generatedAt || new Date(),
            aiAmount: quotation.aiQuotation.amount,
            aiCurrency: quotation.aiQuotation.currency || "COP",
            breakdown: quotation.aiQuotation.breakdown,
          },
        });

        notifications.push(notification);

        if (admin.email) {
          try {
            await this._sendAdminEmail(
              admin.email,
              title,
              `${message}\n\nJustificación IA: ${quotation.aiQuotation.breakdown || "Sin detalle"}`,
              quotation,
              solicitudCode,
            );
          } catch (emailErr) {
            console.error(
              `[NOTIFICATION] Error enviando email IA admin a ${admin.email}:`,
              emailErr.message,
            );
          }
        }
      }

      await this._createSystemMessage(
        quotation,
        [
          "Propuesta de cotización generada por IA",
          "",
          `Monto sugerido: ${amountText}`,
          quotation.aiQuotation.breakdown
            ? `Justificación: ${quotation.aiQuotation.breakdown}`
            : "",
          "",
          "Revisa la propuesta y pulsa Aceptar o Modificar para enviarla al cliente.",
        ]
          .filter(Boolean)
          .join("\n"),
        [],
        "admin",
      );

      return notifications;
    } catch (err) {
      console.error(
        `[NOTIFICATION ERROR] Error en notifyAdminAiQuotationReady:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Notifica al cliente que la administradora envió la cotización final.
   * @param {Object} quotation - Cotización poblada con finalQuotation
   * @returns {Promise<Object|null>}
   */
  async notifyClientQuotationSent(quotation) {
    try {
      if (!quotation?.finalQuotation?.amount) {
        return null;
      }

      const recipientId = quotation.user?._id || quotation.user;
      if (!recipientId) {
        return null;
      }

      const clientName =
        [quotation.user?.firstName, quotation.user?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || "Cliente";
      const productName =
        quotation.kind === "catalog"
          ? quotation.product?.name || "tu producto"
          : "tu bolso";
      const amountText = this._formatCurrency(
        quotation.finalQuotation.amount,
        quotation.finalQuotation.currency || "COP",
      );
      const title = "Tu cotización está lista";
      const message = `La cotización de ${productName} es ${amountText}.`;
      const chatMessage = message;

      const notification = await NotificationDAO.create({
        type: "cotizacion_enviada",
        title,
        message,
        quotation: quotation._id,
        solicitud: quotation.solicitud?._id || quotation.solicitud,
        recipient: recipientId,
        read: false,
        metadata: {
          clientName,
          productName,
          kind: quotation.kind,
          quantity: quotation.quantity || 1,
          requestDate: quotation.finalQuotation.quotedAt || new Date(),
          finalAmount: quotation.finalQuotation.amount,
          finalCurrency: quotation.finalQuotation.currency || "COP",
        },
      });

      await this._createSystemMessage(quotation, chatMessage, [], "all");

      if (quotation.user?.email) {
        const html = `
          <!DOCTYPE html>
          <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
              <h2>${title}</h2>
              <p>Hola ${clientName},</p>
              <p>${message}</p>
              <p>Puedes responder desde Mis Cotizaciones.</p>
            </body>
          </html>
        `;
        await sendMail(quotation.user.email, title, html);
      }

      return notification;
    } catch (err) {
      console.error(
        `[NOTIFICATION ERROR] Error en notifyClientQuotationSent:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Crea una notificación para el cliente cuando cambia el estado del pedido
   * @param {Object} quotation - Cotización poblada
   * @param {string} previousStatus - Estado anterior
   * @param {string} nextStatus - Nuevo estado
   * @returns {Promise<Object|null>} Notificación creada o null si no aplica
   */
  async notifyClientStatusChanged(quotation, previousStatus, nextStatus) {
    try {
      if (!quotation || !quotation._id) {
        throw new Error("Cotización requerida para notificar cambio de estado");
      }

      const recipientId = quotation.user?._id || quotation.user;
      const productName =
        quotation.kind === "catalog"
          ? quotation.product?.name || "tu producto"
          : quotation.customProduct?.description || "tu bolso personalizado";
      if (!recipientId) {
        console.warn(
          "[NOTIFICATION] No se encontró usuario para notificar cambio de estado",
        );
        return null;
      }

      const title = "Actualización del estado de tu pedido";
      const previousLabel = this._getStatusLabel(previousStatus);
      const nextLabel = this._getStatusLabel(nextStatus);
      const message = `El estado de tu solicitud de "${productName}" cambió de ${previousLabel} a ${nextLabel}.`;

      const notification = await NotificationDAO.create({
        type: "cambio_estado",
        title,
        message,
        quotation: quotation._id,
        solicitud: quotation.solicitud?._id || quotation.solicitud,
        recipient: recipientId,
        read: false,
        metadata: {
          previousStatus,
          nextStatus,
          requestDate: quotation.updatedAt || new Date(),
        },
      });

      console.log(
        `[NOTIFICATION] ✓ Notificación de estado creada: ${notification._id}`,
      );
      return notification;
    } catch (err) {
      console.error(
        `[NOTIFICATION ERROR] Error en notifyClientStatusChanged:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Notifica a la administradora cuando el cliente acepta, rechaza o propone un precio.
   * @param {Object} quotation - Cotización poblada
   * @param {Object} response - Datos de respuesta del cliente
   * @returns {Promise<Array>} Notificaciones creadas para cada admin
   */
  async notifyAdminClientResponse(quotation, response = {}) {
    try {
      if (!quotation || !quotation._id) {
        throw new Error(
          "Cotización requerida para notificar respuesta del cliente",
        );
      }

      const AdminUser = require("../models/user");
      const admins = await AdminUser.find({ isAdmin: true, isActive: true }).lean();

      if (!admins.length) {
        console.warn(
          "[NOTIFICATION] No hay administradores activos para notificar respuesta del cliente",
        );
        return [];
      }

      const clientName =
        [quotation.user?.firstName, quotation.user?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || "Cliente";
      const productName =
        quotation.kind === "catalog"
          ? quotation.product?.name || "Producto de catálogo"
          : quotation.customProduct?.description || "Bolso personalizado";

      const decision =
        response.decision || quotation.clientResponse?.decision || "propuesta";
      const proposedAmount =
        response.proposedAmount ?? quotation.clientResponse?.proposedAmount;
      const currency = response.currency || quotation.clientResponse?.currency || "COP";
      const amountText = this._formatCurrency(proposedAmount, currency);

      const title =
        decision === "aceptada"
          ? "El cliente aceptó la cotización"
          : decision === "rechazada"
            ? "El cliente rechazó la cotización"
            : "El cliente propuso un nuevo precio";

      const message =
        decision === "aceptada"
          ? `${clientName} aceptó la cotización de ${productName}.`
          : decision === "rechazada"
            ? `${clientName} rechazó la cotización de ${productName}.`
            : `${clientName} propuso ${amountText} para ${productName}.`;

      const notifications = [];

      for (const admin of admins) {
        const notification = await NotificationDAO.create({
          type: "respuesta_cliente",
          title,
          message,
          quotation: quotation._id,
          solicitud: quotation.solicitud?._id || quotation.solicitud,
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
        });

        notifications.push(notification);

        if (admin.email) {
          try {
            await this._sendAdminEmail(
              admin.email,
              title,
              `${message}${
                proposedAmount != null ? `\n\nPrecio propuesto: ${amountText}` : ""
              }`,
              quotation,
              quotation.solicitud?.code || quotation.solicitud?._id?.toString?.() || quotation.solicitud,
            );
          } catch (emailErr) {
            console.error(
              `[NOTIFICATION] Error enviando email admin a ${admin.email}:`,
              emailErr.message,
            );
          }
        }
      }

      return notifications;
    } catch (err) {
      console.error(
        `[NOTIFICATION ERROR] Error en notifyAdminClientResponse:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Envía correo de confirmación al cliente cuando acepta la cotización.
   * @param {Object} quotation - Cotización poblada
   * @returns {Promise<void>}
   */
  async sendAcceptanceEmailToClient(quotation) {
    if (!quotation || !quotation.user || !quotation.user.email) {
      throw new Error("Cotización debe tener usuario con email");
    }

    const clientName =
      [quotation.user?.firstName, quotation.user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || "Cliente";
    const productName =
      quotation.kind === "catalog"
        ? quotation.product?.name || "tu producto"
        : quotation.customProduct?.description || "tu bolso personalizado";

    const amount = quotation.finalQuotation?.amount ?? quotation.aiQuotation?.amount;
    const currency =
      quotation.finalQuotation?.currency || quotation.aiQuotation?.currency || "COP";
    const amountText = this._formatCurrency(amount, currency);

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2>Tu pedido fue aceptado</h2>
          <p>Hola ${clientName}, hemos registrado la aceptación de tu cotización para ${productName}.</p>
          <p><strong>Valor confirmado:</strong> ${amountText}</p>
          <p><strong>Estado actual:</strong> ${this._getStatusLabel(quotation.status)}</p>
          <p>Te contactaremos con los siguientes pasos del pedido.</p>
        </body>
      </html>
    `;

    await sendMail(
      quotation.user.email,
      "Confirmación de pedido aceptado",
      html,
    );
  }

  _getStatusLabel(status) {
    const labels = {
      pendiente: "pendiente",
      cotizada_ia: "cotizada (IA)",
      en_revision: "en revisión",
      cotizada: "cotizada",
      aceptada: "aceptada",
      rechazada: "rechazada",
      en_produccion: "en producción",
      completada: "completada",
      cancelada: "cancelada",
    };

    return labels[status] || status || "sin estado";
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
    const requestDate = new Date(quotation.createdAt).toLocaleDateString(
      "es-CO",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    let bagType, bagName, material, dimensions, color;

    if (quotation.kind === "catalog" && quotation.product) {
      bagType = quotation.product.type || "No especificado";
      bagName = quotation.product.name || "No especificado";
      material = quotation.customization?.material || "No especificado";
      dimensions =
        quotation.customization?.size ||
        quotation.product.dimensions?.join(", ") ||
        "No especificado";
      color =
        quotation.customization?.color ||
        quotation.product.color?.join(", ") ||
        "No especificado";
    } else if (quotation.kind === "custom" && quotation.customProduct) {
      const cp = quotation.customProduct;
      bagType = "Personalizado";
      bagName = cp.description || "Sin nombre";
      material = Array.isArray(cp.materials)
        ? cp.materials.join(", ")
        : cp.materials || "No especificado";
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
   * Mensaje del sistema estándar (catálogo y custom vía API JSON)
   * @private
   */
  _buildStandardSystemMessageContent(content) {
    const {
      bagType,
      bagName,
      material,
      dimensions,
      color,
      requestDate,
      status,
    } = content;

    return [
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
  }

  /**
   * Mensaje del sistema para cotizaciones desde /cotizar
   * @private
   */
  _buildCotizarFormSystemMessageContent(quotation, content, options = {}) {
    const { material, dimensions, color, requestDate, status } = content;

    const observaciones =
      options.observaciones?.trim() || quotation.notes?.trim() || "";

    const lines = [
      "Cotización Registrada Correctamente",
      "",
      "Hemos recibido tu solicitud de cotización. Estos son los detalles:",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `Material: ${material}`,
      `Dimensiones: ${dimensions}`,
      `Color: ${color}`,
      `Fecha de solicitud: ${requestDate}`,
      `Estado actual: ${status}`,
    ];

    if (observaciones) {
      lines.push("");
      lines.push("Observaciones:");
      lines.push(observaciones);
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push("Pronto recibirás nuevas actualizaciones.");

    return lines.join("\n");
  }

  /**
   * Resuelve adjuntos para cotizaciones desde /cotizar
   * @private
   */
  _resolveCotizarFormAttachments(quotation, options = {}) {
    const photoUrl = options.photoUrl || quotation.customProduct?.photo || null;

    return photoUrl ? [photoUrl] : [];
  }

  /**
   * Construye mensaje HTML para el email
   * @private
   */
  _buildEmailTemplate(content, options = {}) {
    const {
      bagType,
      bagName,
      material,
      dimensions,
      color,
      requestDate,
      status,
    } = content;

    const fromCotizarForm = options.fromCotizarForm === true;
    const observaciones = options.observaciones?.trim() || "";
    const photoUrl = options.photoUrl || "";

    const observacionesBlock =
      fromCotizarForm && observaciones
        ? `
              <div class="info-item">
                <span class="label">Observaciones:</span><br>
                ${observaciones.replace(/\n/g, "<br>")}
              </div>`
        : "";

    const photoBlock =
      fromCotizarForm && photoUrl
        ? `
              <div class="info-item">
                <span class="label">Foto de referencia:</span><br>
                <a href="${photoUrl}" target="_blank">Ver imagen adjunta</a>
              </div>`
        : "";

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
              ${observacionesBlock}
              ${photoBlock}
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
  async _createSystemMessage(
    quotation,
    messageContent,
    attachments = [],
    audience = "all",
  ) {
    const AdminUser = require("../models/user");
    const adminUser = await AdminUser.findOne({ isAdmin: true }).lean();
    const senderId = adminUser?._id || quotation.user._id;

    return await MessageDAO.create({
      quotation: quotation._id,
      sender: senderId,
      content: messageContent,
      isSystemMessage: true,
      audience,
      attachments: attachments || [],
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
    await sendMail(
      userEmail,
      "Cotización Registrada Correctamente",
      htmlContent,
    );
  }

  _formatCurrency(amount, currency = "COP") {
    if (amount == null || Number.isNaN(Number(amount))) {
      return "Pendiente de definir";
    }

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  }
}

module.exports = new NotificationService();
