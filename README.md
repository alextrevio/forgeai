# ForgeAI

AI-powered full-stack application builder. Describe what you want, and ForgeAI's multi-agent system writes the code, previews it live, and deploys it — all from your browser.

## Architecture

```
forgeai/
├── apps/
│   ├── api/          # Express API server (Node.js)
│   └── web/          # Next.js frontend
├── packages/
│   ├── agents/       # Multi-agent system (Planner, Coder, Designer, Debugger, Reviewer)
│   ├── db/           # Prisma ORM + PostgreSQL schema
│   ├── sandbox-manager/  # Per-project sandboxed dev servers
│   └── shared/       # Shared types and utilities
├── nginx/            # Reverse proxy config
├── docker-compose.prod.yml
└── .github/workflows/  # CI/CD pipelines
```

### Tech Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Frontend    | Next.js 15, React 19, Tailwind CSS  |
| Backend     | Express 4, Socket.IO, Zod           |
| Database    | PostgreSQL 16, Prisma ORM           |
| AI          | Anthropic Claude, OpenAI (pluggable)|
| Sandboxing  | Vite dev servers per project         |
| Auth        | JWT (15m access + 7d refresh rotation), API keys |
| Deployment  | Docker Compose, Nginx, GitHub Actions|

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 16+ (or use Docker)

### Development Setup

```bash
# Clone and install
git clone <repo-url> forgeai
cd forgeai
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your values (DATABASE_URL, JWT secrets, etc.)

# Setup database
cd packages/db
npx prisma generate
npx prisma db push
cd ../..

# Start development
pnpm turbo dev
```

The API runs on `http://localhost:8000` and the frontend on `http://localhost:3000`.

### Docker (Production)

```bash
# Configure environment
cp .env.example .env
# Edit .env with production values

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker compose -f docker-compose.prod.yml exec api npx prisma db push
```

Services:
- **Frontend**: http://localhost (via nginx)
- **API**: http://localhost/api
- **Health**: http://localhost/api/health

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full production deployment guide.

## Project Structure

### API Endpoints

See [docs/API.md](docs/API.md) for the complete API reference.

Key endpoints:
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Get access + refresh tokens
- `POST /api/auth/refresh` — Rotate refresh token
- `POST /api/projects` — Create new project
- `POST /api/projects/:id/messages` — Send message to AI agent
- `GET /api/health` — Health check with DB status
- `GET /api/metrics` — Application metrics (authenticated)

### Agent System

ForgeAI uses a multi-agent pipeline:

1. **Planner** — Breaks down user requests into implementation steps
2. **Coder** — Generates code changes based on the plan
3. **Designer** — Ensures consistent UI/UX with Tailwind CSS
4. **Debugger** — Fixes errors detected in the sandbox
5. **Reviewer** — Reviews code quality and suggests improvements

### Security

- Helmet HTTP security headers
- CORS with configurable allowed origins
- Zod request validation on all endpoints
- Plan-based rate limiting (FREE: 20 req/min, PRO: 60, BUSINESS: 120, ENTERPRISE: 300)
- JWT with 15-minute access tokens + 7-day refresh token rotation
- API key authentication (`fai_` prefix) as JWT alternative
- AES-256-GCM encryption for sensitive stored fields
- Pino structured logging with secret redaction

## Environment Variables

See [.env.example](.env.example) for all configuration options.

## License

Proprietary. All rights reserved.
