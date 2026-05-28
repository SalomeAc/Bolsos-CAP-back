# CLAUDE.md

Guía para trabajar en este repositorio. El equipo trabaja en español; mensajes de la API y comentarios están en español.

## Qué es

API REST (backend) de **Bolsos-CAP**. Gestiona **usuarios** (registro local, login con Google, recuperación de contraseña por correo y CRUD de perfil) y **productos** (CRUD básico). El módulo de productos es reciente y, a diferencia de usuarios, **no sigue el patrón `Global*`** (ver Notas).

`Lumo` es el nombre del frontend; `MVPI` aparece como firma en algunos correos. El producto es **Bolsos-CAP**.

## Documentación del proyecto

- **[`features.md`](./features.md)** — visión del producto, diferencias entre la visión y el código actual, y roadmap por fases. La prioridad inmediata es el **modelo de personalización (cotizaciones)**.
- **[`docs/api-design.md`](./docs/api-design.md)** — diseño de la API (modelo `Quotation`, chat Socket.io, pedidos `Order`, endpoints y plan de implementación). Decisiones confirmadas: cotizar requiere login, chat en tiempo real, `Order` separado.
- **[`docs/database.md`](./docs/database.md)** — estado real de la BD (colecciones existentes verificadas + diseño de `quotations`/`messages`/`orders`) y hallazgos de configuración.

## Stack

- **Node.js** + **Express 5** (CommonJS, `"type": "commonjs"`)
- **MongoDB** vía **Mongoose**
- **JWT** (`jsonwebtoken`) para sesiones
- **bcrypt** para hash de contraseñas
- **google-auth-library** (`OAuth2Client`) para login con Google
- **nodemailer** (Gmail) para correos de recuperación
- **cors**, **dotenv**

No hay framework de tests configurado (`npm test` solo imprime error).

## Arquitectura por capas

```
index.js                  → arranca Express, conecta a Mongo, monta /api
api/config/database.js    → connectDB / disconnectDB (Mongoose)
api/routes/               → routes.js (raíz /api) → userRoutes.js (/api/users), productRoutes.js (/api/products)
api/middlewares/auth.js   → authenticateToken: valida JWT del header Authorization: Bearer
api/controllers/          → globalController (CRUD base) ← userController (lógica de usuario)
                            productController (funciones sueltas, NO extiende GlobalController)
api/dao/                  → globalDAO (CRUD Mongoose) ← userDAO (findByEmail, delete)
                            productDAO (funciones sueltas, NO extiende GlobalDAO)
api/models/user.js        → UserSchema de Mongoose
api/models/product.js     → ProductSchema de Mongoose
api/utils/mailer.js       → sendMail (nodemailer/Gmail)
```

**Patrón clave (usuarios):** `GlobalController`/`GlobalDAO` son clases base genéricas; `UserController`/`UserDAO` extienden de ellas. Los controladores y DAOs de usuario se exportan ya instanciados (`new UserController()`, `new UserDAO()`). Este es el patrón a seguir al añadir una nueva entidad: model → DAO (extiende GlobalDAO) → controller (extiende GlobalController) → routes.

**Excepción (productos):** el módulo de productos **no** sigue este patrón. `productDAO` y `productController` son objetos de funciones sueltas exportadas (sin clases ni herencia de `Global*`), y el controller llama al modelo `Product` directamente en update/delete en vez de pasar por el DAO. Es código a alinear, no un ejemplo a replicar.

## Endpoints (`/api/users`)

| Método | Ruta                      | Auth | Acción |
|--------|---------------------------|------|--------|
| POST   | `/register`               | No   | Registro local (password + confirmPassword) |
| POST   | `/login`                  | No   | Login con Google (recibe idToken/credential) |
| POST   | `/recover-password`       | No   | Envía correo con token de reset |
| POST   | `/reset-password/:token`  | No   | Cambia contraseña con token |
| GET    | `/user-profile`           | Sí   | Devuelve perfil del usuario autenticado |
| PUT    | `/update-profile`         | Sí   | Actualiza perfil |
| PUT    | `/deactivate`             | Sí   | Marca `isActive: false` |
| DELETE | `/delete-user`            | Sí   | Borra el usuario |

## Endpoints (`/api/products`)

> ⚠️ Ninguna ruta de productos está protegida con `authenticateToken` (CRUD abierto, sin auth).

| Método | Ruta        | Auth | Acción |
|--------|-------------|------|--------|
| POST   | `/`         | No   | Crea un producto |
| GET    | `/`         | No   | Lista todos los productos |
| PUT    | `/:id`      | No   | Actualiza un producto por id |
| DELETE | `/:id`      | No   | Borra un producto por id |

## Modelo User

Campos: `firstName`, `lastName`, `age` (≥13, opcional si es Google), `email` (único, validado), `password` (requerida y validada salvo Google), `authProvider` (`local`/`google`), `googleId`, `resetPasswordToken/Expires`, `isActive`, `isAdmin`.

- Hook `pre("save")`: hashea la contraseña con bcrypt si fue modificada.
- Hook `post("findOneAndUpdate")`: re-hashea si la contraseña actualizada no empieza con `$2b$`.

## Modelo Product

Campos (todos requeridos salvo `code`): `name` (trim), `description`, `color`, `dimensions` (String), `materials` (`[String]`), `type`, `photo` (URL/ruta de imagen), `code` (único).

- Hook `pre("save")`: si no hay `code`, genera uno con formato `PRD-XXXXXX` (6 dígitos aleatorios).

## Variables de entorno (`.env`, no versionado)

`MONGO_URI`, `JWT_SECRET`, `PORT`, `GOOGLE_CLIENT_ID`, `EMAIL_USER`, `EMAIL_PASS`, `NODE_ENV`.

## Cómo correr

No hay script `start`/`dev` definido. Ejecutar directamente:

```bash
npm install
node index.js        # levanta en http://localhost:3000 (o PORT)
```

## Notas

- El endpoint `/login` **solo** maneja autenticación con Google (decisión intencional). El `/register` local con contraseña existe, pero no hay login local por email/contraseña; queda así a propósito.
- Existen los módulos de **usuarios** y **productos**. El de usuarios sigue el patrón `Global*`; el de productos **no** (funciones sueltas, sin auth en sus rutas, y update/delete saltándose el DAO). Idealmente productos debería refactorizarse hacia el patrón `Global*` descrito arriba.
- `package.json` referencia un repo remoto antiguo (`emilynunezordonez/Bolsos_CAP_Backend`) distinto del `origin` actual (`SalomeAc/Bolsos-CAP-back`).
