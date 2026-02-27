---
name: Express API
slug: express-api
agentType: coder
category: api
tags: [express, prisma, typescript, rest-api, node]
tools: [terminal, filesystem]
description: Crear una REST API robusta con Express, TypeScript y Prisma ORM
---

# Express API Skill

## Objetivo
Crear una REST API production-ready con autenticación, validación, y base de datos relacional.

## Stack
- Node.js 20+ con Express 4
- TypeScript strict mode
- Prisma ORM con PostgreSQL (o SQLite para desarrollo rápido)
- Zod para validación de schemas
- JWT para autenticación
- Pino para logging

## Pasos

1. **Inicializar proyecto**
   ```bash
   mkdir {name} && cd {name}
   npm init -y
   npm install express cors helmet dotenv jsonwebtoken bcryptjs zod pino pino-pretty
   npm install -D typescript @types/express @types/cors @types/jsonwebtoken @types/bcryptjs @types/node ts-node-dev prisma
   npx tsc --init
   ```

2. **Configurar TypeScript** en `tsconfig.json`:
   - target: ES2022, module: NodeNext
   - outDir: ./dist, rootDir: ./src
   - strict: true, esModuleInterop: true

3. **Inicializar Prisma**:
   ```bash
   npx prisma init --datasource-provider sqlite
   ```

4. **Crear estructura**:
   ```
   src/
   ├── routes/        # Route handlers
   ├── middleware/     # Auth, validation, error handling
   ├── services/      # Business logic
   ├── lib/           # Utilities (logger, jwt, etc.)
   ├── types/         # TypeScript types
   └── index.ts       # Entry point
   ```

5. **Definir Prisma schema** según los requirements del usuario

6. **Crear middleware**:
   - `auth.ts`: JWT verification middleware
   - `validate.ts`: Zod schema validation middleware
   - `error-handler.ts`: Global error handler con logging

7. **Crear rutas CRUD** según entidades del schema:
   - GET /api/{resource} — listar (con paginación)
   - GET /api/{resource}/:id — detalle
   - POST /api/{resource} — crear (con validación Zod)
   - PUT /api/{resource}/:id — actualizar
   - DELETE /api/{resource}/:id — eliminar

8. **Agregar scripts** en package.json:
   ```json
   "dev": "ts-node-dev --respawn src/index.ts",
   "build": "tsc",
   "start": "node dist/index.js"
   ```

9. **Verificar**: `npm run build` compila sin errores

## Design Guidelines
- RESTful naming conventions
- Respuestas JSON consistentes: `{ data, error, meta }`
- HTTP status codes correctos (200, 201, 400, 401, 404, 500)
- Paginación con cursor o offset
- Rate limiting en endpoints sensibles
- CORS configurado correctamente
- Environment variables para toda config sensible

## Convenciones
- Controllers delgados — lógica en services
- Un archivo por ruta (users.ts, products.ts, etc.)
- Validación en la capa de middleware, no en controllers
- Prisma client como singleton
- Logging estructurado con pino
