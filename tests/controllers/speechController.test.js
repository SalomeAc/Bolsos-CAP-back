jest.mock("../../api/services/azureSpeechService");
jest.mock("microsoft-cognitiveservices-speech-sdk", () => ({
  SpeechConfig: {
    fromSubscription: jest.fn(() => ({})),
  },
  SpeechSynthesizer: jest.fn(),
  ResultReason: {
    SynthesizingAudioCompleted: "SynthesizingAudioCompleted",
  },
}));

const speechController = require("../../api/controllers/speechController");
const { issueSpeechToken } = require("../../api/services/azureSpeechService");

describe("speechController (HU-34–38)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getSpeechToken", () => {
    it("retorna token cuando el servicio responde", async () => {
      issueSpeechToken.mockResolvedValue({
        token: "abc",
        region: "eastus",
        expiresIn: 600,
      });

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await speechController.getSpeechToken({}, res);

      expect(res.json).toHaveBeenCalledWith({
        token: "abc",
        region: "eastus",
        expiresIn: 600,
      });
    });

    it("retorna 500 si falla la emisión del token", async () => {
      issueSpeechToken.mockRejectedValue(
        new Error("Azure Speech no está configurado en el servidor."),
      );

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await speechController.getSpeechToken({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Azure Speech no está configurado en el servidor.",
      });
    });
  });

  describe("textToSpeech", () => {
    it("retorna 400 si no se envía texto", async () => {
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        set: jest.fn(),
        send: jest.fn(),
      };

      await speechController.textToSpeech({ body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Texto requerido" });
    });

    it("sintetiza audio cuando Azure responde", async () => {
      const sdk = require("microsoft-cognitiveservices-speech-sdk");
      const close = jest.fn();
      sdk.SpeechSynthesizer.mockImplementation(() => ({
        speakTextAsync: jest.fn((text, onResult) => {
          onResult({
            reason: sdk.ResultReason.SynthesizingAudioCompleted,
            audioData: new Uint8Array([1, 2, 3]).buffer,
          });
        }),
        close,
      }));

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        set: jest.fn(),
        send: jest.fn(),
      };

      await speechController.textToSpeech({ body: { text: "Hola" } }, res);

      expect(res.set).toHaveBeenCalledWith({ "Content-Type": "audio/wav" });
      expect(res.send).toHaveBeenCalled();
      expect(close).toHaveBeenCalled();
    });

    it("retorna 500 si falla la síntesis", async () => {
      const sdk = require("microsoft-cognitiveservices-speech-sdk");
      sdk.SpeechSynthesizer.mockImplementation(() => ({
        speakTextAsync: jest.fn((text, onResult, onError) => {
          onError("Azure error");
        }),
        close: jest.fn(),
      }));

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        set: jest.fn(),
        send: jest.fn(),
      };

      await speechController.textToSpeech({ body: { text: "Hola" } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Azure error" });
    });

    it("maneja error al configurar Azure", async () => {
      const sdk = require("microsoft-cognitiveservices-speech-sdk");
      sdk.SpeechConfig.fromSubscription.mockImplementation(() => {
        throw new Error("Config error");
      });

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        set: jest.fn(),
        send: jest.fn(),
      };

      await speechController.textToSpeech({ body: { text: "Hola" } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Config error" });
    });
  });
});
