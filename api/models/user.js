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
  age: {
    type: Number,
    min: [13, "El usuario debe tener al menos 13 años"],
    required: function () {
      return this.authProvider !== "google";
    },
  },
  email: {
    type: String,
    required: [true, "El correo es requerido"],
    unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Inserte un email válido"],
  },
  password: {
    type: String,
    required: function () {
      return this.authProvider !== "google";
    },
    match: [
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/,
      "La contraseña debe tener al menos 8 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial",
    ],
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
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
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


UserSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});


UserSchema.post("findOneAndUpdate", async function (doc) {
  if (doc && doc.password && !doc.password.startsWith("$2b$")) {
    const hashed = await bcrypt.hash(doc.password, 10);
    await doc.updateOne({ password: hashed }, { runValidators: false });
  }
});


module.exports = mongoose.model("User", UserSchema);
