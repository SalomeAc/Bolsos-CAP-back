#!/usr/bin/env node

/**
 * Script de prueba para verificar configuración de email
 * Ejecutar: node test-email.js
 */

require("dotenv").config();
const nodemailer = require("nodemailer");

console.log("\n🔍 Verificando configuración de email...\n");

// Paso 1: Verificar variables de entorno
console.log("1️⃣  Variables de Entorno:");
console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? "✓ Configurado" : "❌ NO CONFIGURADO"}`);
console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? "✓ Configurado" : "❌ NO CONFIGURADO"}`);

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.log("\n❌ Error: Variables de entorno no configuradas");
  console.log("\n   Configura en .env:");
  console.log("   EMAIL_USER=tu_email@gmail.com");
  console.log("   EMAIL_PASS=contraseña_app_gmail");
  process.exit(1);
}

// Paso 2: Crear transporter
console.log("\n2️⃣  Creando transportador de email...");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Paso 3: Verificar conexión
console.log("\n3️⃣  Verificando conexión con Gmail...");
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Error de conexión:", error.message);
    console.log("\nPosibles causas:");
    console.log("   - EMAIL_USER o EMAIL_PASS incorrectos");
    console.log("   - Gmail rechaza conexión (activar verificación 2FA)");
    console.log("   - Contraseña normal en lugar de contraseña de app");
    process.exit(1);
  } else {
    console.log("✓ Conexión exitosa");

    // Paso 4: Enviar email de prueba
    console.log("\n4️⃣  Enviando email de prueba...");

    const mailOptions = {
      from: `"MVPI Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Enviar a la misma cuenta para prueba
      subject: "🧪 Prueba de Configuración de Email - MVPI",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #2c3e50;">✓ Email de Prueba Exitoso</h2>
          <p>Si recibes este email, significa que tu configuración de email está correcta.</p>

          <div style="background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p><strong>Información de prueba:</strong></p>
            <p>Email: ${process.env.EMAIL_USER}</p>
            <p>Fecha: ${new Date().toLocaleString()}</p>
            <p>Host: Gmail SMTP</p>
          </div>

          <p style="color: #666; font-size: 12px;">
            Este es un email de prueba automático.
            Si recibiste este email, tu sistema de notificaciones está listo para usar.
          </p>
        </div>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("❌ Error enviando email:", error.message);
        process.exit(1);
      } else {
        console.log("✓ Email enviado exitosamente");
        console.log(`   Respuesta: ${info.response}`);

        console.log("\n" + "═".repeat(60));
        console.log("✅ CONFIGURACIÓN CORRECTA");
        console.log("═".repeat(60));
        console.log("\n✓ Tu sistema de email está listo para enviar notificaciones");
        console.log("✓ Las notificaciones llegarán a los usuarios correctamente");
        console.log("\n📧 Revisa tu bandeja de entrada para confirmar");
        console.log("\n");
        process.exit(0);
      }
    });
  }
});

// Timeout si tarda mucho
setTimeout(() => {
  console.log("\n⏱️  Timeout: La verificación tardó demasiado");
  console.log("   Posible problema de conexión a internet");
  process.exit(1);
}, 10000);
