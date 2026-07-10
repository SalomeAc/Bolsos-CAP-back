const jwt = require("jsonwebtoken");
const verifyN8nWebhook = require("../../api/middlewares/verifyN8nWebhook");

jest.mock("../../api/utils/aiWorkflowLogger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("verifyN8nWebhook middleware", () => {
  const next = jest.fn();
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  const originalSecret = process.env.N8N_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.N8N_WEBHOOK_SECRET = "test-secret";
  });

  afterAll(() => {
    process.env.N8N_WEBHOOK_SECRET = originalSecret;
  });

  it("rechaza si no hay secret configurado", () => {
    delete process.env.N8N_WEBHOOK_SECRET;
    verifyN8nWebhook({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("rechaza sin Authorization Bearer", () => {
    verifyN8nWebhook({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rechaza scope inválido", () => {
    const token = jwt.sign({ scope: "other" }, "test-secret", {
      algorithm: "HS256",
    });
    verifyN8nWebhook(
      { headers: { authorization: `Bearer ${token}` } },
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("acepta token válido con scope quotation-ai", () => {
    const token = jwt.sign(
      { scope: "quotation-ai", quotationId: "q1" },
      "test-secret",
      { algorithm: "HS256" },
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    verifyN8nWebhook(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.webhookPayload.quotationId).toBe("q1");
  });

  it("rechaza token inválido", () => {
    verifyN8nWebhook(
      { headers: { authorization: "Bearer invalid-token" } },
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
