const fs = require("fs");
const path = require("path");

const PREFIX = "[QUOTATION][AI]";
const LOG_FILE = path.join(process.cwd(), "logs", "ai-quotation.log");

function maskWebhookUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url).replace(/\/\/[^/]+/, "//***");
  }
}

function maskMongoUri(uri) {
  if (!uri) return null;

  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname?.replace(/^\//, "") || null;
    return `${parsed.protocol}//${parsed.hostname}${dbName ? `/${dbName}` : ""}`;
  } catch {
    return "[mongo-uri-no-parseable]";
  }
}

function serializeMeta(meta = {}) {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }

  try {
    return ` | ${JSON.stringify(meta)}`;
  } catch {
    return " | [meta no serializable]";
  }
}

function appendToLogFile(line) {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, `${line}\n`, "utf8");
  } catch (err) {
    console.warn(`${PREFIX}[LOGGER] No se pudo escribir en ${LOG_FILE}: ${err.message}`);
  }
}

function write(level, step, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${PREFIX}[${step}] ${message}${serializeMeta(meta)}`;

  if (level === "error") {
    console.error(line);
    appendToLogFile(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    appendToLogFile(line);
    return;
  }

  console.log(line);
  appendToLogFile(line);
}

function logConfigStatus() {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  const mongoUri = process.env.MONGO_URI;

  let hint = "Integración lista para disparar el webhook de n8n.";

  if (!webhookUrl) {
    hint =
      "Defina N8N_WEBHOOK_URL en .env. Ejemplo: https://tu-n8n/webhook/cotizacion-personalizada";
  } else if (!webhookSecret) {
    hint =
      "N8N_WEBHOOK_SECRET no está definido. El JWT fallará y n8n responderá 401/403.";
  }

  write("info", "CONFIG", "Estado de integración con n8n", {
    webhookUrlConfigured: Boolean(webhookUrl),
    webhookUrl: maskWebhookUrl(webhookUrl),
    webhookSecretConfigured: Boolean(webhookSecret),
    mongoUriConfigured: Boolean(mongoUri),
    mongoTarget: maskMongoUri(mongoUri),
    logFile: LOG_FILE,
    hint,
    n8nChecklist: [
      "Workflow activo en n8n (toggle Active = ON)",
      "Path del webhook coincide con N8N_WEBHOOK_URL",
      "Credencial JWT en n8n usa el mismo N8N_WEBHOOK_SECRET",
      "n8n puede escribir en Mongo y opcionalmente llamar POST /api/quotations/webhook/ai-ready",
      "n8n debe usar la MISMA base Mongo que MONGO_URI del backend",
    ],
  });
}

function validateCustomProductForN8n(customProduct = {}) {
  const dimensions = customProduct.dimensions?.trim?.() || customProduct.dimensions || "";
  const dimensionPattern = /^\d+(?:\.\d+)?x\d+(?:\.\d+)?x\d+(?:\.\d+)?$/i;
  const issues = [];

  if (!customProduct.color) {
    issues.push("Falta customProduct.color");
  }
  if (!customProduct.materials?.length) {
    issues.push("Falta customProduct.materials (array con al menos un material)");
  }
  if (!dimensions) {
    issues.push("Faltan customProduct.dimensions");
  } else if (!dimensionPattern.test(String(dimensions).replace(/\s+/g, ""))) {
    issues.push(
      `Dimensiones "${dimensions}" no cumplen formato n8n (ej. 20x15x10, sin espacios)`,
    );
  }
  if (!customProduct.description) {
    issues.push("Falta customProduct.description");
  }

  return {
    valid: issues.length === 0,
    issues,
    snapshot: {
      description: customProduct.description ?? null,
      color: customProduct.color ?? null,
      dimensions,
      materials: customProduct.materials ?? [],
      hasPhoto: Boolean(customProduct.photo),
    },
  };
}

function logSolicitudForN8n(step, solicitud, extra = {}) {
  if (!solicitud) {
    write("warn", step, "Solicitud no encontrada en Mongo (n8n no podrá leer customProduct)", extra);
    return { valid: false, issues: ["solicitud_null"] };
  }

  const validation = validateCustomProductForN8n(solicitud.customProduct);

  write(validation.valid ? "info" : "warn", step, "Datos de solicitud que n8n leerá de Mongo", {
    solicitudId: solicitud._id?.toString?.() || solicitud._id,
    quotationId:
      solicitud.quotation?._id?.toString?.() ||
      solicitud.quotation?.toString?.() ||
      solicitud.quotation ||
      null,
    kind: solicitud.kind,
    status: solicitud.status,
    customProductValid: validation.valid,
    customProductIssues: validation.issues,
    customProduct: validation.snapshot,
    ...extra,
  });

  return validation;
}

function logGenerationStart(step, ids, extra = {}) {
  write("info", step, "========== INICIO GENERACIÓN COTIZACIÓN IA ==========", {
    ...ids,
    mongoTarget: maskMongoUri(process.env.MONGO_URI),
    webhookUrl: maskWebhookUrl(process.env.N8N_WEBHOOK_URL),
    logFile: LOG_FILE,
    ...extra,
  });
}

function logGenerationEnd(step, ids, outcome, extra = {}) {
  write(outcome.success ? "info" : "error", step, "========== FIN GENERACIÓN COTIZACIÓN IA ==========", {
    ...ids,
    ...outcome,
    ...extra,
  });
}

function logQuotationState(step, quotation, extra = {}) {
  if (!quotation) {
    write("warn", step, "No se pudo inspeccionar la cotización (documento null)", extra);
    return;
  }

  const hasAiAmount = quotation.aiQuotation?.amount != null;
  let diagnosis = "Estado intermedio";

  if (quotation.status === "pendiente" && !hasAiAmount) {
    diagnosis =
      "Sin propuesta IA aún. n8n no terminó, el workflow está inactivo o falló antes de actualizar Mongo.";
  } else if (quotation.status === "cotizada_ia" && hasAiAmount) {
    diagnosis = "Propuesta IA registrada en Mongo.";
  } else if (quotation.status === "en_revision" && !hasAiAmount) {
    diagnosis =
      "Marcada en revisión sin monto IA. Revisar salida del nodo 'Datos update quotation' en n8n.";
  }

  write("info", step, "Inspección de cotización", {
    quotationId: quotation._id?.toString?.() || quotation._id,
    solicitudId:
      quotation.solicitud?._id?.toString?.() || quotation.solicitud || null,
    kind: quotation.kind,
    status: quotation.status,
    hasAiQuotation: Boolean(quotation.aiQuotation),
    aiAmount: quotation.aiQuotation?.amount ?? null,
    aiGeneratedAt: quotation.aiQuotation?.generatedAt ?? null,
    aiModel: quotation.aiQuotation?.model ?? null,
    adminNotifiedAt: quotation.aiQuotation?.adminNotifiedAt ?? null,
    diagnosis,
    ...extra,
  });
}

function logFetchError(step, err, meta = {}) {
  write("error", step, "Fallo de red o conexión al llamar n8n", {
    ...meta,
    errorName: err?.name,
    errorMessage: err?.message,
    errorCode: err?.cause?.code || err?.code || null,
    likelyCause:
      err?.cause?.code === "ENOTFOUND"
        ? "URL de n8n incorrecta o DNS no resuelve"
        : err?.cause?.code === "ECONNREFUSED"
          ? "n8n no está escuchando en esa URL/puerto"
          : err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT"
            ? "Timeout conectando con n8n"
            : "Revisar URL, firewall y que el workflow esté activo",
  });
}

module.exports = {
  info: (step, message, meta) => write("info", step, message, meta),
  warn: (step, message, meta) => write("warn", step, message, meta),
  error: (step, message, meta) => write("error", step, message, meta),
  logConfigStatus,
  logQuotationState,
  logSolicitudForN8n,
  logGenerationStart,
  logGenerationEnd,
  logFetchError,
  maskWebhookUrl,
  maskMongoUri,
  validateCustomProductForN8n,
  getLogFilePath: () => LOG_FILE,
};
