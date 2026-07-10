jest.mock("../../api/dao/messageDAO", () => ({
  create: jest.fn(),
  read: jest.fn(),
  delete: jest.fn(),
  findByQuotation: jest.fn(),
  findLatestByQuotation: jest.fn(),
  model: {
    findById: jest.fn(),
  },
}));
jest.mock("../../api/dao/quotationDAO");

const MessageDAO = require("../../api/dao/messageDAO");
const QuotationDAO = require("../../api/dao/quotationDAO");
const MessageController = require("../../api/controllers/messageController");

describe("messageController", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createMessage", () => {
    it("crea mensaje para dueño de cotización", async () => {
      QuotationDAO.read.mockResolvedValue({
        _id: "q1",
        user: "u1",
      });
      MessageDAO.create.mockResolvedValue({ _id: "m1" });
      MessageDAO.model.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "m1",
          content: "Hola",
        }),
      });

      const response = res();
      await MessageController.createMessage(
        {
          user: { id: "u1" },
          body: { quotationId: "q1", content: "Hola" },
        },
        response,
      );

      expect(response.status).toHaveBeenCalledWith(201);
      expect(MessageDAO.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quotation: "q1",
          sender: "u1",
          content: "Hola",
        }),
      );
    });

    it("rechaza usuario no autorizado", async () => {
      QuotationDAO.read.mockResolvedValue({ _id: "q1", user: "u2" });
      const response = res();
      await MessageController.createMessage(
        {
          user: { id: "u1" },
          body: { quotationId: "q1", content: "Hola" },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("rechaza contenido vacío", async () => {
      QuotationDAO.read.mockResolvedValue({ _id: "q1", user: "u1" });
      const response = res();
      await MessageController.createMessage(
        {
          user: { id: "u1" },
          body: { quotationId: "q1", content: "   " },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("retorna 404 si cotización no existe", async () => {
      QuotationDAO.read.mockResolvedValue(null);
      const response = res();
      await MessageController.createMessage(
        {
          user: { id: "u1" },
          body: { quotationId: "q1", content: "Hola" },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(404);
    });
  });

  describe("getMessagesByQuotation", () => {
    it("lista mensajes para admin", async () => {
      QuotationDAO.read.mockResolvedValue({ _id: "q1", user: "u2" });
      MessageDAO.findByQuotation.mockResolvedValue([{ _id: "m1" }]);

      const response = res();
      await MessageController.getMessagesByQuotation(
        {
          params: { quotationId: "q1" },
          user: { id: "admin", isAdmin: true },
        },
        response,
      );

      expect(response.status).toHaveBeenCalledWith(200);
      expect(MessageDAO.findByQuotation).toHaveBeenCalledWith("q1", {
        isAdmin: true,
      });
    });
  });

  describe("getLatestMessagesByQuotation", () => {
    it("retorna mensajes recientes invertidos", async () => {
      QuotationDAO.read.mockResolvedValue({ _id: "q1", user: "u1" });
      MessageDAO.findLatestByQuotation.mockResolvedValue([
        { _id: "m2" },
        { _id: "m1" },
      ]);

      const response = res();
      await MessageController.getLatestMessagesByQuotation(
        {
          params: { quotationId: "q1" },
          query: { limit: "10" },
          user: { id: "u1" },
        },
        response,
      );

      expect(MessageDAO.findLatestByQuotation).toHaveBeenCalledWith(
        "q1",
        10,
        { isAdmin: false },
      );
      expect(response.json).toHaveBeenCalledWith([
        { _id: "m1" },
        { _id: "m2" },
      ]);
    });
  });

  describe("deleteMessage", () => {
    it("permite eliminar mensaje propio", async () => {
      MessageDAO.read.mockResolvedValue({ _id: "m1", sender: "u1" });
      MessageDAO.delete.mockResolvedValue({});

      const response = res();
      await MessageController.deleteMessage(
        { params: { messageId: "m1" }, user: { id: "u1" } },
        response,
      );

      expect(MessageDAO.delete).toHaveBeenCalledWith("m1");
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it("rechaza eliminar mensaje ajeno", async () => {
      MessageDAO.read.mockResolvedValue({ _id: "m1", sender: "u2" });
      const response = res();
      await MessageController.deleteMessage(
        { params: { messageId: "m1" }, user: { id: "u1" } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("retorna 404 si mensaje no existe", async () => {
      MessageDAO.read.mockResolvedValue(null);
      const response = res();
      await MessageController.deleteMessage(
        { params: { messageId: "m1" }, user: { id: "u1" } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(404);
    });
  });

  describe("error handling", () => {
    it("createMessage maneja error del DAO", async () => {
      QuotationDAO.read.mockResolvedValue({ _id: "q1", user: "u1" });
      MessageDAO.create.mockRejectedValue(new Error("DB fail"));
      const response = res();
      await MessageController.createMessage(
        {
          user: { id: "u1" },
          body: { quotationId: "q1", content: "Hola" },
        },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("getMessagesByQuotation retorna 403 para ajeno", async () => {
      QuotationDAO.read.mockResolvedValue({ _id: "q1", user: "u2" });
      const response = res();
      await MessageController.getMessagesByQuotation(
        { params: { quotationId: "q1" }, user: { id: "u1" } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("getMessagesByQuotation maneja error interno", async () => {
      QuotationDAO.read.mockRejectedValue(new Error("DB"));
      const response = res();
      await MessageController.getMessagesByQuotation(
        { params: { quotationId: "q1" }, user: { id: "u1", isAdmin: true } },
        response,
      );
      expect(response.status).toHaveBeenCalledWith(500);
    });
  });
});
