const GlobalController = require("./globalController");
const QuotationDAO = require("../dao/quotationDAO");
const SolicitudDAO = require("../dao/solicitudDAO");
const UserDAO = require("../dao/userDAO");
const NotificationService = require("../services/notificationService");
const CloudinaryService = require("../services/cloudinaryService");
const jwt = require("jsonwebtoken");
const aiLog = require("../utils/aiWorkflowLogger");

class QuotationController extends GlobalController {
  constructor() {
    super(QuotationDAO);
  }

  // --- Cliente: crear cotización (catálogo o personalizada) ---
  async createQuotation(req, res) {
    try {
      const { kind, product, customization, customProduct, quantity, notes } =
        req.body;

      if (!kind || !["catalog", "custom"].includes(kind)) {
        return res
          .status(400)
          .json({
            message: "El tipo de cotización debe ser 'catalog' o 'custom'",
          });
      }

      const data = {
        kind,
        user: req.user.id,
        quantity,
        notes,
        status: "pendiente",
      };

      if (kind === "catalog") {
        if (!product) {
          return res
            .status(400)
            .json({
              message: "Una cotización de catálogo requiere el producto",
            });
        }
        data.product = product;
        data.customization = customization;
      } else {
        data.customProduct = customProduct;
        if (data.customProduct?.dimensions) {
          data.customProduct.dimensions = this._normalizeDimensionsForAi(
            data.customProduct.dimensions,
          );
        }
      }

      // HU2: crear solicitud y asociarla a la cotización
      const solicitudData = {
        user: req.user.id,
        kind,
        quantity: quantity || 1,
        notes,
        status: "pendiente",
      };

      if (kind === "catalog") {
        solicitudData.product = product;
        solicitudData.customization = customization;
      } else {
        solicitudData.customProduct = customProduct;
        if (solicitudData.customProduct?.dimensions) {
          solicitudData.customProduct.dimensions = this._normalizeDimensionsForAi(
            solicitudData.customProduct.dimensions,
          );
        }
      }

      const solicitud = await SolicitudDAO.create(solicitudData);
      data.solicitud = solicitud._id;

      const quotation = await this.dao.create(data);

      // Vincular cotización en la solicitud (integridad bidireccional)
      await SolicitudDAO.update(solicitud._id, { quotation: quotation._id });

      aiLog.info("CREATE", "Cotización creada, disparando flujo IA", {
        quotationId: quotation._id?.toString?.() || quotation._id,
        solicitudId: solicitud._id?.toString?.() || solicitud._id,
        kind,
        source: "createQuotation",
        customProduct: kind === "custom"
          ? aiLog.validateCustomProductForN8n(data.customProduct).snapshot
          : null,
      });

      const aiResult = await this._triggerAiQuotationWorkflow({
        quotationId: quotation._id,
        solicitudId: solicitud._id,
        kind,
      });

      // Poblar cotización con los datos ya enriquecidos por IA, si el webhook respondió a tiempo
      const populatedQuotation = await this.dao.read(quotation._id);
      aiLog.logQuotationState("POST-TRIGGER", populatedQuotation, {
        aiWorkflow: aiResult,
        note: this._describeAiWorkflowResult(kind, aiResult),
      });
      const populatedSolicitud = await SolicitudDAO.read(solicitud._id);

      // Enviar notificaciones (asíncrono, no bloquea)
      this._sendNotificationAsync(populatedQuotation, {
        solicitud: populatedSolicitud,
      }).catch((err) => {
        console.error("Error enviando notificaciones de cotización:", err);
      });

      return res.status(201).json(this._sanitizeQuotationForClient(populatedQuotation));
    } catch (err) {
      if (err.name === "ValidationError") {
        const firstMessage = Object.values(err.errors)[0].message;
        return res.status(400).json({ message: firstMessage });
      }
      console.error("createQuotation error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al crear la cotización" });
    }
  }

  // --- Cliente: formulario de cotización personalizada (multipart + foto) ---
  async createCustomQuotationFromForm(req, res) {
    try {
      const dimensions = req.body.dimensions?.trim();
      const color = req.body.color?.trim();
      const material = req.body.material?.trim();
      const observaciones = req.body.observaciones?.trim() || "";

      if (!dimensions || !color || !material) {
        return res.status(400).json({
          message: "Dimensiones, color y material son obligatorios",
        });
      }

      let photoUrl = null;

      if (req.file) {
        const uploadResult = await CloudinaryService.uploadImageBuffer(
          req.file.buffer,
        );
        photoUrl = uploadResult.url;
      }

      const customProduct = {
        description: `Bolso personalizado en ${material}`,
        color,
        dimensions: this._normalizeDimensionsForAi(dimensions),
        materials: [material],
        ...(photoUrl ? { photo: photoUrl } : {}),
      };

      const solicitudData = {
        user: req.user.id,
        kind: "custom",
        quantity: 1,
        notes: observaciones || undefined,
        status: "pendiente",
        customProduct,
      };

      const solicitud = await SolicitudDAO.create(solicitudData);

      const quotationData = {
        kind: "custom",
        user: req.user.id,
        quantity: 1,
        notes: observaciones || undefined,
        status: "pendiente",
        solicitud: solicitud._id,
        customProduct,
      };

      const quotation = await this.dao.create(quotationData);
      await SolicitudDAO.update(solicitud._id, { quotation: quotation._id });

      aiLog.info("CREATE", "Cotización custom-form creada, disparando flujo IA", {
        quotationId: quotation._id?.toString?.() || quotation._id,
        solicitudId: solicitud._id?.toString?.() || solicitud._id,
        kind: "custom",
        hasPhoto: Boolean(photoUrl),
        source: "createCustomQuotationFromForm",
        customProduct: aiLog.validateCustomProductForN8n(customProduct).snapshot,
      });

      const aiResult = await this._triggerAiQuotationWorkflow({
        quotationId: quotation._id,
        solicitudId: solicitud._id,
        kind: "custom",
      });

      const populatedQuotation = await this.dao.read(quotation._id);
      aiLog.logQuotationState("POST-TRIGGER", populatedQuotation, {
        aiWorkflow: aiResult,
        hasPhoto: Boolean(photoUrl),
        note: this._describeAiWorkflowResult("custom", aiResult),
      });
      const populatedSolicitud = await SolicitudDAO.read(solicitud._id);

      this._sendNotificationAsync(populatedQuotation, {
        solicitud: populatedSolicitud,
        options: {
          fromCotizarForm: true,
          observaciones,
          photoUrl,
        },
      }).catch((err) => {
        console.error("Error enviando notificaciones de cotización:", err);
      });

      return res.status(201).json(this._sanitizeQuotationForClient(populatedQuotation));
    } catch (err) {
      if (err.name === "ValidationError") {
        const firstMessage = Object.values(err.errors)[0].message;
        return res.status(400).json({ message: firstMessage });
      }

      console.error("createCustomQuotationFromForm error:", err);
      return res.status(400).json({
        message: err.message || "Error al procesar la cotización",
      });
    }
  }

  /**
   * Envía notificaciones de forma asíncrona (cliente + admin)
   * @param {Object} quotation - Cotización poblada
   * @param {Object} [context={}] - solicitud (HU2) y/o options del formulario /cotizar
   * @private
   */
  async _sendNotificationAsync(
    quotation,
    { solicitud = null, options = {} } = {},
  ) {
    try {
      await NotificationService.sendQuotationConfirmation(quotation, options);
      await NotificationService.notifyClientQuotationReceived(
        quotation,
        solicitud,
      );
      await NotificationService.notifyAdminNewRequest(quotation, solicitud);
      console.log(
        `[QUOTATION] ✓ Notificaciones completadas para cotización ${quotation._id}`,
      );
    } catch (err) {
      console.error(
        `[QUOTATION] ⚠️ Error en notificaciones para cotización ${quotation._id}:`,
        err.message,
      );
    }
  }

  /**
   * n8n "cotizacion-personalizada" espera dimensiones tipo 20x15x10 (sin espacios).
   * @private
   */
  _normalizeDimensionsForAi(dimensions) {
    if (!dimensions) return dimensions;
    return String(dimensions)
      .trim()
      .replace(/\s*[xX×]\s*/g, "x")
      .replace(/\s+/g, "");
  }

  /**
   * Oculta la propuesta IA al cliente hasta que la admin envíe finalQuotation.
   * @private
   */
  _sanitizeQuotationForClient(quotation) {
    if (!quotation) return quotation;

    const doc =
      typeof quotation.toObject === "function"
        ? quotation.toObject()
        : { ...quotation };

    delete doc.aiQuotation;

    if (doc.status === "cotizada_ia") {
      doc.status = "pendiente";
    }

    return doc;
  }

  _sanitizeQuotationsForClient(quotations) {
    return quotations.map((q) => this._sanitizeQuotationForClient(q));
  }

  _describeAiWorkflowResult(kind, aiResult) {
    if (aiResult?.triggered) {
      return "Webhook aceptado. n8n procesa en background; la propuesta IA puede tardar 15-60 s.";
    }
    if (aiResult?.reason === "catalog_not_supported") {
      return "Cotización de catálogo: el workflow n8n actual solo genera IA para bolsos personalizados (/cotizar).";
    }
    if (aiResult?.reason === "missing_config") {
      return "Faltan N8N_WEBHOOK_URL o N8N_WEBHOOK_SECRET en .env.";
    }
    return "No se disparó la IA. Revise logs [QUOTATION][AI][TRIGGER].";
  }

  /**
   * Dispara el flujo de IA externo que genera la cotización preliminar.
   * @private
   */
  async _triggerAiQuotationWorkflow({ quotationId, solicitudId, kind = "custom" }) {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    const startedAt = Date.now();
    const ids = {
      quotationId: quotationId?.toString?.() || quotationId,
      solicitudId: solicitudId?.toString?.() || solicitudId,
      kind,
    };

    aiLog.logGenerationStart("TRIGGER", ids, { phase: "pre-check" });

    const solicitud = await SolicitudDAO.read(solicitudId);
    const productValidation = aiLog.logSolicitudForN8n("TRIGGER-PAYLOAD", solicitud, ids);

    if (kind === "catalog") {
      aiLog.warn(
        "TRIGGER",
        "IA omitida: el workflow n8n cotizacion-personalizada no soporta catálogo",
        {
          ...ids,
          hint:
            "Use /cotizar para bolsos personalizados o cree un workflow n8n para catálogo (N8N_WEBHOOK_URL_CATALOG).",
        },
      );
      aiLog.logGenerationEnd("TRIGGER", ids, {
        success: false,
        reason: "catalog_not_supported",
      });
      return { triggered: false, reason: "catalog_not_supported" };
    }

    if (!webhookUrl || !webhookSecret) {
      aiLog.warn("TRIGGER", "Generación IA omitida: configuración n8n incompleta", {
        ...ids,
        webhookUrlConfigured: Boolean(webhookUrl),
        webhookSecretConfigured: Boolean(webhookSecret),
      });
      aiLog.logGenerationEnd("TRIGGER", ids, {
        success: false,
        reason: "missing_config",
      });
      return { triggered: false, reason: "missing_config" };
    }

    if (!productValidation.valid) {
      aiLog.warn("TRIGGER", "customProduct inválido: n8n puede fallar al procesar", {
        ...ids,
        issues: productValidation.issues,
      });
    }

    const payload = {
      quotationId: ids.quotationId,
      solicitudId: ids.solicitudId,
    };

    try {
      aiLog.info("TRIGGER", "Disparando webhook n8n (solo custom)", {
        ...payload,
        kind,
        webhookUrl: aiLog.maskWebhookUrl(webhookUrl),
        method: "POST",
        jwtAlgorithm: "HS256",
        jwtExpiresIn: "5m",
      });

      let webhookToken;
      let jwtPayload;
      try {
        jwtPayload = {
          ...payload,
          scope: "quotation-ai",
        };
        webhookToken = jwt.sign(jwtPayload, webhookSecret, {
          algorithm: "HS256",
          expiresIn: "5m",
        });
        const decoded = jwt.decode(webhookToken);
        aiLog.info("TRIGGER", "JWT generado para n8n", {
          ...payload,
          jwtScope: decoded?.scope,
          jwtExpiresAt: decoded?.exp
            ? new Date(decoded.exp * 1000).toISOString()
            : null,
          jwtLength: webhookToken.length,
        });
      } catch (signErr) {
        aiLog.error("TRIGGER", "Error generando JWT para n8n", {
          ...payload,
          errorMessage: signErr.message,
        });
        aiLog.logGenerationEnd("TRIGGER", ids, {
          success: false,
          reason: "jwt_error",
        });
        return { triggered: false, reason: "jwt_error" };
      }

      aiLog.info("TRIGGER", "Enviando POST a n8n...", {
        ...payload,
        bodyBytes: JSON.stringify(payload).length,
      });

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${webhookToken}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      const elapsedMs = Date.now() - startedAt;
      const truncatedBody =
        responseText.length > 500
          ? `${responseText.slice(0, 500)}...[truncado]`
          : responseText;

      aiLog.info("TRIGGER", "Respuesta HTTP de n8n recibida", {
        ...payload,
        httpStatus: response.status,
        ok: response.ok,
        elapsedMs,
        responseBody: truncatedBody || "(vacío)",
        n8nStarted:
          response.ok &&
          /workflow was started|started/i.test(truncatedBody || ""),
      });

      if (!response.ok) {
        aiLog.error("TRIGGER", "n8n rechazó el webhook", {
          ...payload,
          httpStatus: response.status,
          responseBody: truncatedBody || response.statusText,
          hints:
            response.status === 401 || response.status === 403
              ? "JWT inválido o credencial JWT distinta en n8n"
              : response.status === 404
                ? "URL/path del webhook incorrecto o workflow inactivo en n8n"
                : response.status === 500
                  ? "Error interno en n8n: abrir ejecuciones fallidas en el editor"
                  : "Revisar ejecución en n8n",
        });
        aiLog.logGenerationEnd("TRIGGER", ids, {
          success: false,
          reason: "webhook_rejected",
          httpStatus: response.status,
          elapsedMs,
        });
        return { triggered: false, reason: "webhook_rejected", httpStatus: response.status };
      }

      aiLog.info("TRIGGER", "Webhook aceptado por n8n — vigilando Mongo en background", {
        ...payload,
        elapsedMs,
        watchAttempts: 12,
        watchIntervalMs: 5000,
        logFile: aiLog.getLogFilePath(),
      });

      this._watchAiQuotationCompletion(ids.quotationId, {
        solicitudId: ids.solicitudId,
      }).catch((err) => {
        aiLog.error("WATCH", "Error en vigilancia post-webhook", {
          quotationId: ids.quotationId,
          errorMessage: err.message,
        });
      });

      aiLog.logGenerationEnd("TRIGGER", ids, {
        success: true,
        reason: "webhook_accepted",
        elapsedMs,
        note: "La propuesta IA puede tardar 15-60 s. Revise logs [WATCH-1]…[WATCH-12].",
      });

      return { triggered: true };
    } catch (err) {
      aiLog.logFetchError("TRIGGER", err, {
        ...payload,
        webhookUrl: aiLog.maskWebhookUrl(webhookUrl),
        elapsedMs: Date.now() - startedAt,
      });
      aiLog.logGenerationEnd("TRIGGER", ids, {
        success: false,
        reason: "network_error",
        elapsedMs: Date.now() - startedAt,
      });
      return { triggered: false, reason: "network_error" };
    }
  }

  /**
   * Tras disparar n8n, vigila Mongo hasta que aparezca cotizada_ia o agote intentos.
   * @private
   */
  async _watchAiQuotationCompletion(
    quotationId,
    { solicitudId = null, attempts = 12, intervalMs = 5000 } = {},
  ) {
    aiLog.info("WATCH", "Iniciando vigilancia de propuesta IA en Mongo", {
      quotationId,
      solicitudId,
      attempts,
      intervalMs,
      totalWaitSeconds: (attempts * intervalMs) / 1000,
      logFile: aiLog.getLogFilePath(),
    });

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      const quotation = await this.dao.read(quotationId);
      aiLog.logQuotationState(`WATCH-${attempt}/${attempts}`, quotation, {
        elapsedSeconds: attempt * (intervalMs / 1000),
      });

      if (quotation?.status === "cotizada_ia" && quotation.aiQuotation?.amount != null) {
        await this._ensureAdminAiNotification(quotation);
        aiLog.info("WATCH", "Propuesta IA detectada y admin notificada", {
          quotationId,
          aiAmount: quotation.aiQuotation.amount,
          attempt,
          aiModel: quotation.aiQuotation.model ?? null,
        });
        aiLog.logGenerationEnd("WATCH", { quotationId, solicitudId }, {
          success: true,
          reason: "cotizada_ia_detected",
          attempt,
        });
        return true;
      }

      if (quotation?.status && quotation.status !== "pendiente") {
        aiLog.warn("WATCH", "Cotización cambió de estado sin propuesta IA completa", {
          quotationId,
          status: quotation.status,
          attempt,
          aiQuotation: quotation.aiQuotation ?? null,
        });
        aiLog.logGenerationEnd("WATCH", { quotationId, solicitudId }, {
          success: false,
          reason: "unexpected_status",
          status: quotation.status,
          attempt,
        });
        return false;
      }
    }

    const finalQuotation = await this.dao.read(quotationId);
    const finalSolicitud = solicitudId
      ? await SolicitudDAO.read(solicitudId)
      : null;

    aiLog.logQuotationState("WATCH-TIMEOUT", finalQuotation, {
      solicitudId,
    });
    if (finalSolicitud) {
      aiLog.logSolicitudForN8n("WATCH-TIMEOUT", finalSolicitud, { quotationId });
    }

    aiLog.error("WATCH", "Tiempo agotado: n8n no escribió cotizada_ia en Mongo", {
      quotationId,
      solicitudId,
      attempts,
      finalStatus: finalQuotation?.status ?? null,
      hasAiAmount: finalQuotation?.aiQuotation?.amount != null,
      hints: [
        "Abrir ejecuciones fallidas en n8n (Gemini, vector search, Mongo credentials)",
        "Confirmar que n8n usa la MISMA base Mongo que MONGO_URI del backend",
        "Verificar índice product_variant_embedding_index en MongoDB Atlas",
        "Comprobar que el nodo Mongo de n8n actualiza status=cotizada_ia y aiQuotation.amount",
        `Revisar archivo de log: ${aiLog.getLogFilePath()}`,
      ],
    });
    aiLog.logGenerationEnd("WATCH", { quotationId, solicitudId }, {
      success: false,
      reason: "watch_timeout",
      attempts,
    });
    return false;
  }

  // --- Cliente: listar mis cotizaciones ---
  async getMyQuotations(req, res) {
    try {
      const quotations = await this.dao.findByUser(req.user.id);
      return res.status(200).json(this._sanitizeQuotationsForClient(quotations));
    } catch (err) {
      console.error("getMyQuotations error:", err);
      return res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

  // --- Dueño o admin: detalle ---
  async getQuotation(req, res) {
    try {
      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const quotationUserId =
        quotation.user?._id?.toString() ||
        quotation.user?.toString() ||
        quotation.user;
      const currentUserId = req.user.id?.toString() || req.user.id;
      const isOwner = quotationUserId === currentUserId;
      const isAdmin = req.user.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "No autorizado" });
      }

      const payload =
        isAdmin ? quotation : this._sanitizeQuotationForClient(quotation);

      return res.status(200).json(payload);
    } catch (err) {
      console.error("getQuotation error:", err);
      return res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

  // --- Admin: fijar la cotización final y enviarla al cliente ---
  async setFinalQuotation(req, res) {
    try {
      const { amount, currency, notes } = req.body;

      if (amount == null) {
        return res
          .status(400)
          .json({ message: "El monto de la cotización es requerido" });
      }

      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const updated = await this.dao.update(req.params.id, {
        finalQuotation: {
          amount,
          currency: currency || "COP",
          notes,
          quotedBy: req.user.id,
          quotedAt: new Date(),
        },
        status: "cotizada",
      });

      // HU2: actualizar estado de la solicitud asociada
      if (quotation.solicitud) {
        const solicitudId =
          quotation.solicitud?._id?.toString() ||
          quotation.solicitud?.toString() ||
          quotation.solicitud;
        await SolicitudDAO.update(solicitudId, { status: "cotizada" });
      }

      const populated = await this.dao.read(req.params.id);

      await NotificationService.notifyClientQuotationSent(populated).catch(
        (err) => {
          console.error(
            `[QUOTATION] Error notificando cotización al cliente ${req.params.id}:`,
            err.message,
          );
        },
      );

      return res.status(200).json(populated);
    } catch (err) {
      console.error("setFinalQuotation error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al cotizar" });
    }
  }

  // --- Admin: guardar propuesta de IA (fase 4: por ahora almacena lo recibido) ---
  async setAiQuotation(req, res) {
    try {
      const { amount, currency, breakdown, model } = req.body;

      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const updated = await this.dao.update(req.params.id, {
        aiQuotation: {
          amount,
          currency: currency || "COP",
          breakdown,
          model,
          generatedAt: new Date(),
        },
        status: "cotizada_ia",
      });

      const populated = await this.dao.read(req.params.id);
      await this._ensureAdminAiNotification(populated);

      return res.status(200).json(populated);
    } catch (err) {
      console.error("setAiQuotation error:", err);
      return res
        .status(400)
        .json({
          message: err.message || "Error al guardar la propuesta de IA",
        });
    }
  }

  // --- Cliente: aceptar o rechazar la cotización ---
  async respondQuotation(req, res) {
    try {
      const { decision, proposedAmount, currency, notes } = req.body;

      if (!["aceptada", "rechazada", "propuesta"].includes(decision)) {
        return res
          .status(400)
          .json({ message: "La decisión debe ser 'aceptada', 'rechazada' o 'propuesta'" });
      }

      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const quotationUserId =
        quotation.user?._id?.toString() ||
        quotation.user?.toString() ||
        quotation.user;
      const currentUserId = req.user.id?.toString() || req.user.id;

      if (quotationUserId !== currentUserId) {
        return res.status(403).json({ message: "No autorizado" });
      }

      if (!["cotizada"].includes(quotation.status)) {
        return res.status(409).json({
          message:
            "Solo se puede responder una cotización en estado 'cotizada'",
        });
      }

      if (decision === "propuesta") {
        if (proposedAmount == null || Number.isNaN(Number(proposedAmount))) {
          return res.status(400).json({
            message: "Debes indicar un precio propuesto válido",
          });
        }

        const updated = await this.dao.update(req.params.id, {
          status: "en_revision",
          clientResponse: {
            decision,
            proposedAmount: Number(proposedAmount),
            currency: currency || "COP",
            notes,
            respondedBy: req.user.id,
            respondedAt: new Date(),
          },
        });

        const populatedQuotation = await this.dao.read(req.params.id);
        await NotificationService.notifyAdminClientResponse(populatedQuotation, {
          decision,
          proposedAmount: Number(proposedAmount),
          currency: currency || "COP",
          notes,
        });

        return res.status(200).json(this._sanitizeQuotationForClient(populatedQuotation));
      }

      const updated = await this.dao.update(req.params.id, {
        status: decision,
        clientResponse: {
          decision,
          currency: "COP",
          respondedBy: req.user.id,
          respondedAt: new Date(),
        },
      });

      const populatedQuotation = await this.dao.read(req.params.id);

      if (decision === "aceptada") {
        await NotificationService.sendAcceptanceEmailToClient(populatedQuotation);
      }

      await NotificationService.notifyClientStatusChanged(
        populatedQuotation,
        quotation.status,
        decision,
      );

      return res.status(200).json(this._sanitizeQuotationForClient(populatedQuotation));
    } catch (err) {
      console.error("respondQuotation error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al responder la cotización" });
    }
  }

  // --- Admin: avanzar el estado (revisión/producción) ---
  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const allowed = [
        "pendiente",
        "cotizada_ia",
        "en_revision",
        "cotizada",
        "aceptada",
        "rechazada",
        "en_produccion",
        "completada",
        "cancelada",
      ];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: `Estado no permitido. Use uno de: ${allowed.join(", ")}`,
        });
      }

      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      const previousStatus = quotation.status;
      const updated = await this.dao.update(req.params.id, { status });
      const populatedQuotation = await this.dao.read(req.params.id);

      if (previousStatus !== status) {
        if (quotation.solicitud) {
          const solicitudId =
            quotation.solicitud?._id?.toString() ||
            quotation.solicitud?.toString() ||
            quotation.solicitud;
          await SolicitudDAO.update(solicitudId, { status });
        }

        await NotificationService.notifyClientStatusChanged(
          populatedQuotation,
          previousStatus,
          status,
        );
      }

      return res.status(200).json(populatedQuotation);
    } catch (err) {
      console.error("updateStatus error:", err);
      return res
        .status(400)
        .json({ message: err.message || "Error al actualizar el estado" });
    }
  }

  // --- Admin: consultar trazabilidad solicitud ↔ cotización ---
  async getTraceability(req, res) {
    try {
      const quotation = await this.dao.read(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      let solicitud = null;
      if (quotation.solicitud) {
        const solicitudId =
          quotation.solicitud?._id?.toString() ||
          quotation.solicitud?.toString() ||
          quotation.solicitud;
        solicitud = await SolicitudDAO.read(solicitudId);
      } else {
        solicitud = await SolicitudDAO.findByQuotation(req.params.id);
      }

      const timeline = this._buildTraceabilityTimeline(quotation, solicitud);

      return res.status(200).json({
        solicitud,
        cotizacion: {
          _id: quotation._id,
          status: quotation.status,
          kind: quotation.kind,
          quantity: quotation.quantity,
          notes: quotation.notes,
          aiQuotation: quotation.aiQuotation,
          finalQuotation: quotation.finalQuotation,
          createdAt: quotation.createdAt,
          updatedAt: quotation.updatedAt,
        },
        cliente: quotation.user,
        producto: quotation.product,
        timeline,
        integridad: {
          solicitudVinculada: !!solicitud,
          cotizacionVinculada: !!solicitud?.quotation,
          idsCoinciden:
            solicitud?.quotation?.toString() === quotation._id.toString() ||
            solicitud?.quotation?._id?.toString() === quotation._id.toString(),
        },
      });
    } catch (err) {
      console.error("getTraceability error:", err);
      return res
        .status(500)
        .json({ message: "Error al consultar trazabilidad" });
    }
  }

  _buildTraceabilityTimeline(quotation, solicitud) {
    const timeline = [];

    if (solicitud?.createdAt) {
      timeline.push({
        event: "solicitud_creada",
        date: solicitud.createdAt,
        description:
          `Solicitud ${solicitud.code || ""} registrada por el cliente`.trim(),
      });
    } else if (quotation.createdAt) {
      timeline.push({
        event: "solicitud_creada",
        date: quotation.createdAt,
        description: "Solicitud registrada por el cliente",
      });
    }

    if (quotation.aiQuotation?.generatedAt) {
      timeline.push({
        event: "cotizacion_ia",
        date: quotation.aiQuotation.generatedAt,
        description: "Propuesta de cotización generada por IA",
      });
    }

    if (quotation.finalQuotation?.quotedAt) {
      timeline.push({
        event: "cotizacion_final",
        date: quotation.finalQuotation.quotedAt,
        description: "Cotización final enviada por la administradora",
      });
    }

    if (quotation.clientResponse?.respondedAt) {
      timeline.push({
        event: "respuesta_cliente",
        date: quotation.clientResponse.respondedAt,
        description:
          quotation.clientResponse.decision === "propuesta"
            ? `El cliente propuso un nuevo valor de ${quotation.clientResponse.proposedAmount}`
            : `Cotización ${quotation.clientResponse.decision} por el cliente`,
      });
    }

    if (quotation.status === "aceptada") {
      timeline.push({
        event: "aceptada",
        date: quotation.updatedAt,
        description: "Cotización aceptada por el cliente",
      });
    }

    if (quotation.status === "rechazada") {
      timeline.push({
        event: "rechazada",
        date: quotation.updatedAt,
        description: "Cotización rechazada por el cliente",
      });
    }

    if (
      ["en_produccion", "completada", "cancelada"].includes(quotation.status)
    ) {
      timeline.push({
        event: quotation.status,
        date: quotation.updatedAt,
        description: `Estado actualizado a: ${quotation.status}`,
      });
    }

    return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // --- Admin: listar cotizaciones y detectar propuestas IA pendientes de notificar ---
  async getAll(req, res) {
    try {
      const items = await this.dao.getAll(req.query);

      items
        .filter(
          (quotation) =>
            quotation.status === "cotizada_ia" &&
            quotation.aiQuotation?.amount != null &&
            !quotation.aiQuotation?.adminNotifiedAt,
        )
        .forEach((quotation) => {
          aiLog.info("POLL", "Cotización IA detectada sin notificar al admin", {
            quotationId: quotation._id?.toString?.() || quotation._id,
            aiAmount: quotation.aiQuotation?.amount,
          });
          this._ensureAdminAiNotification(quotation).catch((err) => {
            aiLog.error("POLL", "Error notificando IA en listado admin", {
              quotationId: quotation._id?.toString?.() || quotation._id,
              errorMessage: err.message,
            });
          });
        });

      const pendingAi = items.filter(
        (quotation) =>
          quotation.status === "pendiente" && !quotation.aiQuotation?.amount,
      );

      if (pendingAi.length > 0) {
        aiLog.warn("POLL", "Hay cotizaciones pendientes sin propuesta IA", {
          count: pendingAi.length,
          sampleIds: pendingAi.slice(0, 5).map((q) => q._id?.toString?.() || q._id),
          hint: "Revise ejecuciones en n8n y logs [QUOTATION][AI][TRIGGER]",
        });
      }

      return res.status(200).json(items);
    } catch (err) {
      console.error("getAll quotations error:", err);
      return res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

  // --- Webhook n8n: IA terminó de generar la cotización ---
  async onAiQuotationReady(req, res) {
    try {
      const quotationId =
        req.body?.quotationId || req.webhookPayload?.quotationId;

      aiLog.info("CALLBACK", "Callback ai-ready recibido desde n8n", {
        quotationId: quotationId || null,
        bodyKeys: Object.keys(req.body || {}),
        tokenQuotationId: req.webhookPayload?.quotationId || null,
        tokenSolicitudId: req.webhookPayload?.solicitudId || null,
      });

      if (!quotationId) {
        aiLog.warn("CALLBACK", "Callback rechazado: quotationId ausente");
        return res.status(400).json({ message: "quotationId es requerido" });
      }

      const quotation = await this.dao.read(quotationId);
      if (!quotation) {
        aiLog.warn("CALLBACK", "Callback rechazado: cotización no existe", {
          quotationId,
        });
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      aiLog.logQuotationState("CALLBACK-BEFORE-NOTIFY", quotation);

      const notified = await this._ensureAdminAiNotification(quotation);

      const populated = await this.dao.read(quotationId);
      aiLog.logQuotationState("CALLBACK-AFTER-NOTIFY", populated, {
        adminNotificationSent: notified === true,
      });

      return res.status(200).json({
        ok: true,
        quotationId,
        status: populated.status,
        notified: !!populated.aiQuotation?.adminNotifiedAt,
      });
    } catch (err) {
      aiLog.error("CALLBACK", "Error procesando callback ai-ready", {
        errorMessage: err.message,
      });
      return res
        .status(400)
        .json({ message: err.message || "Error procesando webhook de IA" });
    }
  }

  async _ensureAdminAiNotification(quotation) {
    if (!quotation?._id) {
      aiLog.warn("NOTIFY", "Sin notificación IA: cotización inválida");
      return null;
    }

    if (quotation.status !== "cotizada_ia") {
      aiLog.warn("NOTIFY", "Sin notificación IA: estado incorrecto", {
        quotationId: quotation._id?.toString?.() || quotation._id,
        status: quotation.status,
        expectedStatus: "cotizada_ia",
        hint:
          quotation.status === "pendiente"
            ? "n8n aún no actualizó la cotización en Mongo"
            : "Verifique nodo 'Update documents1' en n8n",
      });
      return null;
    }

    if (quotation.aiQuotation?.amount == null) {
      aiLog.warn("NOTIFY", "Sin notificación IA: falta aiQuotation.amount", {
        quotationId: quotation._id?.toString?.() || quotation._id,
        aiQuotation: quotation.aiQuotation || null,
        hint: "El flujo n8n no guardó precio_sugerido en aiQuotation",
      });
      return null;
    }

    if (quotation.aiQuotation?.adminNotifiedAt) {
      aiLog.info("NOTIFY", "Notificación IA ya enviada previamente", {
        quotationId: quotation._id?.toString?.() || quotation._id,
        adminNotifiedAt: quotation.aiQuotation.adminNotifiedAt,
      });
      return null;
    }

    const populated = await this.dao.read(quotation._id);
    await NotificationService.notifyAdminAiQuotationReady(populated);

    await this.dao.update(quotation._id, {
      aiQuotation: {
        ...populated.aiQuotation,
        adminNotifiedAt: new Date(),
      },
    });

    aiLog.info("NOTIFY", "Administradora notificada sobre propuesta IA", {
      quotationId: quotation._id?.toString?.() || quotation._id,
      aiAmount: populated.aiQuotation?.amount,
    });

    return true;
  }

  async _isAdmin(userId) {
    const user = await UserDAO.read(userId);
    return !!(user && user.isAdmin);
  }
}

module.exports = new QuotationController();
