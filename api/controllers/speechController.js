// lógica de Azure Speech

const sdk = require("microsoft-cognitiveservices-speech-sdk");

exports.textToSpeech = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        message: "Texto requerido",
      });
    }

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.VITE_AZURE_KEY,
      process.env.VITE_AZURE_REGION
    );

    // Voz femenina colombiana
    speechConfig.speechSynthesisVoiceName = "es-CO-SalomeNeural";

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    synthesizer.speakTextAsync(
      text,

      (result) => {
        if (
          result.reason ===
          sdk.ResultReason.SynthesizingAudioCompleted
        ) {
          res.set({
            "Content-Type": "audio/wav",
          });

          res.send(Buffer.from(result.audioData));
        }

        synthesizer.close();
      },

      (error) => {
        synthesizer.close();

        res.status(500).json({
          message: error,
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};