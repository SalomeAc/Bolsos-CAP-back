const { issueSpeechToken } = require("../../api/services/azureSpeechService");

describe("azureSpeechService (HU-34–38)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.AZURE_SPEECH_KEY;
    delete process.env.AZURE_SPEECH_REGION;
  });

  it("lanza error si Azure Speech no está configurado", async () => {
    await expect(issueSpeechToken()).rejects.toThrow(
      "Azure Speech no está configurado en el servidor.",
    );
  });

  it("emite token cuando la API de Azure responde correctamente", async () => {
    process.env.AZURE_SPEECH_KEY = "test-key";
    process.env.AZURE_SPEECH_REGION = "eastus";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => "mock-token-value",
    });

    const payload = await issueSpeechToken();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Ocp-Apim-Subscription-Key": "test-key",
        }),
      }),
    );
    expect(payload).toEqual({
      token: "mock-token-value",
      region: "eastus",
      expiresIn: 600,
    });
  });

  it("lanza error si Azure rechaza la solicitud de token", async () => {
    process.env.AZURE_SPEECH_KEY = "bad-key";
    process.env.AZURE_SPEECH_REGION = "eastus";

    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    await expect(issueSpeechToken()).rejects.toThrow(
      "No se pudo emitir el token de Azure Speech.",
    );
  });
});
