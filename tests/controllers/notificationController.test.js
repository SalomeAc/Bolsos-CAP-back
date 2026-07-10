jest.mock("../../api/dao/notificationDAO");

const NotificationDAO = require("../../api/dao/notificationDAO");
const NotificationController = require("../../api/controllers/notificationController");

describe("notificationController", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getMyNotifications retorna listado", async () => {
    NotificationDAO.findByRecipient.mockResolvedValue([{ _id: "n1" }]);
    const response = res();

    await NotificationController.getMyNotifications(
      { user: { id: "u1" }, query: { unread: "true", limit: "20" } },
      response,
    );

    expect(NotificationDAO.findByRecipient).toHaveBeenCalledWith("u1", {
      unreadOnly: true,
      limit: 20,
    });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("getUnreadCount retorna contador", async () => {
    NotificationDAO.countUnread.mockResolvedValue(3);
    const response = res();

    await NotificationController.getUnreadCount(
      { user: { id: "u1" } },
      response,
    );

    expect(response.json).toHaveBeenCalledWith({ count: 3 });
  });

  it("markAsRead retorna 404 si no existe", async () => {
    NotificationDAO.markAsRead.mockResolvedValue(null);
    const response = res();

    await NotificationController.markAsRead(
      { params: { id: "n1" }, user: { id: "u1" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("markAsRead actualiza notificación", async () => {
    NotificationDAO.markAsRead.mockResolvedValue({ _id: "n1", read: true });
    const response = res();

    await NotificationController.markAsRead(
      { params: { id: "n1" }, user: { id: "u1" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("markAllAsRead marca todas", async () => {
    NotificationDAO.markAllAsRead.mockResolvedValue({});
    const response = res();

    await NotificationController.markAllAsRead(
      { user: { id: "u1" } },
      response,
    );

    expect(NotificationDAO.markAllAsRead).toHaveBeenCalledWith("u1");
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
