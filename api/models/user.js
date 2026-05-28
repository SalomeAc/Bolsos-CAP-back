const mongoose = require("mongoose");
const bcrypt = require("bcrypt");


const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "Los nombres son requeridos"],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, "Los apellidos son requeridos"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "El correo es requerido"],
    unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Inserte un email válido"],
  },
  authProvider: {
    type: String,
    enum: ["local", "google"],
    default: "local",
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },

  isActive: {
  type: Boolean,
  default: true
  },

  isAdmin: {
    type: Boolean,
    default: false
  }
});


module.exports = mongoose.model("User", UserSchema);
