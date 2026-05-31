# Features y Roadmap — Bolsos-CAP (backend)

Documento vivo con la visión del producto, las diferencias entre lo descrito y lo implementado, y el plan de cambios. La **prioridad inmediata** es el **modelo de personalización (cotizaciones)**. La integración con IA (Gemini) es prioridad posterior.

---

## 1. Visión del producto

Plataforma tipo e-commerce de **bolsos tejidos a crochet**, **sin precios fijos**. El precio se define por **cotización** porque cada pieza es hecha a mano.

Flujo objetivo:

1. Visitante explora el **catálogo sin loguearse** (color, material, tamaño, descripción; **sin precio**).
2. El cliente solicita una **cotización** en dos modalidades:
   - **Catálogo personalizado:** parte de un producto existente y elige tipo, color y tamaño.
   - **Producto personalizado:** no está en el catálogo; aporta foto de referencia, descripción, color, dimensiones y materiales.
3. La solicitud llega a la **administradora** vía **chat**.
4. Una **IA (Gemini)** genera una **cotización preliminar** (primer filtro). La administradora **no** cotiza directo: revisa la propuesta de la IA.
5. La administradora **refina** la cotización y responde al cliente.
6. El cliente **acepta o rechaza**.
7. Al aceptar, se genera el **pedido** y se envían **actualizaciones de estado** hasta la entrega.

---

## 2. Estado actual (implementado)

| Módulo | Estado | Notas |
|--------|--------|-------|
| Usuarios | ✅ Completo | Registro local, login Google, recuperación de contraseña, perfil, `deactivate`, `delete`, `isAdmin`. Sigue el patrón `Global*` (model → DAO → controller). |
| Productos | ⚠️ Básico | CRUD con funciones sueltas, **sin auth**. No sigue el patrón `Global*`. Update/delete saltan el DAO y llaman al modelo directo. |
| Cotizaciones | ❌ No existe | **Prioridad 1.** |
| Chat | ❌ No existe | |
| IA (Gemini) | ❌ No existe | Prioridad posterior. |
| Pedidos / estados | ❌ No existe | |

---

## 3. Diferencias: visión vs. código actual

| # | Visión | Código actual | Acción |
|---|--------|---------------|--------|
| 1 | La **foto** la aporta el cliente en la *cotización personalizada*. | `Product.photo` es **requerido** en el catálogo. | Mantener foto en el producto del catálogo; modelar la foto del cliente en la **Cotización**, no obligarla en el producto. Revisar si `photo` debe seguir siendo `required`. |
| 2 | Atributos del bolso: color, **material**, **tamaño**, descripción. | `Product` tiene `color`, `materials` (`[String]`), `dimensions` (String), `type`, `name`, `code`. | Alinear nomenclatura: "tamaño" ↔ `dimensions`. Definir si `type` es la categoría usada para personalizar (sí, según la visión). |
| 3 | El catálogo lo gestiona la **administradora**. | CRUD de productos **abierto** (sin `authenticateToken`). | Proteger `POST/PUT/DELETE` de productos como **solo-admin**; dejar `GET` público. |
| 4 | Existe un **modelo de cotización** (personalización). | No existe. | **Crear el módulo de Cotizaciones** (prioridad 1). |
| 5 | **Chat** entre cliente y administradora. | No existe. | Diseñar mensajería (ver preguntas abiertas: tiempo real vs. REST). |
| 6 | **IA (Gemini)** genera cotización preliminar. | No existe. | Fase posterior. Dejar el modelo de Cotización preparado para almacenar la propuesta de IA. |
| 7 | **Pedido** y **actualizaciones de estado** tras aceptar. | No existe. | Definir si el estado vive en la Cotización o en una entidad `Order` separada (ver preguntas). |
| 8 | — | El módulo de productos no sigue el patrón `Global*`. | Refactor recomendado a `Global*` para consistencia (deuda técnica, no bloqueante). |
| 9 | — | `package.json` apunta a un repo remoto antiguo (`emilynunezordonez/...`). | Actualizar metadatos del `package.json`. |
| 10 | — | `index.js` llama `connectDB()` sin `await`; el server arranca aunque Mongo falle. | Considerar `await connectDB()` antes de `listen`, o arrancar el server dentro del `.then`. |

---

## 4. Roadmap por fases

### Fase 0 — Higiene (rápida)
- [x] Actualizar `.gitignore`.
- [x] Actualizar `README.md` con la visión y enlaces.
- [x] Crear `features.md`, `docs/api-design.md` y `docs/database.md`.
- [x] Referenciar la documentación en `CLAUDE.md`.
- [ ] **Fijar nombre de BD en `MONGO_URI`** (`/bolsoscap`): hoy se escribe en la BD `test` (ver `docs/database.md`).
- [ ] **Completar `EMAIL_USER`/`EMAIL_PASS`** en `.env` (el mailer falla sin ellas).
- [ ] `await connectDB()` antes de `app.listen` en `index.js`.
- [ ] Actualizar metadatos de `package.json` (repo, descripción, scripts `start`/`dev`).
- [ ] Añadir `.env.example`.

### Fase 1 — Modelo de personalización (Cotizaciones) — ✅ **IMPLEMENTADA**
- [x] Modelo `Quotation` (`api/models/quotation.js`) con soporte catálogo + personalizado, `user` requerido y validación condicional para `kind=custom`.
- [x] `quotationDAO` (extiende `GlobalDAO`) y `quotationController` (extiende `GlobalController`).
- [x] Rutas `/api/quotations` protegidas con `authenticateToken`; rutas admin con `requireAdmin`.
- [x] Máquina de estados implementada (incluye estados de IA; transiciones validadas en `respond` y `updateStatus`).
- [x] Middleware `requireAdmin` (`api/middlewares/requireAdmin.js`) y protección del catálogo (`POST/PUT/DELETE /api/products`).
- [x] Verificado e2e contra Atlas: 23/23 checks OK (catálogo público, mutaciones admin, flujo de cotización catálogo y personalizada, ownership y máquina de estados).

### Fase 2 — Chat en tiempo real (Socket.io)
- [ ] Modelo `Message` + persistencia en Mongo.
- [ ] Servidor Socket.io en `index.js`, handshake autenticado con JWT, salas por cotización.
- [ ] Endpoint REST `GET /api/quotations/:id/messages` para historial.

### Fase 3 — Pedidos y seguimiento (entidad `Order`)
- [ ] Modelo `Order` separado, creado al aceptar la cotización.
- [ ] Estados de producción con `statusHistory` y notificaciones (correo) al cliente.

### Fase 4 — IA (Gemini)
- [ ] Integrar Gemini para generar la cotización preliminar.
- [ ] Almacenar propuesta de IA en la cotización; la administradora la refina antes de enviar.

---

## 5. Decisiones confirmadas (2026-05-27)

> Antes eran preguntas abiertas; resueltas con el equipo. Reflejadas en `docs/api-design.md`.

1. **Auth para cotizar:** ✅ **Requiere login.** La cotización se asocia siempre a un `User`.
2. **Chat:** ✅ **Tiempo real con Socket.io** (con persistencia en Mongo).
3. **Estados:** ✅ Máquina de estados propuesta tal cual (incluye estados de IA).
4. **Pedido:** ✅ **Entidad `Order` separada**, creada al aceptar la cotización.

---

## 6. Notas de arquitectura / deuda técnica

- Refactorizar **productos** al patrón `Global*` para consistencia con usuarios.
- `index.js`: arrancar el servidor sólo tras conectar a Mongo.
- Centralizar mensajes de error (hoy mezcla español/inglés y `error`/`message` según el módulo).
- No hay framework de tests; considerar Jest + supertest a futuro.
