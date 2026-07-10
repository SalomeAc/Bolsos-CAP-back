const {
  RekognitionClient,
  DetectLabelsCommand,
} = require("@aws-sdk/client-rekognition");
const {
  translateLabel,
  translateColorLabel,
  translateNamedItems,
  translateLabelWithParents,
} = require("../utils/labelTranslations");

const BAG_TYPES = [
  "Handbag", "Purse", "Backpack", "Tote Bag", "Clutch", "Wallet",
  "Satchel", "Briefcase", "Messenger Bag", "Shoulder Bag", "Belt Bag",
  "Bucket Bag", "Crossbody Bag", "Duffle Bag", "Fanny Pack", "Hobo Bag",
  "Luggage", "Suitcase", "Diaper Bag", "Gym Bag", "Bag",
];

const ACCESSORY_KEYWORDS = [
  "Zipper", "Buckle", "Handle", "Strap", "Chain", "Clasp", "Lock",
  "Hardware", "Lining", "Pocket", "Tassel", "Charm", "Hook",
  "Metal", "Gold", "Silver", "Leather", "Canvas", "Logo", "Brand",
  "Monogram", "Embroidery", "Stud", "Rivet", "Fringe", "Bow",
  "Button", "Velcro", "Magnetic", "Snap", "Bead",
];

const COLOR_KEYWORDS = [
  "Red", "Blue", "Green", "Yellow", "Orange", "Purple", "Pink",
  "Black", "White", "Gray", "Grey", "Brown", "Beige", "Tan", "Cream",
  "Gold", "Silver", "Navy", "Teal", "Maroon", "Burgundy", "Khaki",
  "Ivory", "Nude", "Camel", "Cognac", "Chocolate", "Blush", "Coral",
  "Lavender", "Mint", "Turquoise", "Cobalt", "Emerald", "Olive",
  "Rust", "Mustard", "Fuchsia", "Magenta", "Scarlet", "Crimson",
];

const SIZE_KEYWORDS = [
  "Mini", "Micro", "Small", "Medium", "Large", "Oversized",
  "Compact", "Jumbo", "Petite", "Big",
];

const MATERIAL_KEYWORDS = [
  "Leather", "Suede", "Canvas", "Fabric", "Nylon", "Velvet",
  "Patent", "Woven", "Straw", "Denim", "Polyester", "Cotton",
  "Synthetic", "Fur", "Satin", "Silk", "Yarn", "Knitwear",
];

let rekognitionClient = null;

function getRekognitionClient() {
  if (!rekognitionClient) {
    rekognitionClient = new RekognitionClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return rekognitionClient;
}

function matchesKeywords(labelName, keywords) {
  return keywords.some(
    (kw) =>
      labelName.toLowerCase().includes(kw.toLowerCase()) ||
      kw.toLowerCase().includes(labelName.toLowerCase()),
  );
}

function extractColorsFromLabels(labels) {
  const colorLabels = labels.filter((l) =>
    matchesKeywords(l.Name, COLOR_KEYWORDS),
  );

  const colorFromParents = labels.filter((l) => {
    const parents = (l.Parents || []).map((p) => p.Name);
    return parents.some((p) => p === "Color" || p === "Colors");
  });

  const combined = [...colorLabels, ...colorFromParents];
  const unique = Array.from(new Map(combined.map((c) => [c.Name, c])).values());

  return unique
    .sort((a, b) => b.Confidence - a.Confidence)
    .slice(0, 6)
    .map((l) => ({
      name: translateColorLabel(l.Name),
      confidence: Math.round(l.Confidence),
      source: "label",
      hexCode: null,
    }));
}

function extractDominantColors(imageProperties) {
  if (!imageProperties) return [];

  const raw =
    imageProperties.Foreground?.DominantColors ||
    imageProperties.DominantColors ||
    [];

  return raw
    .filter((c) => (c.PixelPercent || 0) >= 1)
    .sort((a, b) => (b.PixelPercent || 0) - (a.PixelPercent || 0))
    .slice(0, 6)
    .map((c) => ({
      name: translateColorLabel(
        c.CSSColor || c.SimplifiedColor || c.HexCode || "Unknown",
      ),
      confidence: Math.round(c.PixelPercent || 0),
      source: "dominant",
      hexCode: c.HexCode || null,
    }));
}

function normalizeColorName(name) {
  return (name || "").toLowerCase();
}

function mergeColors(labelColors, dominantColors) {
  const merged = [...labelColors];
  const seen = new Set(labelColors.map((c) => normalizeColorName(c.name)));

  for (const dc of dominantColors) {
    const key = normalizeColorName(dc.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(dc);
  }

  return merged
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);
}

function extractBagType(labels) {
  const bagLabels = labels.filter((l) => matchesKeywords(l.Name, BAG_TYPES));
  return bagLabels
    .sort((a, b) => b.Confidence - a.Confidence)
    .slice(0, 3)
    .map((l) => ({
      name: translateLabel(l.Name),
      confidence: Math.round(l.Confidence),
    }));
}

function extractAccessories(labels) {
  const accLabels = labels.filter(
    (l) =>
      matchesKeywords(l.Name, ACCESSORY_KEYWORDS) &&
      !matchesKeywords(l.Name, BAG_TYPES) &&
      !matchesKeywords(l.Name, COLOR_KEYWORDS),
  );
  return accLabels
    .sort((a, b) => b.Confidence - a.Confidence)
    .slice(0, 8)
    .map((l) => ({
      name: translateLabel(l.Name),
      confidence: Math.round(l.Confidence),
    }));
}

function extractSize(labels) {
  const sizeLabels = labels.filter((l) =>
    matchesKeywords(l.Name, SIZE_KEYWORDS),
  );

  if (sizeLabels.length > 0) {
    return sizeLabels
      .sort((a, b) => b.Confidence - a.Confidence)
      .slice(0, 2)
      .map((l) => ({
        name: translateLabel(l.Name),
        confidence: Math.round(l.Confidence),
      }));
  }

  const allNames = labels.map((l) => l.Name.toLowerCase()).join(" ");
  if (allNames.includes("mini") || allNames.includes("micro")) {
    return [{ name: "Mini", confidence: 70 }];
  }
  if (allNames.includes("clutch") || allNames.includes("wallet")) {
    return [{ name: "Pequeño", confidence: 75 }];
  }
  if (allNames.includes("backpack") || allNames.includes("duffel")) {
    return [{ name: "Grande", confidence: 75 }];
  }
  if (allNames.includes("tote") || allNames.includes("shoulder")) {
    return [{ name: "Mediano-Grande", confidence: 70 }];
  }

  return [{ name: "Mediano", confidence: 60 }];
}

function extractMaterial(labels) {
  const matLabels = labels.filter((l) =>
    matchesKeywords(l.Name, MATERIAL_KEYWORDS),
  );
  return matLabels
    .sort((a, b) => b.Confidence - a.Confidence)
    .slice(0, 3)
    .map((l) => ({
      name: translateLabel(l.Name),
      confidence: Math.round(l.Confidence),
    }));
}

function buildAnalysis(labels, imageProperties) {
  const labelColors = extractColorsFromLabels(labels);
  const dominantColors = extractDominantColors(imageProperties);
  const colors = mergeColors(labelColors, dominantColors);

  return {
    bagTypes: extractBagType(labels),
    colors,
    accessories: extractAccessories(labels),
    size: extractSize(labels),
    materials: extractMaterial(labels),
    allLabels: labels
      .sort((a, b) => b.Confidence - a.Confidence)
      .slice(0, 20)
      .map((l) =>
        translateLabelWithParents({
          name: l.Name,
          confidence: Math.round(l.Confidence),
          parents: (l.Parents || []).map((p) => p.Name),
        }),
      ),
    imageInfo: {
      quality: imageProperties?.Quality
        ? {
            brightness: Math.round(imageProperties.Quality.Brightness || 0),
            sharpness: Math.round(imageProperties.Quality.Sharpness || 0),
            contrast: Math.round(imageProperties.Quality.Contrast || 0),
          }
        : null,
      dominantColors: translateNamedItems(dominantColors),
    },
  };
}

function mapRekognitionError(err) {
  let message = "Error al analizar la imagen con AWS Rekognition";
  if (err.name === "InvalidImageException") {
    message = "La imagen no es válida o está corrupta";
  } else if (
    err.name === "AccessDeniedException" ||
    err.name === "NotAuthorizedException"
  ) {
    message = "Credenciales de AWS no válidas o sin permisos para Rekognition";
  } else if (err.name === "ThrottlingException") {
    message = "Demasiadas solicitudes a AWS. Intenta de nuevo en un momento";
  }
  return message;
}

async function analyzeImageBuffer(imageBuffer) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    const error = new Error("Credenciales de AWS no configuradas en el servidor");
    error.statusCode = 503;
    throw error;
  }

  const command = new DetectLabelsCommand({
    Image: { Bytes: imageBuffer },
    MaxLabels: 100,
    MinConfidence: 50,
    Features: ["GENERAL_LABELS", "IMAGE_PROPERTIES"],
    Settings: {
      ImageProperties: {
        MaxDominantColors: 10,
      },
    },
  });

  try {
    const response = await getRekognitionClient().send(command);
    const labels = response.Labels || [];
    const imageProperties = response.ImageProperties;
    return buildAnalysis(labels, imageProperties);
  } catch (err) {
    const message = mapRekognitionError(err);
    const error = new Error(message);
    error.statusCode = 500;
    error.detail = err.message;
    throw error;
  }
}

module.exports = {
  analyzeImageBuffer,
};
