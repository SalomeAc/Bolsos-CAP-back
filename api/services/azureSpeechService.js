async function issueSpeechToken() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!key || !region) {
    throw new Error("Azure Speech no está configurado en el servidor.");
  }

  const response = await fetch(
    `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo emitir el token de Azure Speech.");
  }

  const token = await response.text();

  return {
    token,
    region,
    expiresIn: 600, // 10 minutos
  };
}

module.exports = { issueSpeechToken };