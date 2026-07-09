jest.mock("../../api/dao/userDAO");
jest.mock("google-auth-library", () => {
  const verifyIdToken = jest.fn();
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken })),
    __verifyIdToken: verifyIdToken,
  };
});

const jwt = require("jsonwebtoken");
const { __verifyIdToken: verifyIdToken } = require("google-auth-library");
const UserDAO = require("../../api/dao/userDAO");
const UserController = require("../../api/controllers/userController");

describe("userController", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  let verifyIdToken;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    verifyIdToken = require("google-auth-library").__verifyIdToken;
  });

  describe("loginUser", () => {
    it("retorna 400 sin token de Google", async () => {
      const response = res();
      await UserController.loginUser({ body: {} }, response);
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("crea usuario nuevo y retorna JWT", async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: "ana@test.com",
          given_name: "Ana",
          family_name: "López",
          sub: "google-123",
        }),
      });
      UserDAO.findByEmail.mockResolvedValue(null);
      UserDAO.create.mockResolvedValue({
        _id: "u1",
        firstName: "Ana",
        lastName: "López",
        email: "ana@test.com",
        isAdmin: false,
        authProvider: "google",
        isActive: true,
      });

      const response = res();
      await UserController.loginUser({ body: { idToken: "valid-token" } }, response);

      expect(UserDAO.create).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({ email: "ana@test.com" }),
        }),
      );
    });

    it("actualiza usuario existente con datos de Google", async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: "ana@test.com",
          given_name: "Ana",
          sub: "google-456",
        }),
      });
      UserDAO.findByEmail.mockResolvedValue({
        _id: "u1",
        email: "ana@test.com",
        authProvider: "local",
        isActive: true,
        isAdmin: false,
      });
      UserDAO.update.mockResolvedValue({
        _id: "u1",
        email: "ana@test.com",
        firstName: "Ana",
        lastName: "",
        authProvider: "google",
        googleId: "google-456",
        isActive: true,
        isAdmin: false,
      });

      const response = res();
      await UserController.loginUser({ body: { credential: "tok" } }, response);

      expect(UserDAO.update).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it("rechaza usuario desactivado", async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: "x@test.com", sub: "g1" }),
      });
      UserDAO.findByEmail.mockResolvedValue({
        _id: "u1",
        email: "x@test.com",
        firstName: "Inactivo",
        isActive: false,
        authProvider: "google",
        googleId: "g1",
      });

      const response = res();
      await UserController.loginUser({ body: { token: "tok" } }, response);

      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("retorna 401 con token inválido", async () => {
      verifyIdToken.mockRejectedValue(new Error("Invalid Value"));

      const response = res();
      await UserController.loginUser({ body: { idToken: "bad" } }, response);

      expect(response.status).toHaveBeenCalledWith(401);
    });
  });

  describe("getUserProfile", () => {
    it("retorna perfil del usuario", async () => {
      UserDAO.read.mockResolvedValue({
        firstName: "Ana",
        lastName: "López",
        email: "ana@test.com",
      });

      const response = res();
      await UserController.getUserProfile(
        { user: { id: "u1" } },
        response,
      );

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        firstName: "Ana",
        lastName: "López",
        email: "ana@test.com",
      });
    });

    it("retorna 404 si no existe", async () => {
      UserDAO.read.mockResolvedValue(null);
      const response = res();
      await UserController.getUserProfile({ user: { id: "u1" } }, response);
      expect(response.status).toHaveBeenCalledWith(404);
    });
  });

  describe("updateUserProfile", () => {
    it("actualiza perfil", async () => {
      UserDAO.read.mockResolvedValue({ _id: "u1" });
      UserDAO.update.mockResolvedValue({});

      const response = res();
      await UserController.updateUserProfile(
        { user: { id: "u1" }, body: { firstName: "Nuevo" } },
        response,
      );

      expect(UserDAO.update).toHaveBeenCalledWith("u1", { firstName: "Nuevo" });
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it("maneja email duplicado", async () => {
      UserDAO.read.mockResolvedValue({ _id: "u1" });
      const err = new Error("dup");
      err.code = 11000;
      UserDAO.update.mockRejectedValue(err);

      const response = res();
      await UserController.updateUserProfile(
        { user: { id: "u1" }, body: { email: "dup@test.com" } },
        response,
      );

      expect(response.status).toHaveBeenCalledWith(409);
    });
  });

  describe("deleteUser", () => {
    it("elimina usuario", async () => {
      UserDAO.read.mockResolvedValue({ _id: "u1" });
      UserDAO.delete.mockResolvedValue({});

      const response = res();
      await UserController.deleteUser({ user: { id: "u1" } }, response);

      expect(UserDAO.delete).toHaveBeenCalledWith("u1");
      expect(response.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deactivateUser", () => {
    it("desactiva usuario autenticado", async () => {
      UserDAO.update.mockResolvedValue({});
      const response = res();
      await UserController.deactivateUser({ user: { id: "u1" } }, response);
      expect(UserDAO.update).toHaveBeenCalledWith("u1", { isActive: false });
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it("maneja error interno", async () => {
      UserDAO.update.mockRejectedValue(new Error("DB"));
      const response = res();
      await UserController.deactivateUser({ user: { id: "u1" } }, response);
      expect(response.status).toHaveBeenCalledWith(500);
    });
  });

  describe("error paths", () => {
    it("login retorna 401 sin email en payload de Google", async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({ sub: "g1" }),
      });
      const response = res();
      await UserController.loginUser({ body: { idToken: "tok" } }, response);
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("login retorna 500 en error genérico", async () => {
      verifyIdToken.mockRejectedValue(new Error("network down"));
      const response = res();
      await UserController.loginUser({ body: { idToken: "tok" } }, response);
      expect(response.status).toHaveBeenCalledWith(500);
    });

    it("getUserProfile maneja error del DAO", async () => {
      UserDAO.read.mockRejectedValue(new Error("DB"));
      const response = res();
      await UserController.getUserProfile({ user: { id: "u1" } }, response);
      expect(response.status).toHaveBeenCalledWith(500);
    });

    it("updateUserProfile maneja ValidationError", async () => {
      UserDAO.read.mockResolvedValue({ _id: "u1" });
      const err = new Error("validation");
      err.name = "ValidationError";
      err.errors = { email: { message: "Email inválido" } };
      UserDAO.update.mockRejectedValue(err);
      const response = res();
      await UserController.updateUserProfile(
        { user: { id: "u1" }, body: { email: "bad" } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("deleteUser retorna 404 si no existe", async () => {
      UserDAO.read.mockResolvedValue(null);
      const response = res();
      await UserController.deleteUser({ user: { id: "u1" } }, response);
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("deleteUser maneja error del DAO", async () => {
      UserDAO.read.mockResolvedValue({ _id: "u1" });
      UserDAO.delete.mockRejectedValue(new Error("DB"));
      const response = res();
      await UserController.deleteUser({ user: { id: "u1" } }, response);
      expect(response.status).toHaveBeenCalledWith(500);
    });
  });
});
