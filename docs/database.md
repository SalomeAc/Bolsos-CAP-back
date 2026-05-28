# Base de datos — Bolsos-CAP

MongoDB (Atlas) vía Mongoose. Documenta la conexión, las **colecciones existentes** (verificadas conectándose a la BD el 2026-05-27) y el **diseño de las colecciones necesarias** para el funcionamiento completo de la API.

> En MongoDB no hay "tablas" sino **colecciones** de documentos; aquí se usan como equivalente.

---

## 1. Conexión (estado real verificado)

- Cluster Atlas `bolsoscap.jdcuxfe.mongodb.net`, conexión por `mongodb+srv`. Conexión **OK** (ping exitoso).
- Código: `api/config/database.js` (`connectDB`/`disconnectDB`), correcto para Mongoose 9.

### ⚠️ Hallazgos a corregir

1. **La base de datos en uso es `test`.** El `MONGO_URI` no incluye un nombre de BD tras el host (`...mongodb.net/?appName=...`), por lo que Mongoose usa `test` por defecto. **Recomendado:** fijar el nombre, p. ej. `...mongodb.net/bolsoscap?retryWrites=true&w=majority&appName=BolsosCAP`.
2. **Faltan `EMAIL_USER` y `EMAIL_PASS` en `.env`.** El `utils/mailer.js` (recuperación de contraseña, futuras notificaciones de pedido) **fallará** sin ellas. La doc del proyecto las lista como requeridas.
3. **Arranque sin `await`:** `index.js` llama `connectDB()` sin esperar; el servidor levanta aunque Mongo falle. Recomendado: `await connectDB()` antes de `app.listen`.

---

## 2. Colecciones existentes (verificadas)

### `users` — 2 documentos

| Campo | Tipo | Notas |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `firstName`, `lastName` | String | Requeridos (trim) |
| `email` | String | **Único**, validado |
| `authProvider` | String | `local` \| `google` |
| `googleId` | String | **Único + sparse** |
| `isActive` | Boolean | default `true` |
| `isAdmin` | Boolean | default `false` |

**Índices reales:** `_id_`; `email_1` (unique); `googleId_1` (unique, sparse). ✅ Coinciden con el modelo.

> Dato: el único usuario admin actual es `emily.nunez@correounivalle.edu.co` (`isAdmin: true`, auth Google).

### `products` — 1 documento

| Campo | Tipo | Notas |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `name` | String | Requerido (trim) |
| `description` | String | Requerido |
| `color` | String | Requerido |
| `dimensions` | String | Requerido ("tamaño") |
| `materials` | [String] | Requerido |
| `type` | String | Requerido (categoría usada para personalizar) |
| `photo` | String | Requerido (URL) |
| `code` | String | **Único**, autogenerado `PRD-XXXXXX` |

**Índices reales:** `_id_`; `code_1` (unique). ✅ Coinciden con el modelo.

---

## 3. Colecciones a diseñar (necesarias para la API completa)

Basadas en las decisiones confirmadas (ver `docs/api-design.md`): cotizar requiere login, chat con Socket.io, pedido como entidad `Order` separada.

### 3.1 `quotations` (Cotizaciones) — **prioridad 1**

| Campo | Tipo | Notas |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `kind` | String enum `catalog`\|`custom` | Modalidad. **Requerido** |
| `user` | ObjectId → `users` | **Requerido** (cotizar requiere login) |
| `product` | ObjectId → `products` | Requerido si `kind=catalog` |
| `customization` | Obj `{ type, color, size }` | Opciones elegidas (catálogo) |
| `customProduct` | Obj `{ description, color, dimensions, materials[], photo }` | Requerido si `kind=custom` |
| `quantity` | Number | default 1, min 1 |
| `notes` | String | Mensaje del cliente |
| `status` | String enum | `pendiente`→`cotizada_ia`→`en_revision`→`cotizada`→`aceptada`/`rechazada`→`en_produccion`→`completada`/`cancelada` |
| `aiQuotation` | Obj `{ amount, currency, breakdown, model, generatedAt }` | Propuesta IA (fase 4) |
| `finalQuotation` | Obj `{ amount, currency, notes, quotedBy→users, quotedAt }` | Cotización de la admin |
| `createdAt`/`updatedAt` | Date | `timestamps` |

**Índices propuestos:** `{ user: 1 }`, `{ status: 1 }`, `{ createdAt: -1 }`.

### 3.2 `messages` (Chat) — fase 2

| Campo | Tipo | Notas |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `quotation` | ObjectId → `quotations` | **Requerido** (sala = cotización) |
| `sender` | ObjectId → `users` | **Requerido** |
| `role` | String enum `user`\|`admin` | **Requerido** |
| `body` | String | **Requerido** |
| `readAt` | Date | Marca de lectura |
| `createdAt`/`updatedAt` | Date | `timestamps` |

**Índices propuestos:** `{ quotation: 1, createdAt: 1 }` (cargar hilo en orden).

### 3.3 `orders` (Pedidos) — fase 3

| Campo | Tipo | Notas |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `quotation` | ObjectId → `quotations` | **Requerido + único** (1 pedido por cotización) |
| `user` | ObjectId → `users` | **Requerido** |
| `amount` | Number | Tomado de `finalQuotation` aceptada |
| `currency` | String | default `COP` |
| `status` | String enum | `en_produccion`\|`completada`\|`cancelada` |
| `statusHistory` | [`{ status, note, at }`] | Historial de cambios |
| `createdAt`/`updatedAt` | Date | `timestamps` |

**Índices propuestos:** `{ quotation: 1 }` (unique), `{ user: 1 }`, `{ status: 1 }`.

---

## 4. Relaciones (resumen)

```
users (1) ───< (N) quotations            user crea muchas cotizaciones
products (1) ─< (N) quotations            (solo kind=catalog) producto base
quotations (1) ─< (N) messages            hilo de chat por cotización
quotations (1) ─── (1) orders             un pedido al aceptar la cotización
users (1) ───< (N) orders                 dueño del pedido
users (admin) ─< (N) quotations.finalQuotation.quotedBy   quién cotizó
```

---

## 5. Acciones de configuración recomendadas

- [ ] Añadir nombre de BD al `MONGO_URI` (`/bolsoscap`) para no escribir en `test`. **Migrar** los 3 documentos existentes si se cambia de BD.
- [ ] Completar `EMAIL_USER` / `EMAIL_PASS` en `.env` (y `GEMINI_API_KEY` en fase 4).
- [ ] `await connectDB()` antes de `app.listen` en `index.js`.
- [ ] Crear los modelos Mongoose de `quotations`, `messages`, `orders` siguiendo el patrón `Global*`.
