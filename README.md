# Atelier API

Backend API service for **Atelier**, an AI-powered storyboarding tool for filmmakers.
Atelier streamlines the concept art and storyboarding phases of pre-production by
combining conversational AI, image generation, and professional annotation tools into a
single workflow.

This repository (`atelier-api`) is the **backend only**. The React frontend lives in a
separate repository.

> **Status:** Feature-complete. All phases (1–14) of
> [`BACKEND_DEVELOPMENT_PLAN.md`](BACKEND_DEVELOPMENT_PLAN.md) are implemented and
> covered by unit + integration tests. Live Google Gemini generation and real S3
> uploads require your own credentials (see [Environment Variables](#environment-variables)).

## What Atelier Does

**Concept Art Phase**
- Generate concept art through conversation with AI to visualize characters, settings, props, and art styles
- Upload your own reference images as alternatives to AI generation
- Build a component library of reusable visual elements with AI-digestible descriptions

**Storyboarding Phase**
- Organize your storyboard hierarchically: Acts → Scenes → Shots
- Compose shots by selecting components from your library and describing the action
- Generate storyboard frames using AI image generation (Google Gemini)
- Annotate frames with arrows, text boxes, and camera movement symbols
- Iterate on shots through conversation until they match your vision

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 20+, Express 5, TypeScript |
| **Database** | MySQL 8.0 (Knex query builder + migrations) |
| **Auth** | JWT (access/refresh with rotation), bcrypt, Joi validation |
| **AI Integration** | Google Gemini (Imagen image model + Flash text model), via REST |
| **Storage** | AWS S3 (presigned upload/download), `sharp` thumbnails |
| **Infrastructure** | AWS (ECS Fargate, S3, ALB, Secrets Manager) |
| **Containerization** | Docker + Docker Compose |
| **Testing** | Vitest (unit + v8 coverage), Testcontainers + Supertest (integration) |

## Quick Start

The fastest path is **Docker Compose**, which starts MySQL and the API together with
hot reload. Alternatively, run Node locally against your own MySQL.

### Option A — Docker Compose (recommended)

Requires Docker Desktop.

```bash
git clone https://github.com/szachbagley/atelier-api.git
cd atelier-api

# Build and start MySQL + the API (hot-reload dev server)
docker compose up -d --build

# Apply database migrations inside the backend container
docker compose exec backend npm run migrate

# The API is now at http://localhost:3000 (health: /health)
```

Notes:
- The database is published on host port **3308** (avoids colliding with a native MySQL
  on 3306); inside the Compose network the backend reaches it at `db:3306`.
- Dev secrets and dummy AWS values are set inline in `docker-compose.yml`. Provide real
  `AWS_*` / Gemini credentials to exercise live generation and uploads.
- Tear down with `docker compose down` (add `-v` to also drop the MySQL volume).

### Option B — Local Node + MySQL

#### Prerequisites

- Node.js 20+
- A MySQL 8.0 instance (Docker is the easiest way to run one locally)
- AWS credentials with S3 access (for reference-image and generated-image storage)
- A Google Gemini API key (configured per-user at runtime, not in `.env`)

#### Steps

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your values (see Environment Variables below)
   ```

3. **Start a MySQL database**

   Any MySQL 8.0 instance works. To run one locally with Docker:

   ```bash
   docker run --name atelier-db -e MYSQL_DATABASE=atelier \
     -e MYSQL_USER=atelier -e MYSQL_PASSWORD=localpassword \
     -e MYSQL_ROOT_PASSWORD=rootpassword -p 3306:3306 -d mysql:8.0
   ```

   Point `DATABASE_URL` at it (use `127.0.0.1:3306` rather than the `db` host when
   running outside Docker Compose).

4. **Run database migrations**

   ```bash
   npm run migrate
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   The API listens on `http://localhost:3000` (health check at
   `http://localhost:3000/health`).

### Environment Variables

Configuration is loaded from `.env` (see `.env.example`). Variables marked *optional*
fall back to the defaults shown. Google Gemini API keys are **not** set here — each user
stores their own encrypted key via `POST /api/user/api-keys` at runtime.

```bash
# Server
NODE_ENV=development             # optional (default: development)
PORT=3000                        # optional (default: 3000)

# Database
DATABASE_URL=mysql://atelier:localpassword@db:3306/atelier

# Authentication
JWT_ACCESS_SECRET=your-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRY=15m            # optional (default: 15m)
JWT_REFRESH_EXPIRY=7d            # optional (default: 7d)
BCRYPT_ROUNDS=12                 # optional (default: 12)

# Encryption (for storing user API keys at rest, AES-256-GCM)
ENCRYPTION_KEY=your-encryption-key-64-hex-chars

# Public-facing frontend app URL (used to build project share links)
PUBLIC_APP_URL=http://localhost:5173   # optional (default: http://localhost:5173)

# AWS (credentials are resolved by the AWS SDK default credential chain,
# not read by config — set them here for local development convenience)
AWS_REGION=us-west-2             # optional (default: us-west-2)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=atelier-dev

# CORS
CORS_ORIGINS=http://localhost:5173     # optional (default: http://localhost:5173)
```

## API Overview

All endpoints are under `/api` and (except registration/login/refresh and the public
shared view) require a `Bearer <accessToken>` header. Project-scoped routes enforce
ownership. Full request/response reference: [docs/API.md](docs/API.md).

| Group | Base path | Highlights |
|-------|-----------|------------|
| **Auth** | `/api/auth` | register, login, refresh (rotation + replay detection), logout, me |
| **User settings** | `/api/user/api-keys` | store/validate/delete an encrypted Gemini key |
| **Projects** | `/api/projects` | CRUD, soft-delete + restore, share/revoke public link |
| **Shared (public)** | `/api/shared/:shareToken` | read-only project tree, no auth |
| **Component library** | `/api/projects/:id/{art-style,characters,settings,props,lighting}` | CRUD + AI `generate-description`; characters have variants |
| **Storyboard** | `/api/projects/:id/{acts,scenes,shots}` | hierarchy, auto-sequencing, reorder, move, shot↔component junctions, annotations |
| **Images** | `/api/projects/:id/reference-images` | presign → confirm upload flow, thumbnails |
| **Generation** | `/api/projects/:id/shots/:id/{compile-prompt,generate,revert}` | prompt compilation, Gemini image generation, revert |
| **Concept art** | `/api/projects/:id/concept-sessions` | conversational generation, finalize into a component description |

Key behaviors:
- **snake_case ↔ camelCase:** DB columns are snake_case; API bodies are camelCase.
  Repositories own the boundary (`src/utils/caseMapping.ts`).
- **Soft deletes** everywhere (`deleted_at`), with restore and cascade-aware access checks.
- **Shot status machine:** `DRAFT → GENERATING → GENERATED | FAILED`, with
  `previous_image_id` tracking for revert.
- **Prompt-injection sanitization** is applied to all user text entering a prompt.

## Project Structure

```
atelier-api/
├── src/
│   ├── config/               # Environment configuration
│   ├── db/
│   │   ├── migrations/        # 19 Knex migrations
│   │   ├── repositories/      # Data access (snake↔camel boundary)
│   │   ├── init/              # Docker MySQL init SQL
│   │   └── knexfile.ts
│   ├── errors/               # Error classes and codes
│   ├── middleware/           # auth, authorize, validate, CORS, rate limiting, security headers
│   ├── routes/               # API route handlers + mounting
│   ├── schemas/              # Joi validation schemas
│   ├── services/
│   │   ├── auth/             # JWT + password hashing
│   │   ├── encryption/       # AES-256-GCM for user API keys
│   │   ├── storage/          # S3 client + presign/upload/thumbnail
│   │   ├── promptCompiler/   # Shot context → prompt (Gemini adapter)
│   │   └── imageGeneration/  # Gemini client + generation pipeline
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # caseMapping, sequencing, softDelete, logger
│   ├── app.ts                # Express app setup
│   └── server.ts             # Server entry point
├── tests/
│   ├── unit/                 # Vitest unit tests (services, middleware, utils, schemas)
│   ├── integration/          # Supertest + Testcontainers MySQL
│   └── fixtures/             # Test factories + mock shot context
├── docs/                     # Documentation (see below)
├── Dockerfile                # Multi-stage build (non-root, healthcheck)
├── docker-compose.yml        # Local dev: MySQL + backend
├── BACKEND_DEVELOPMENT_PLAN.md
├── FEATURE-TESTS.md          # Per-feature testing strategy
├── DISCREPANCIES.md          # Spec-vs-implementation reconciliation log
└── package.json
```

## Testing

Two suites (see [docs/TESTING.md](docs/TESTING.md) and
[FEATURE-TESTS.md](FEATURE-TESTS.md) for strategy):

- **Unit** (`npm test`) — fast, no I/O. Encryption, prompt compiler, auth/token logic,
  middleware, sequencing, soft-delete helpers, validation schemas. Coverage gate
  (`npm run test:coverage`) at 70/60/70/70 on the high-priority modules.
- **Integration** (`npm run test:integration`) — spins up a real MySQL 8 via
  Testcontainers (**Docker must be running**) and drives the Express app with Supertest:
  auth flows, project CRUD/authorization/sharing, shot sequencing/junctions/reorder/move,
  and the generation status machine (Gemini + S3 mocked).

```bash
npm run test:all           # unit + integration
```

## Development Commands

```bash
npm run dev               # Start development server with hot reload
npm run build             # Compile TypeScript to dist/
npm run start             # Start the compiled production server
npm run lint              # Run ESLint
npm run test              # Run unit tests
npm run test:watch        # Run unit tests in watch mode
npm run test:coverage     # Run unit tests with coverage
npm run test:integration  # Run integration tests (requires Docker)
npm run test:all          # Run the full test suite
npm run migrate           # Run database migrations
npm run migrate:make      # Scaffold a new migration
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, core concepts |
| [Database](docs/DATABASE.md) | Schema, table definitions, conventions |
| [API](docs/API.md) | REST API reference |
| [Backend](docs/BACKEND.md) | Backend implementation details |
| [Frontend](docs/FRONTEND.md) | Frontend implementation details |
| [Infrastructure](docs/INFRASTRUCTURE.md) | AWS setup, networking, services |
| [Deployment](docs/DEPLOYMENT.md) | CI/CD, Docker, deployment procedures |
| [Security](docs/SECURITY.md) | Authentication, encryption, security measures |
| [Testing](docs/TESTING.md) | Test strategy, patterns, examples |
| [Deferred Features](docs/DEFERRED_FEATURES.md) | Features planned for future versions |

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure the build, lint, and tests pass: `npm run build && npm run lint && npm run test:all`
4. Submit a pull request

## License

Proprietary - All rights reserved.
