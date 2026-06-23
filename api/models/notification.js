const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["nueva_solicitud"],
      required: [true, "El tipo de notificación es requerido"],
    },
    title: {
      type: String,
      required: [true, "El título es requerido"],
    },
    message: {
      type: String,
      required: [true, "El mensaje es requerido"],
    },
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      required: [true, "La cotización asociada es requerida"],
    },
    solicitud: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Solicitud",
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "El destinatario es requerido"],
    },
    read: {
      type: Boolean,
      default: false,
    },
    metadata: {
      clientName: { type: String },
      clientEmail: { type: String },
      productName: { type: String },
      kind: { type: String },
      quantity: { type: Number },
      requestDate: { type: Date },
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ quotation: 1 });

module.exports = mongoose.model("Notification", NotificationSchema);
