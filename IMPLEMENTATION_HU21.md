# Historia de Usuario 21 - Notificaciones de Confirmación de Cotización

## Resumen de Implementación

Se ha implementado el sistema de notificaciones de confirmación de cotización que envía automáticamente una confirmación al usuario cuando su cotización es registrada correctamente. La notificación se distribuye a través de dos canales: mensaje interno en la plataforma y correo electrónico.

---

## Arquitectura Implementada

### 1. Nuevo Servicio: `NotificationService`
**Ubicación:** `api/services/notificationService.js`

**Responsabilidad:** Centralizar la lógica de generación y envío de notificaciones.

**Métodos Públicos:**
- `sendQuotationConfirmation(quotation)` - Genera y envía notificación de confirmación

**Métodos Privados:**
- `_buildNotificationContent(quotation)` - Extrae y formatea datos de la cotización
- `_buildEmailTemplate(content)` - Construye HTML para email
- `_createSystemMessage(quotation, content)` - Almacena mensaje del sistema
- `_sendEmail(userEmail, htmlContent)` - Envía email

### 2. Modificaciones a `QuotationController`
**Ubicación:** `api/controllers/quotationController.js`

**Cambios:**
- Importación de `NotificationService`
- Modificación de `createQuotation()` para:
  - Poblar la cotización después de crearla (con datos de producto y usuario)
  - Disparar envío de notificación de forma asíncrona
  - Manejar errores sin romper el flujo de creación
- Nuevo método privado `_sendNotificationAsync()` para encapsular lógica

### 3. Reutilización de Componentes Existentes
- **MessageDAO**: Almacena la notificación como `Message` con `isSystemMessage: true`
- **mailer.js**: Envía email usando nodemailer existente
- **Message Model**: Ya tiene campo `isSystemMessage` para este propósito

---

## Flujo de Ejecución

```
POST /api/quotations
    ↓
QuotationController.createQuotation()
    ↓
Validación de entrada
    ↓
QuotationDAO.create(data)  → Crea cotización en BD
    ↓
QuotationDAO.read(id)  → Puebla con usuario y producto
    ↓
_sendNotificationAsync(quotation)  [Asíncrono, no bloquea]
    ├─→ NotificationService.sendQuotationConfirmation()
    │      ├─→ _buildNotificationContent()
    │      ├─→ _createSystemMessage()  → MessageDAO.create()
    │      └─→ _sendEmail()  → sendMail()
    │
    └─→ Manejo de errores (log, sin afectar respuesta)
    ↓
res.status(201).json(quotation)  ✓ Respuesta inmediata
```

---

## Datos Incluidos en la Notificación

### Para Modalidad "catalog":
- ✅ Tipo de bolso: `product.type`
- ✅ Nombre del bolso: `product.name`
- ✅ Material: `customization.type` + `product.materials[]`
- ✅ Dimensiones: `customization.size` | `product.dimensions[]`
- ✅ Color: `customization.color` | `product.color[]`
- ✅ Fecha de solicitud: `quotation.createdAt` (formateada)
- ✅ Estado actual: "Pendiente"

### Para Modalidad "custom":
- ✅ Tipo de bolso: "Personalizado"
- ✅ Nombre del bolso: `customProduct.description`
- ✅ Material: `customProduct.materials[]`
- ✅ Dimensiones: `customProduct.dimensions`
- ✅ Color: `customProduct.color`
- ✅ Fecha de solicitud: `quotation.createdAt` (formateada)
- ✅ Estado actual: "Pendiente"

---

## Canales de Notificación

### 1. Mensaje Interno (Plataforma)
**Tipo:** Mensaje del sistema (`isSystemMessage: true`)
**Almacenamiento:** Collection `messages` en MongoDB
**Acceso:** Usuario puede ver en `/api/messages/quotations/:quotationId`
**Contenido:** Texto plano con estructura clara

### 2. Correo Electrónico
**Proveedor:** Gmail (via nodemailer)
**Variables de entorno:** `EMAIL_USER`, `EMAIL_PASS`
**Contenido:** HTML con estilos y formato profesional
**Remitente:** "MVPI Support Team" <configured_email>

---

## Criterios de Aceptación - Estado de Cumplimiento

| Criterio | Estado | Detalles |
|----------|--------|----------|
| Notificación automática al registrar cotización | ✅ Cumplido | Se genera inmediatamente post-creación |
| Incluye tipo de bolso | ✅ Cumplido | Extraído según modalidad |
| Incluye nombre del bolso | ✅ Cumplido | De product o customProduct |
| Incluye material | ✅ Cumplido | Combinado si es necesario |
| Incluye dimensiones | ✅ Cumplido | De customization o product |
| Incluye color | ✅ Cumplido | De customization o product |
| Incluye fecha de solicitud | ✅ Cumplido | Formateada en fecha/hora locale |
| Incluye estado "Pendiente" | ✅ Cumplido | Status inicial de cotización |
| Asociada al usuario propietario | ✅ Cumplido | `message.sender = quotation.user` |
| Contenido generado correctamente | ✅ Cumplido | Templates con lógica condicional |
| Almacenamiento funcional | ✅ Cumplido | MessageDAO + MessageSchema |
| Envío o publicación funcional | ✅ Cumplido | Email + Mensaje interno |
| Pruebas unitarias | ✅ Cumplido | `tests/services/notificationService.test.js` |
| Pruebas de integración | ✅ Cumplido | `tests/integration/quotation.notification.integration.test.js` |

---

## Manejo de Errores

### Errores Validados

1. **Quotación sin usuario**
   ```
   Error: "Cotización debe tener usuario con email"
   ```

2. **Usuario sin email**
   ```
   Error: "Cotización debe tener usuario con email"
   ```

3. **Estructura de cotización inválida**
   ```
   Error: "Estructura de cotización no válida"
   ```

### Estrategia de Recuperación

- **En creación de cotización:** Si validación falla, no se crea cotización ni se envía notificación
- **En envío de notificación:** Error de email no afecta respuesta HTTP de creación
  - Se loguea el error
  - La cotización ya fue creada
  - Se intenta reintentar notificación manualmente después
  - Usuario recibe respuesta 201 exitosa

---

## Configuración Requerida

### Variables de Entorno (.env)
```
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_contraseña_aplicación
PORT=3000
MONGODB_URI=...
JWT_SECRET=...
```

### Dependencias (ya incluidas)
```json
{
  "nodemailer": "^8.0.9",
  "mongoose": "^9.6.2",
  "express": "^5.2.1"
}
```

---

## Pruebas

### Ejecutar Tests Unitarios
```bash
npm test -- tests/services/notificationService.test.js
```

**Cobertura:**
- ✅ Generación de contenido (catalog y custom)
- ✅ Construcción de plantilla HTML
- ✅ Asociación a usuario
- ✅ Validaciones y errores
- ✅ Formato de contenido

### Ejecutar Tests de Integración
```bash
npm test -- tests/integration/quotation.notification.integration.test.js
```

**Cobertura:**
- ✅ Flujo completo: crear cotización → generar notificación
- ✅ Respuesta exitosa (201)
- ✅ Errores no rompen flujo
- ✅ Cotización poblada se pasa al servicio
- ✅ Validaciones previas

### Prueba Manual
```bash
curl -X POST http://localhost:3000/api/quotations \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "catalog",
    "product": "<PRODUCT_ID>",
    "customization": {
      "type": "Cuero",
      "color": "Negro",
      "size": "30cm x 20cm"
    },
    "quantity": 1
  }'
```

---

## Impacto y Dependencias

### Archivos Modificados
1. `api/controllers/quotationController.js` - 18 líneas nuevas
2. `package.json` - Sin cambios (dependencias ya existen)

### Archivos Creados
1. `api/services/notificationService.js` - 195 líneas
2. `tests/services/notificationService.test.js` - 304 líneas
3. `tests/integration/quotation.notification.integration.test.js` - 240 líneas

### Impacto en Flujos Existentes
- ✅ No afecta creación de cotización (asíncrono)
- ✅ No afecta endpoints existentes
- ✅ Reutiliza Message Model existente
- ✅ Reutiliza mailer.js existente
- ✅ Compatible con ambas modalidades (catalog/custom)

### Posibles Mejoras Futuras
1. Reintento automático de notificación fallida (exponential backoff)
2. Cola de notificaciones (Bull/RabbitMQ)
3. Plantillas de email en base de datos
4. Sistema de preferencias de notificación del usuario
5. Notificaciones para cambios de estado (ej: cotizada, aceptada, rechazada)

---

## Validación Post-Implementación

1. ✅ **Mensajes internos:** Verificar en `GET /api/messages/quotations/:id`
2. ✅ **Correos:** Verificar en bandeja de entrada del usuario
3. ✅ **Logs:** Buscar "Notificación enviada para cotización"
4. ✅ **Errores:** Buscar "Error enviando notificación" en logs
5. ✅ **BD:** Verificar collection `messages` tiene documentos con `isSystemMessage: true`

---

## Conclusión

La Historia de Usuario 21 ha sido implementada siguiendo los patrones arquitectónicos existentes del proyecto. La solución:
- ✅ Reutiliza componentes existentes (Message, MessageDAO, mailer)
- ✅ No duplica funcionalidad
- ✅ Mantiene las convenciones de código
- ✅ Incluye manejo robusto de errores
- ✅ Tiene cobertura de tests completa
- ✅ Cumple todos los criterios de aceptación
