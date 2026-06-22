# 🔧 Guía de Diagnóstico - Email No Llega

## Problema: El email de notificación no está llegando

### Paso 1: Verificar Variables de Entorno

**Crear/Editar `.env` en la raíz del proyecto:**

```bash
# .env
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_contraseña_app_gmail
```

**Verificar que está configurado:**
```bash
# En terminal
echo $EMAIL_USER
echo $EMAIL_PASS

# Deben mostrar los valores, no estar vacíos
```

---

### Paso 2: Ejecutar Script de Prueba

**Desde el directorio del proyecto:**

```bash
node test-email.js
```

**Salidas esperadas:**

✅ **Éxito:**
```
🔍 Verificando configuración de email...

1️⃣  Variables de Entorno:
   EMAIL_USER: ✓ Configurado
   EMAIL_PASS: ✓ Configurado

2️⃣  Creando transportador de email...

3️⃣  Verificando conexión con Gmail...
✓ Conexión exitosa

4️⃣  Enviando email de prueba...
✓ Email enviado exitosamente

============================================================
✅ CONFIGURACIÓN CORRECTA
============================================================
```

❌ **Error: Variables no configuradas:**
```
❌ Error: Variables de entorno no configuradas

   Configura en .env:
   EMAIL_USER=tu_email@gmail.com
   EMAIL_PASS=contraseña_app_gmail
```

**Solución:** Editar `.env` y configurar las variables

❌ **Error: Credenciales incorrectas:**
```
❌ Error de conexión: Invalid login: 535-5.7.8 Username and password not accepted
```

**Solución:**
1. Verificar que EMAIL_USER es correcto
2. Si usas Gmail, usar **contraseña de aplicación**, no la contraseña normal
3. Generar nueva contraseña en https://myaccount.google.com/apppasswords

❌ **Error: Verificación 2FA:**
```
❌ Error de conexión: Invalid login: 534-5.7.9 Please log in via your web browser
```

**Solución:**
1. Ir a https://myaccount.google.com/security
2. Activar "Verificación en dos pasos"
3. Generar contraseña de aplicación

---

### Paso 3: Verificar Logs del Servidor

**Iniciar servidor y crear una cotización:**

```bash
npm start
```

**Buscar en los logs:**
```
[MAILER] Preparando envío a usuario@example.com...
[MAILER] De: tu_email@gmail.com
[MAILER] Asunto: Cotización Registrada Correctamente
✓ [MAILER] Email enviado exitosamente a usuario@example.com
```

**Si hay error:**
```
❌ [MAILER] Error enviando correo: ...
[MAILER] Tipo de error: EAUTH
```

**Códigos de error comunes:**

| Código | Significado | Solución |
|--------|------------|----------|
| EAUTH | Credenciales inválidas | Verificar EMAIL_USER y EMAIL_PASS |
| ECONNREFUSED | No hay conexión | Verificar conexión a internet |
| 535 | Invalid login | Usar contraseña de app, no contraseña normal |
| 534 | 2FA requerido | Activar 2FA y generar contraseña de app |

---

### Paso 4: Revisar en BD

**Verificar que el mensaje se almacena:**

```bash
# En MongoDB
db.messages.find({ isSystemMessage: true }).sort({ createdAt: -1 }).limit(1)

# Si aparece, significa que la notificación se procesó en el sistema
# El email puede fallar pero el mensaje está en la plataforma
```

**Estructura esperada:**
```json
{
  "_id": ObjectId("..."),
  "quotation": ObjectId("..."),
  "sender": ObjectId("...admin..."),
  "content": "Cotización Registrada Correctamente\n\nHemos recibido tu solicitud...",
  "isSystemMessage": true,
  "attachments": [],
  "createdAt": ISODate("2026-06-17T...")
}
```

---

### Paso 5: Checklist de Resolución

- [ ] `.env` tiene EMAIL_USER y EMAIL_PASS
- [ ] Son valores válidos (no vacíos)
- [ ] EMAIL_USER es dirección de email correcta
- [ ] EMAIL_PASS es contraseña de **aplicación** (16 caracteres, de Gmail)
- [ ] Ejecuté `node test-email.js` con resultado ✅
- [ ] Recibí email de prueba en la bandeja
- [ ] Creé una cotización
- [ ] Reviré logs buscando "[MAILER] ✓ Email enviado"
- [ ] Recibí email de notificación

---

## Soluciones Específicas

### Caso 1: Gmail con Contraseña Normal

**Problema:** Credenciales rechazadas aunque son correctas

**Solución:**
1. Ir a https://myaccount.google.com/security
2. Buscar "Contraseñas de aplicaciones"
3. Generar contraseña para Mail/Windows/Linux
4. Copiar contraseña de 16 caracteres
5. Pegar en `.env` como `EMAIL_PASS`

### Caso 2: Verificación 2FA no Activada

**Problema:** Error 534-5.7.9

**Solución:**
1. Ir a https://myaccount.google.com/security
2. Buscar "Verificación en dos pasos"
3. Activarla
4. Luego generar contraseña de aplicación
5. Usar la contraseña en `.env`

### Caso 3: Sin Acceso a Gmail

**Alternativa:** Usar otro proveedor SMTP

**Editar `api/utils/mailer.js`:**
```javascript
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,      // smtp.sendgrid.net
  port: process.env.SMTP_PORT,      // 587
  secure: false,
  auth: {
    user: process.env.SMTP_USER,    // apikey
    pass: process.env.SMTP_PASS,    // tu_api_key
  },
});
```

**En `.env`:**
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxx
```

---

## Verificación de Flujo Completo

### 1. Script de Prueba
```bash
node test-email.js
```
✅ Debe ser exitoso

### 2. Crear Cotización
```bash
curl -X POST http://localhost:3000/api/quotations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "catalog",
    "product": "product_id",
    "customization": {"type": "Cuero", "color": "Negro", "size": "30cm x 20cm"}
  }'
```
✅ Response 201

### 3. Revisar Logs
```
[NOTIFICATION] ✓ Notificación completada para cotización...
✓ [MAILER] Email enviado exitosamente a...
```
✅ Sin errores

### 4. Revisar Email
✅ Email recibido en bandeja de entrada
✅ Contiene información de la cotización
✅ Profesional y bien formateado

### 5. Revisar Base de Datos
```
db.messages.find({ isSystemMessage: true }).limit(1)
```
✅ Mensaje del sistema creado

---

## Flujo del Mensaje (Diagrama)

```
Usuario crea cotización (POST /api/quotations)
         ↓
✓ Cotización creada en BD
         ↓
┌─ NOTIFICACIÓN (paralelo) ─┐
│                           │
│ 1. Generar contenido      │
│ 2. Crear mensaje interno  │
│    └─ Guardado en BD      │
│ 3. Enviar email           │
│    ├─ Éxito → Loguear     │
│    └─ Error → Loguear     │
│                           │
└───────────────────────────┘
         ↓
✓ Response 201 al usuario

IMPORTANTE:
- Mensaje SIEMPRE se guarda (garantizado)
- Email PUEDE fallar (se loguea el error)
```

---

## Líneas de Log a Buscar

**Éxito:**
```
[NOTIFICATION] Iniciando notificación para cotización 60d5ec49c...
[NOTIFICATION] Creando mensaje del sistema...
[NOTIFICATION] Mensaje del sistema creado: 60d5ec49x...
[NOTIFICATION] Enviando email a usuario@example.com...
✓ [MAILER] Email enviado exitosamente a usuario@example.com
[NOTIFICATION] ✓ Notificación completada para cotización 60d5ec49c...
```

**Error (pero cotización creada):**
```
[NOTIFICATION] Iniciando notificación para cotización 60d5ec49c...
[NOTIFICATION] Creando mensaje del sistema...
[NOTIFICATION] Mensaje del sistema creado: 60d5ec49x...
[NOTIFICATION] Enviando email a usuario@example.com...
❌ [MAILER] Error enviando correo: Invalid login
[NOTIFICATION ERROR] Error en sendQuotationConfirmation: Error: Error enviando email
[QUOTATION] ⚠️ Error en notificación para cotización 60d5ec49c...
```

---

## Resumen de Solución

1. **Configurar `.env`** con EMAIL_USER y EMAIL_PASS (contraseña de app)
2. **Ejecutar `node test-email.js`** para verificar
3. **Revisar logs** cuando crees una cotización
4. **Verificar emails** recibidos
5. **Confirmar en BD** que mensaje fue creado

**Si el email no llega pero el mensaje está en BD:**
- ✓ Sistema funciona correctamente
- ⚠️ Revisar configuración de email
- ⚠️ Revisar carpeta de spam
- ⚠️ Revisar credenciales de Gmail
