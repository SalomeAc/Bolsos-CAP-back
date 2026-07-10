const requireAdmin = require("../../api/middlewares/requireAdmin");

describe("requireAdmin middleware", () => {
  const next = jest.fn();
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("permite acceso a administrador", async () => {
    const req = { user: { id: "admin1", isAdmin: true } };
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("rechaza sin usuario autenticado", async () => {
    const req = {};
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rechaza usuario no admin", async () => {
    const req = { user: { id: "u1", isAdmin: false } };
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
