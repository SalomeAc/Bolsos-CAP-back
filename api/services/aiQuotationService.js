const jwt = require("jsonwebtoken");

const WEBHOOK_TIMEOUT_MS = 15000;
const WEBHOOK_JWT_EXPIRES_IN = "5m";

/**
 * Dispara el flujo de n8n para generar una cotización sugerida por IA.
 * Fire-and-forget: los errores se capturan y loguean sin propagarse.
 * @param {string|import("mongoose").Types.ObjectId} solicitudId
 */
async function triggerAIQuotation(solicitudId) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    console.warn(
      "[AI_QUOTATION] N8N_WEBHOOK_URL o N8N_WEBHOOK_SECRET no configurados; se omite el webhook"
    );
    return;
  }

  const id = solicitudId?.toString?.() || solicitudId;

  try {
    console.log(`[AI_QUOTATION] Disparando webhook n8n para solicitud ${id}`);

    const token = jwt.sign(
      { solicitudId: id },
      webhookSecret,
      {
        expiresIn: WEBHOOK_JWT_EXPIRES_IN,
        issuer: "bolsos-cap-backend",
        algorithm: "HS256",
      }
    );

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ solicitudId: id }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[AI_QUOTATION] Webhook n8n respondió ${response.status} para solicitud ${id}` +
          (body ? `: ${body}` : "")
      );
      return;
    }

    console.log(`[AI_QUOTATION] Webhook n8n aceptado para solicitud ${id}`);
  } catch (err) {
    const reason =
      err.name === "TimeoutError" || err.name === "AbortError"
        ? "timeout"
        : err.message;

    console.error(
      `[AI_QUOTATION] Error al llamar webhook n8n para solicitud ${id}:`,
      reason
    );
  }
}

module.exports = { triggerAIQuotation };
