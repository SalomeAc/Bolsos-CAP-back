const UserDAO = require("../dao/userDAO");

// Debe usarse SIEMPRE después de authenticateToken (necesita req.user.id).
// El JWT no incluye isAdmin, así que se consulta el usuario en la BD.
async function requireAdmin(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = await UserDAO.read(req.user.id);

    if (!user || !user.isAdmin) {
      return res
        .status(403)
        .json({ message: "Acceso permitido solo para administradores" });
    }

    req.currentUser = user;
    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res
      .status(500)
      .json({ message: "Internal server error, try again later" });
  }
}

module.exports = requireAdmin;
