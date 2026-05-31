// Debe usarse SIEMPRE después de authenticateToken (necesita req.user.id).
// Usa el isAdmin del JWT que se genera en userController.js
async function requireAdmin(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "No autenticado" });
    }

    // El JWT ya contiene isAdmin, verificar directamente
    if (req.user.isAdmin !== true) {
      return res
        .status(403)
        .json({ message: "Acceso permitido solo para administradores" });
    }

    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res
      .status(500)
      .json({ message: "Internal server error, try again later" });
  }
}

module.exports = requireAdmin;
