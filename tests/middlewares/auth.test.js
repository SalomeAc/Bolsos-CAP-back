const jwt = require("jsonwebtoken");
const authenticateToken = require("../../api/middlewares/auth");
const requireAdmin = require("../../api/middlewares/requireAdmin");

describe("auth middlewares", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  describe("authenticateToken", () => {
    it("rechaza petición sin token", () => {
      const response = res();
      const next = jest.fn();

      authenticateToken({ headers: {} }, response, next);

      expect(response.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("adjunta usuario con token válido", () => {
      const token = jwt.sign({ id: "u1", email: "a@test.com" }, "test-secret");
      const req = { headers: { authorization: `Bearer ${token}` } };
      const response = res();
      const next = jest.fn();

      authenticateToken(req, response, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe("u1");
    });

    it("rechaza token expirado", () => {
      const token = jwt.sign(
        { id: "u1" },
        "test-secret",
        { expiresIn: "-1s" },
      );
      const req = { headers: { authorization: `Bearer ${token}` } };
      const response = res();
      const next = jest.fn();

      authenticateToken(req, response, next);

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({ message: "Token expired" });
    });

    it("rechaza token inválido", () => {
      const req = { headers: { authorization: "Bearer bad-token" } };
      const response = res();
      const next = jest.fn();

      authenticateToken(req, response, next);

      expect(response.status).toHaveBeenCalledWith(403);
    });
  });

  describe("requireAdmin", () => {
    it("rechaza sin usuario", async () => {
      const response = res();
      const next = jest.fn();
      await requireAdmin({}, response, next);
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("rechaza usuario no admin", async () => {
      const response = res();
      const next = jest.fn();
      await requireAdmin({ user: { id: "u1", isAdmin: false } }, response, next);
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("permite admin", async () => {
      const response = res();
      const next = jest.fn();
      await requireAdmin({ user: { id: "admin", isAdmin: true } }, response, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
