const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    // La cotización a la que pertenece el mensaje
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      required: [true, "La cotización es requerida"],
    },

    // Remitente (usuario que envía el mensaje)
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "El remitente es requerido"],
    },

    // Contenido del mensaje
    content: {
      type: String,
      required: [true, "El contenido del mensaje es requerido"],
      trim: true,
    },

    // Campo opcional para archivos adjuntos (foto de referencia, etc.)
    attachments: [
      {
        type: String, // URL de la imagen o archivo
      },
    ],

    // Para indicar si es un mensaje de estado del sistema
    isSystemMessage: {
      type: Boolean,
      default: false,
    },

    // all = visible para cliente y admin; admin = solo administradores (p. ej. propuesta IA)
    audience: {
      type: String,
      enum: ["all", "admin"],
      default: "all",
    },
  },
  { timestamps: true }
);

// Índices para búsquedas rápidas
MessageSchema.index({ quotation: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });

module.exports = mongoose.model("Message", MessageSchema);
