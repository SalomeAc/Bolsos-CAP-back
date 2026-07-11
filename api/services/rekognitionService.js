require("dotenv").config();

const {
  RekognitionClient,
  DetectModerationLabelsCommand,
  DetectLabelsCommand,
} = require("@aws-sdk/client-rekognition");

const client = new RekognitionClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BAG_LABELS = [
  "bag",
  "handbag",
  "purse",
  "backpack",
  "briefcase",
  "luggage",
  "suitcase",
  "tote bag",
  "shopping bag",
  "satchel",
  "duffel bag",
  "wallet",
];

async function validateImage(buffer) {
  console.log("[Rekognition] Iniciando validación de imagen", {
    bufferLength: buffer?.length || 0,
    hasCredentials: Boolean(
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY,
    ),
  });

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("La imagen es obligatoria.");
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "No hay credenciales de AWS configuradas para Rekognition.",
    );
  }

  const moderation = await client.send(
    new DetectModerationLabelsCommand({
      Image: {
        Bytes: buffer,
      },
      MinConfidence: 70,
    }),
  );

  console.log(
    "[Rekognition] Moderation labels",
    moderation.ModerationLabels || [],
  );

  const hasInappropriateContent = (moderation.ModerationLabels || []).some(
    (label) => (label.Confidence || 0) >= 70,
  );

  if (hasInappropriateContent) {
    throw new Error("La imagen contiene contenido inapropiado.");
  }

  const labelsResponse = await client.send(
    new DetectLabelsCommand({
      Image: {
        Bytes: buffer,
      },
      MaxLabels: 20,
      MinConfidence: 80,
    }),
  );

  const detected = (labelsResponse.Labels || [])
    .filter((label) => (label.Confidence || 0) >= 80)
    .map((label) => String(label.Name || "").toLowerCase());

  console.log("[Rekognition] Etiquetas detectadas", detected);

  const hasBag = detected.some((label) =>
    BAG_LABELS.some(
      (bagLabel) =>
        label === bagLabel ||
        label.includes(bagLabel) ||
        bagLabel.includes(label),
    ),
  );

  if (!hasBag) {
    throw new Error("La imagen no parece contener un bolso.");
  }

  return true;
}

module.exports = {
  validateImage,
};
