# 📧 Guía de Configuración de Notificaciones por Email

## Paso 1: Configurar Variables de Entorno

### En el archivo `.env` del proyecto:

```bash
# Gmail SMTP
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_contraseña_app

# Ejemplo:
EMAIL_USER=soporte@tuempresa.com
EMAIL_PASS=abcd efgh ijkl mnop
```

### Obtener Contraseña de Aplicación de Gmail

1. Acceder a https://myaccount.google.com/security
2. Activar "Verificación en dos pasos" (si no está activa)
3. Ir a "Contraseñas de aplicaciones"
4. Seleccionar:
   - App: Mail
   - Dispositivo: Windows / Mac / Linux
5. Copiar la contraseña de 16 caracteres (incluir espacios)
6. Pegar en `EMAIL_PASS`

> **Nota:** No usar la contraseña normal de Gmail, debe ser una contraseña de aplicación

---

## Paso 2: Verificar Configuración de Mailer

Archivo: `api/utils/mailer.js`

```javascript
const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: process.env.EMAIL_USER,    // ✓ Debe venir de .env
    pass: process.env.EMAIL_PASS,    // ✓ Debe venir de .env
  },
});
```

**Verificar:**
```bash
# En terminal (desde directorio del proyecto)
echo $EMAIL_USER
echo $EMAIL_PASS

# O verificar en Node:
node -e "require('dotenv').config(); console.log(process.env.EMAIL_USER)"
```

---

## Paso 3: Crear una Cotización de Prueba

### Con curl:

```bash
curl -X POST http://localhost:3000/api/quotations \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "catalog",
    "product": "ID_DEL_PRODUCTO",
    "customization": {
      "type": "Cuero",
      "color": "Negro",
      "size": "30cm x 20cm"
    },
    "quantity": 1,
    "notes": "Prueba de notificación"
  }'
```

**Reemplazar:**
- `<JWT_TOKEN>` - Token JWT válido del usuario
- `ID_DEL_PRODUCTO` - ID de un producto existente

### Con Postman:

1. **URL:** `POST http://localhost:3000/api/quotations`
2. **Headers:**
   - `Authorization: Bearer <JWT_TOKEN>`
   - `Content-Type: application/json`
3. **Body (JSON):**
```json
{
  "kind": "catalog",
  "product": "product_id",
  "customization": {
    "type": "Cuero",
    "color": "Negro",
    "size": "30cm x 20cm"
  },
  "quantity": 1
}
```

---

## Paso 4: Verificar Envío de Email

### En los Logs del Servidor

**Buscar estas líneas:**
```
[NOTIFICATION] Iniciando notificación para cotización...
[NOTIFICATION] Creando mensaje del sistema...
[NOTIFICATION] Mensaje del sistema creado: msg123
[NOTIFICATION] Enviando email a usuario@example.com...
[NOTIFICATION] ✓ Email enviado exitosamente a usuario@example.com
[NOTIFICATION] ✓ Notificación completada para cotización quotation123
```

**En caso de error:**
```
[NOTIFICATION ERROR] Fallo al enviar email a usuario@example.com: ...
```

### En la Bandeja de Email del Usuario

1. Acceder a `usuario@example.com`
2. Revisar bandeja de entrada
3. Buscar email con asunto: **"Cotización Registrada Correctamente"**

**Verificar contenido:**
- ✓ Información clara y estructurada
- ✓ Todos los datos de la cotización
- ✓ Estilos HTML aplicados

### En la Base de Datos

**Verificar mensaje del sistema:**
```bash
# En MongoDB
db.messages.find({ isSystemMessage: true }).sort({ createdAt: -1 }).limit(1)

# Resultado esperado:
{
  "_id": ObjectId("..."),
  "quotation": ObjectId("quotation123"),
  "sender": ObjectId("user123"),
  "content": "<div style='...'><h2>✓ Cotización Registrada...</h2>...",
  "isSystemMessage": true,
  "attachments": [],
  "createdAt": ISODate("2026-06-16T..."),
  "__v": 0
}
```

---

## Paso 5: Obtener JWT Token para Testing

### Opción 1: Desde Frontend

1. Acceder a la aplicación frontend
2. Iniciar sesión
3. Abrir DevTools (F12)
4. Ir a Application → Storage → Cookies/LocalStorage
5. Copiar el token JWT

### Opción 2: Via API de Login

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "contraseña"
  }'

# Respuesta:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {...}
}
```

---

## Solución de Problemas

### ❌ Error: "EAUTH: Invalid credentials"

**Causa:** Las credenciales de Gmail son incorrectas

**Solución:**
```
1. Verificar que EMAIL_USER y EMAIL_PASS en .env son correctos
2. Si usa Gmail, usar contraseña de aplicación (no la contraseña normal)
3. Verificar que la verificación en dos pasos está activada
4. Generar nueva contraseña de aplicación
```

### ❌ Error: "Service not available"

**Causa:** Gmail rechaza la conexión (posible bloqueo de cuenta)

**Solución:**
```
1. Ir a https://accounts.google.com/activity
2. Revisar accesos recientes
3. Permitir "Aplicaciones menos seguras"
4. O usar contraseña de aplicación (recomendado)
```

### ❌ Error: "Cotización creada pero email no enviado"

**Causa:** Error en configuración de email

**Verificar:**
1. Variables de entorno (.env) correctas
2. Conexión a internet funcional
3. Logs del servidor muestran exactamente qué error
4. Mensaje del sistema DEBE estar en BD igual

**Comportamiento correcto:**
- ✓ Cotización se crea igual (BD)
- ✓ Mensaje del sistema se almacena (visible en plataforma)
- ⚠️ Email falla (se loguea para revisión manual)

### ✓ Email se envía pero no llega

**Solución:**
1. Revisar carpeta de spam/correo no deseado
2. Verificar que el email de destino es correcto
3. Revisar en "Mi cuenta" de Gmail si hay alertas de seguridad

---

## Verificación Final

### Checklist Completo

- [ ] Variables de entorno configuradas (.env)
- [ ] Servidor iniciado: `npm start`
- [ ] Usuario autenticado (token JWT obtenido)
- [ ] Crear cotización exitosamente (response 201)
- [ ] Logs muestran "[NOTIFICATION] ✓ Email enviado"
- [ ] Email recibido en bandeja de entrada
- [ ] Email tiene estructura HTML correcta
- [ ] Información de cotización está completa
- [ ] Mensaje interno visible en BD (isSystemMessage: true)

### Pruebas Adicionales

**Test 1: Modalidad Catalog**
```json
{
  "kind": "catalog",
  "product": "ID_PRODUCTO",
  "customization": {
    "type": "Cuero Premium",
    "color": "Negro",
    "size": "30cm x 20cm"
  }
}
```

**Test 2: Modalidad Custom**
```json
{
  "kind": "custom",
  "customProduct": {
    "description": "Bolso personalizado único",
    "color": "Azul Marino",
    "dimensions": "35cm x 25cm x 10cm",
    "materials": ["Cuero Ecológico", "Forro Lino"]
  }
}
```

**Verificar:** Ambos emails tienen estructura correcta y datos apropiados

---

## Monitoreo Continuo

### Logs a Monitorear

```bash
# En producción, buscar:
grep -i "notification" logs/app.log

# Errores de email:
grep -i "error" logs/app.log | grep -i "email"

# Completados exitosamente:
grep "✓ Notificación completada" logs/app.log
```

### Métrica de Éxito

```
Total cotizaciones creadas = X
Notificaciones enviadas = Y
Tasa de éxito = (Y / X) × 100 %

Meta: > 99% de éxito
```

---

## Configuración Alternativa (Opcional)

### Si no quieres usar Gmail

```javascript
// Usar otro SMTP (ej: SendGrid, Mailgun, etc.)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
```

**Variables en .env:**
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxx
```

---

## 📞 Soporte

Si el email no se envía:

1. **Verificar logs** - Buscar `[NOTIFICATION ERROR]`
2. **Verificar variables de entorno** - `echo $EMAIL_USER`
3. **Verificar configuración de Gmail** - Contraseña de aplicación
4. **Revisar documentación de nodemailer** - https://nodemailer.com/
5. **Revisar mensaje en BD** - Debe existir con `isSystemMessage: true`

**Importante:** El mensaje SIEMPRE se almacena en la plataforma. El email es un canal adicional que puede fallar sin romper el flujo.
