jest.mock("../../api/dao/notificationDAO");

const NotificationDAO = require("../../api/dao/notificationDAO");
const NotificationController = require("../../api/controllers/notificationController");

describe("notificationController errors", () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  it("getMyNotifications maneja error del DAO", async () => {
    NotificationDAO.findByRecipient.mockRejectedValue(new Error("DB"));
    const response = res();

    await NotificationController.getMyNotifications(
      { user: { id: "u1" }, query: {} },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("getUnreadCount maneja error del DAO", async () => {
    NotificationDAO.countUnread.mockRejectedValue(new Error("DB"));
    const response = res();

    await NotificationController.getUnreadCount({ user: { id: "u1" } }, response);

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("markAsRead maneja error del DAO", async () => {
    NotificationDAO.markAsRead.mockRejectedValue(new Error("DB"));
    const response = res();

    await NotificationController.markAsRead(
      { params: { id: "n1" }, user: { id: "u1" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("markAllAsRead maneja error del DAO", async () => {
    NotificationDAO.markAllAsRead.mockRejectedValue(new Error("DB"));
    const response = res();

    await NotificationController.markAllAsRead({ user: { id: "u1" } }, response);

    expect(response.status).toHaveBeenCalledWith(500);
  });
});
