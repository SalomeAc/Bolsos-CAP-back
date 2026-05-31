# Backend - Sistema de Mensajes (Documentación Técnica)

## 📋 Cambios Realizados

### 1. Modelo de Datos (`api/models/message.js`)

```javascript
{
  quotation: ObjectId ← ref a Quotation (REQUERIDO)
  sender: ObjectId    ← ref a User (REQUERIDO)
  content: String     ← Contenido del mensaje (REQUERIDO)
  attachments: [String] ← URLs de adjuntos (OPCIONAL)
  isSystemMessage: Boolean ← Para eventos del sistema (DEFAULT: false)
  createdAt: Date
  updatedAt: Date
}
```

**Índices:**
- `{quotation: 1, createdAt: -1}` → búsquedas rápidas por cotización
- `{sender: 1}` → búsquedas por remitente

---

### 2. Data Access Object (`api/dao/messageDAO.js`)

Extiende `GlobalDAO` con métodos especializados:

```javascript
// Obtener todos los mensajes de una cotización (ordenado por fecha)
findByQuotation(quotationId)
// Retorna: Array de documentos Message

// Obtener últimos N mensajes (útil para paginación)
findLatestByQuotation(quotationId, limit = 50)
// Retorna: Array (reversado para mostrar nuevos al final)

// Obtener mensajes de un usuario
findBySender(senderId)
// Retorna: Array ordenado por fecha descendente

// Contar mensajes en una cotización
countByQuotation(quotationId)
// Retorna: Número
```

---

### 3. Controlador (`api/controllers/messageController.js`)

Extiende `GlobalController` con lógica de negocio:

#### `createMessage(req, res)`
**Entrada:**
```javascript
{
  quotationId: String,
  content: String,
  attachments: [String]  // OPCIONAL
}
```

**Validaciones:**
- ✅ Cotización existe
- ✅ Usuario es propietario o admin
- ✅ Contenido no vacío

**Respuesta:**
```javascript
{
  _id: ObjectId,
  quotation: ObjectId,
  sender: {_id, firstName, lastName, email},
  content: String,
  attachments: [String],
  isSystemMessage: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

#### `getMessagesByQuotation(req, res)`
**Entrada:**
```
GET /api/messages/:quotationId/all
```

**Validaciones:**
- ✅ Cotización existe
- ✅ Usuario es propietario o admin

**Respuesta:** Array ordenado cronológicamente (antiguos → nuevos)

---

#### `getLatestMessagesByQuotation(req, res)`
**Entrada:**
```
GET /api/messages/:quotationId?limit=50
```

**Query params:**
- `limit`: Número máximo de mensajes (DEFAULT: 50)

**Respuesta:** Array ordenado cronológicamente (reversado para UI)

---

#### `deleteMessage(req, res)`
**Entrada:**
```
DELETE /api/messages/:messageId
```

**Validaciones:**
- ✅ Mensaje existe
- ✅ Usuario es remitente o admin

**Respuesta:** `{message: "Mensaje eliminado exitosamente"}`

---

### 4. Rutas (`api/routes/messageRoutes.js`)

```javascript
// Middleware global: requiere autenticación
router.use(authenticateToken)

// Crear mensaje
POST /api/messages/:quotationId
Request body: {quotationId, content, attachments}
Response: 201 con documento Message

// Obtener todos los mensajes
GET /api/messages/:quotationId/all
Response: 200 con array de Message

// Obtener últimos mensajes
GET /api/messages/:quotationId?limit=50
Response: 200 con array de Message (paginado)

// Eliminar mensaje
DELETE /api/messages/:messageId
Response: 200 con mensaje de éxito o 403/404
```

---

### 5. Integración en Rutas Principales (`api/routes/routes.js`)

```javascript
const messageRoutes = require("./messageRoutes");
router.use("/messages", messageRoutes);
```

**Resultado:** Todas las rutas están bajo `/api/messages`

---

## 🔐 Seguridad y Validaciones

### Autenticación
- ✅ Todas las rutas requieren JWT válido
- ✅ Token se valida en middleware `authenticateToken`
- ✅ `req.user` contiene datos del usuario autenticado

### Autorización
```javascript
// Cliente solo puede ver/enviar mensajes en sus cotizaciones
const isOwner = quotation.user.toString() === req.user.id;

// Admin puede ver/enviar en cualquier cotización
const isAdmin = req.user.isAdmin;

if (!isOwner && !isAdmin) {
  return res.status(403).json({message: "No autorizado"});
}
```

### Validación de Datos
```javascript
// Contenido requerido y no vacío
if (!content || content.trim().length === 0) {
  return res.status(400).json({message: "Contenido requerido"});
}

// Cotización debe existir
const quotation = await QuotationDAO.read(quotationId);
if (!quotation) {
  return res.status(404).json({message: "Cotización no encontrada"});
}
```

---

## 🔄 Flujo de Datos

### Cliente envía mensaje

```
Frontend (React)
    ↓
sendMessage(quotationId, content, token)
    ↓
HTTP POST /api/messages/:quotationId
    ↓
Backend (Express)
    ↓
MessageController.createMessage()
    ↓
Validaciones (auth, ownership, content)
    ↓
MessageDAO.create()
    ↓
MongoDB save()
    ↓
Response con documento creado
    ↓
Frontend recibe y muestra en Chat
```

### Frontend obtiene mensajes

```
Frontend (React) - React useEffect cada 3 seg
    ↓
getLatestMessages(quotationId, limit, token)
    ↓
HTTP GET /api/messages/:quotationId?limit=50
    ↓
Backend
    ↓
MessageController.getLatestMessagesByQuotation()
    ↓
Validaciones
    ↓
MessageDAO.findLatestByQuotation()
    ↓
MongoDB query
    ↓
Response con array de mensajes
    ↓
Frontend actualiza estado y re-renderiza
```

---

## 📊 Modelos Relacionados

### Quotation (existente)
```javascript
{
  _id: ObjectId,
  kind: "catalog" | "custom",
  user: ObjectId → User,
  product: ObjectId → Product (si kind=catalog),
  customProduct: Object (si kind=custom),
  quantity: Number,
  status: String,
  finalQuotation: { amount, currency, notes, quotedAt },
  createdAt: Date
}
```

### User (existente)
```javascript
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  email: String,
  isAdmin: Boolean,
  isActive: Boolean,
  createdAt: Date
}
```

### Message (NUEVO)
```javascript
{
  _id: ObjectId,
  quotation: ObjectId → Quotation,
  sender: ObjectId → User,
  content: String,
  attachments: [String],
  isSystemMessage: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🧪 Testing Manual

### 1. Crear mensaje
```bash
curl -X POST http://localhost:3000/api/messages/QUOT_ID \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quotationId": "QUOT_ID",
    "content": "Hola, ¿cuánto cuesta?",
    "attachments": []
  }'

# Respuesta esperada (201):
{
  "_id": "MSG_123",
  "quotation": "QUOT_ID",
  "sender": {
    "_id": "USER_ID",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan@example.com"
  },
  "content": "Hola, ¿cuánto cuesta?",
  "attachments": [],
  "isSystemMessage": false,
  "createdAt": "2026-05-28T10:00:00Z",
  "updatedAt": "2026-05-28T10:00:00Z"
}
```

### 2. Obtener mensajes
```bash
curl -X GET "http://localhost:3000/api/messages/QUOT_ID?limit=10" \
  -H "Authorization: Bearer JWT_TOKEN"

# Respuesta esperada (200):
[
  {
    "_id": "MSG_123",
    "sender": {...},
    "content": "Primer mensaje",
    "createdAt": "..."
  },
  {
    "_id": "MSG_124",
    "sender": {...},
    "content": "Segundo mensaje",
    "createdAt": "..."
  }
]
```

### 3. Eliminar mensaje
```bash
curl -X DELETE http://localhost:3000/api/messages/MSG_123 \
  -H "Authorization: Bearer JWT_TOKEN"

# Respuesta esperada (200):
{
  "message": "Mensaje eliminado exitosamente"
}
```

---

## 🚀 Próximas Mejoras

### Socket.io (Real-time)
```javascript
// Reemplazar polling con WebSockets
io.on('connection', (socket) => {
  socket.on('join-quotation', (quotationId) => {
    socket.join(`quotation-${quotationId}`);
  });

  socket.on('send-message', async (msg) => {
    const newMsg = await MessageDAO.create(msg);
    io.to(`quotation-${msg.quotationId}`).emit('message', newMsg);
  });
});
```

### Notificaciones
- Email cuando hay nuevo mensaje
- Push notifications
- Badge counter en UI

### Lectura de Mensajes
```javascript
// Agregar campo isRead a Message
router.put('/messages/:id/read', async (req, res) => {
  await MessageDAO.update(id, {isRead: true});
});
```

### Búsqueda Avanzada
- Buscar por contenido de mensaje
- Filtrar por rango de fechas
- Exportar conversación a PDF

---

## 📝 Logging

Se recomienda agregar logs:

```javascript
// En createMessage
console.log(`Mensaje enviado por ${req.user.id} en cotización ${quotationId}`);

// En getMessagesByQuotation
console.log(`Obteniendo mensajes de cotización ${quotationId}`);

// Errores
console.error('Error al crear mensaje:', err);
```

---

## 🔧 Mantenimiento

### Limpiar mensajes antiguos (opcional)
```javascript
// Cron job para borrar spam después de 1 año
const old = new Date();
old.setFullYear(old.getFullYear() - 1);
await Message.deleteMany({createdAt: {$lt: old}});
```

### Monitorear BD
```bash
# Contar mensajes
db.messages.countDocuments()

# Ver espacio usado
db.messages.totalSize()

# Índices
db.messages.getIndexes()
```

---

## ✅ Checklist de Implementación

- ✅ Modelo Message creado
- ✅ DAO con métodos especializados
- ✅ Controller con lógica de negocio
- ✅ Rutas REST implementadas
- ✅ Autenticación y autorización
- ✅ Validaciones de datos
- ✅ Índices en MongoDB
- ✅ Integración en routes.js
- ✅ Documentación técnica
- ✅ Testing manual verificado

**Status: ✅ LISTO PARA PRODUCCIÓN**

---

¿Preguntas técnicas? Revisa este documento o contáctame. 📧
