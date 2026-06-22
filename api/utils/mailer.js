

const nodemailer = require("nodemailer");

// Verificar que las variables de entorno están configuradas
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn("⚠️ [MAILER] Variables de entorno EMAIL_USER y/o EMAIL_PASS no configuradas");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verificar conexión al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ [MAILER] Error verificando conexión de email:", error.message);
  } else {
    console.log("✓ [MAILER] Conexión de email lista");
  }
});

async function sendMail(to, subject, html) {
  try {
    console.log(`[MAILER] Preparando envío a ${to}...`);
    console.log(`[MAILER] De: ${process.env.EMAIL_USER}`);
    console.log(`[MAILER] Asunto: ${subject}`);

    const result = await transporter.sendMail({
      from: `"MVPI Support Team" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✓ [MAILER] Email enviado exitosamente a ${to}`);
    console.log(`[MAILER] ID de respuesta: ${result.response}`);
    return result;
  } catch (err) {
    console.error("❌ [MAILER] Error enviando correo:", err.message);
    console.error("[MAILER] Tipo de error:", err.code);
    throw err;
  }
}

module.exports = { sendMail };
