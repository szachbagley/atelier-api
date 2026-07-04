# Atelier API

Backend API service for **Atelier**, an AI-powered storyboarding tool for filmmakers.
Atelier streamlines the concept art and storyboarding phases of pre-production by
combining conversational AI, image generation, and professional annotation tools into a
single workflow.

This repository (`atelier-api`) is the **backend only**. The React frontend lives in a
separate repository.

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
| **Runtime** | Node.js 20+, Express 5, TypeScript (ESM) |
| **Database** | MySQL 8.0 (Knex query builder + migrations) |
| **Infrastructure** | AWS (ECS Fargate, S3, ALB, Secrets Manager) |
| **AI Integration** | Google Gemini (Imagen) |
| **Containerization** | Docker |

## Quick Start

### Prerequisites

- Node.js 20+
- A MySQL 8.0 instance (Docker is the easiest way to run one locally)
- AWS CLI (configured with credentials for S3 access)
- Google Gemini API key

### Local Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/szachbagley/atelier-api.git
   cd atelier-api
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your values (see Environment Variables below)
   ```

4. **Start a MySQL database**

   Any MySQL 8.0 instance works. To run one locally with Docker:

   ```bash
   docker run --name atelier-db -e MYSQL_DATABASE=atelier \
     -e MYSQL_USER=atelier -e MYSQL_PASSWORD=localpassword \
     -e MYSQL_ROOT_PASSWORD=rootpassword -p 3306:3306 -d mysql:8.0
   ```

   Point `DATABASE_URL` at it (use `127.0.0.1` rather than the `db` host when running
   outside Docker Compose).

5. **Run database migrations**

   ```bash
   npm run migrate
   ```

6. **Start the development server**

   ```bash
   npm run dev
   ```

   The API listens on `http://localhost:3000` (health check at
   `http://localhost:3000/health`).

### Environment Variables

Configuration is loaded from `.env` (see `.env.example`). Variables marked *optional*
fall back to the defaults shown.

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

# Encryption (for storing user API keys)
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

## Project Structure

```
atelier-api/
├── src/
│   ├── config/           # Environment configuration
│   ├── db/               # Knex connection and migrations
│   │   └── migrations/   # Migration files
│   ├── errors/           # Error classes and codes
│   ├── middleware/       # Express middleware
│   ├── routes/           # API route handlers
│   ├── schemas/          # Joi validation schemas
│   ├── services/         # Business logic (auth, encryption, … per phase)
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── app.ts            # Express app setup
│   └── server.ts         # Server entry point
├── tests/
│   └── unit/             # Unit tests
├── docs/                 # Documentation (see below)
├── BACKEND_DEVELOPMENT_PLAN.md
└── package.json
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

## Development Commands

```bash
npm run dev               # Start development server with hot reload
npm run build             # Compile TypeScript to dist/
npm run start             # Start the compiled production server
npm run lint              # Run ESLint
npm run test              # Run unit tests
npm run test:watch        # Run unit tests in watch mode
npm run test:coverage     # Run unit tests with coverage
npm run test:integration  # Run integration tests
npm run test:all          # Run the full test suite
npm run migrate           # Run database migrations
npm run migrate:make      # Scaffold a new migration
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure the build, lint, and tests pass: `npm run build && npm run lint && npm run test:all`
4. Submit a pull request

## License

Proprietary - All rights reserved.
