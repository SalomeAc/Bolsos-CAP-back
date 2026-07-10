const { triggerAIQuotation } = require("../../api/services/aiQuotationService");

describe("aiQuotationService", () => {
  const originalUrl = process.env.N8N_WEBHOOK_URL;
  const originalSecret = process.env.N8N_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env.N8N_WEBHOOK_URL = originalUrl;
    process.env.N8N_WEBHOOK_SECRET = originalSecret;
  });

  it("omite webhook si no hay configuración", async () => {
    delete process.env.N8N_WEBHOOK_URL;
    delete process.env.N8N_WEBHOOK_SECRET;

    await triggerAIQuotation("s1");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dispara webhook con JWT cuando está configurado", async () => {
    process.env.N8N_WEBHOOK_URL = "https://n8n.example/webhook";
    process.env.N8N_WEBHOOK_SECRET = "secret";
    global.fetch.mockResolvedValue({ ok: true });

    await triggerAIQuotation("solicitud-123");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://n8n.example/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
        body: JSON.stringify({ solicitudId: "solicitud-123" }),
      }),
    );
  });

  it("no lanza si el webhook responde error", async () => {
    process.env.N8N_WEBHOOK_URL = "https://n8n.example/webhook";
    process.env.N8N_WEBHOOK_SECRET = "secret";
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "error",
    });

    await expect(triggerAIQuotation("s1")).resolves.toBeUndefined();
  });

  it("no lanza si fetch falla por timeout", async () => {
    process.env.N8N_WEBHOOK_URL = "https://n8n.example/webhook";
    process.env.N8N_WEBHOOK_SECRET = "secret";
    const timeoutError = new Error("timeout");
    timeoutError.name = "TimeoutError";
    global.fetch.mockRejectedValue(timeoutError);

    await expect(triggerAIQuotation("s1")).resolves.toBeUndefined();
  });
});
