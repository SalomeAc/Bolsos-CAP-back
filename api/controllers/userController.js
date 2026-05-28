const GlobalController = require("./globalController");
const UserDAO = require("../dao/userDAO");

const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { sendMail } = require("../utils/mailer");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


class UserController extends GlobalController {
  
  constructor() {
    super(UserDAO);
  }

  
  async loginUser(req, res) {
    try {
      const idToken = req.body.idToken || req.body.credential || req.body.token;

      if (!idToken) {
        return res.status(400).json({
          message: "Token de Google requerido",
        });
      }

      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload?.email) {
        return res.status(401).json({
          message: "No se pudo validar la cuenta de Google",
        });
      }

      let user = await this.dao.findByEmail(payload.email);

      const firstName = payload.given_name || payload.name?.split(" ")[0] || "Usuario";
      const lastName =
        payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "";

      if (!user) {
        user = await this.dao.create({
          firstName,
          lastName,
          email: payload.email,
          googleId: payload.sub,
          authProvider: "google",
          isActive: true,
        });
      } else {
        const updates = {};

        if (user.authProvider !== "google") {
          updates.authProvider = "google";
        }

        if (!user.googleId) {
          updates.googleId = payload.sub;
        }

        if (!user.firstName && firstName) {
          updates.firstName = firstName;
        }

        if (!user.lastName && lastName) {
          updates.lastName = lastName;
        }

        if (Object.keys(updates).length > 0) {
          user = await this.dao.update(user._id, updates);
        }
      }

      if (!user.isActive) {
        return res.status(403).json({
          message: "Usuario desactivado",
        });
      }

      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          provider: user.authProvider,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      
      return res.status(200).json({
        message: "Login con Google exitoso",
        token,
      });

    } catch (err) {
      console.error("Login error:", err);

      if (err?.message?.includes("Token used too late") || err?.message?.includes("Invalid Value") || err?.message?.includes("Wrong number of segments")) {
        return res.status(401).json({
          message: "Token de Google inválido",
        });
      }

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }

  
  async deactivateUser(req, res) {
  try {
    const userId = req.user.id;

    await this.dao.update(userId, { isActive: false });

    return res.status(200).json({
      message: "Usuario desactivado"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Internal server error"
    });
    }
  }

  
  async getUserProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await this.dao.read(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      return res.status(200).json({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      });
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.log(`Internal server error: ${err.message}`);
      }
      res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

  
  async updateUserProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await this.dao.read(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      await this.dao.update(userId, req.body);

      return res.status(200).json({
        message: "Perfil exitosamente actualizado",
      });
    } catch (err) {
      if (err.name === "ValidationError") {
        const firstMessage = Object.values(err.errors)[0].message;
        return res.status(400).json({ message: firstMessage });
      }

      if (err.code === 11000) {
        return res.status(409).json({ message: "Email ya registrado" });
      }

      if (process.env.NODE_ENV === "development") {
        console.log(`Internal server error: ${err.message}`);
      }
      res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

  
  async deleteUser(req, res) {
    try {
      const userId = req.user.id;

      const user = await this.dao.read(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      await this.dao.delete(userId);

      return res.status(200).json({
        message: "Perfil exitosamente borrado",
      });
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.log(`Internal server error: ${err.message}`);
      }
      res
        .status(500)
        .json({ message: "Internal server error, try again later" });
    }
  }

}


module.exports = new UserController();
