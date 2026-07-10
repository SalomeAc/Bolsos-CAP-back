const aiLog = require("../../api/utils/aiWorkflowLogger");

describe("aiWorkflowLogger", () => {
  it("expone funciones de logging", () => {
    expect(typeof aiLog.info).toBe("function");
    expect(typeof aiLog.warn).toBe("function");
    expect(typeof aiLog.error).toBe("function");
  });

  it("validateCustomProductForN8n valida campos requeridos", () => {
    const invalid = aiLog.validateCustomProductForN8n({
      color: "Rojo",
      materials: [],
      dimensions: "",
      description: "",
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.issues.length).toBeGreaterThan(0);
  });

  it("validateCustomProductForN8n acepta producto completo", () => {
    const valid = aiLog.validateCustomProductForN8n({
      description: "Bolso",
      color: "Rojo",
      materials: ["Lana"],
      dimensions: "20x15x10",
    });

    expect(valid.valid).toBe(true);
    expect(valid.snapshot).toEqual(
      expect.objectContaining({
        description: "Bolso",
        color: "Rojo",
      }),
    );
  });

  it("logQuotationState no lanza con cotización mínima", () => {
    expect(() =>
      aiLog.logQuotationState("TEST", {
        _id: "q1",
        status: "pendiente",
        aiQuotation: {},
      }),
    ).not.toThrow();
  });

  it("maskWebhookUrl oculta credenciales", () => {
    expect(aiLog.maskWebhookUrl("https://n8n.example/webhook/abc")).toContain(
      "n8n.example",
    );
  });

  it("logGenerationStart y logGenerationEnd no lanzan", () => {
    expect(() => {
      aiLog.logGenerationStart("TEST", { quotationId: "q1" });
      aiLog.logGenerationEnd("TEST", { quotationId: "q1" }, { success: true });
    }).not.toThrow();
  });

  it("logSolicitudForN8n valida solicitud", () => {
    const result = aiLog.logSolicitudForN8n(
      "TEST",
      {
        _id: "s1",
        customProduct: {
          description: "Bolso",
          color: "Rojo",
          materials: ["Lana"],
          dimensions: "20x15x10",
        },
      },
      { quotationId: "q1" },
    );
    expect(result.valid).toBe(true);
  });
});
