const jwt = require("jsonwebtoken");
const aiLog = require("../utils/aiWorkflowLogger");

/**
 * Valida el JWT emitido por el backend para callbacks del flujo n8n de IA.
 */
module.exports = function verifyN8nWebhook(req, res, next) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    aiLog.error("AUTH", "Callback ai-ready rechazado: N8N_WEBHOOK_SECRET no configurado");
    return res.status(503).json({ message: "Webhook de IA no configurado" });
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    aiLog.warn("AUTH", "Callback ai-ready rechazado: falta Authorization Bearer");
    return res.status(401).json({ message: "Token de webhook requerido" });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

    if (decoded.scope !== "quotation-ai") {
      aiLog.warn("AUTH", "Callback ai-ready rechazado: scope inválido", {
        scope: decoded.scope,
      });
      return res.status(403).json({ message: "Scope de webhook inválido" });
    }

    req.webhookPayload = decoded;
    aiLog.info("AUTH", "JWT de callback n8n validado", {
      quotationId: decoded.quotationId || null,
      solicitudId: decoded.solicitudId || null,
    });
    return next();
  } catch (err) {
    aiLog.warn("AUTH", "Callback ai-ready rechazado: JWT inválido o expirado", {
      errorMessage: err.message,
    });
    return res.status(401).json({ message: "Token de webhook inválido" });
  }
};
