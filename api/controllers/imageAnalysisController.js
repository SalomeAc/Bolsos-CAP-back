const imageAnalysisService = require("../services/imageAnalysisService");

async function analyzeImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "No se recibió ninguna imagen" });
  }

  try {
    const analysis = await imageAnalysisService.analyzeImageBuffer(req.file.buffer);
    return res.json({ success: true, analysis });
  } catch (err) {
    console.error("Image analysis error:", err);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.message || "Error al analizar la imagen",
      detail: err.detail,
    });
  }
}

module.exports = {
  analyzeImage,
};
