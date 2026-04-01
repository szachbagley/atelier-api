# Atelier

Atelier is an AI-powered storyboarding tool for filmmakers. It streamlines the concept art and storyboarding phases of pre-production by combining conversational AI, image generation, and professional annotation tools into a single workflow.

## What It Does

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
| **Frontend** | React 18, TypeScript, Tailwind CSS, React Query, Zustand, Fabric.js |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | MySQL 8.0 |
| **Infrastructure** | AWS (ECS Fargate, S3, EC2, ALB, Secrets Manager) |
| **AI Integration** | Google Gemini (Imagen) |
| **Containerization** | Docker |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- AWS CLI (configured with credentials for S3 access)
- Google Gemini API key

### Local Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/atelier.git
   cd atelier
   ```

2. **Set up environment variables**

   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Edit backend/.env with your values

   # Frontend
   cp frontend/.env.example frontend/.env
   # Edit frontend/.env with your values
   ```

3. **Start the development environment**

   ```bash
   docker-compose up
   ```

   This starts:
   - Frontend dev server at `http://localhost:5173`
   - Backend API at `http://localhost:3000`
   - MySQL database at `localhost:3306`

4. **Run database migrations**

   ```bash
   cd backend
   npm run migrate
   ```

5. **Access the application**

   Open `http://localhost:5173` in your browser.

### Environment Variables

**Backend (`backend/.env`)**

```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=mysql://atelier:localpassword@db:3306/atelier

# Authentication
JWT_ACCESS_SECRET=your-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# Encryption (for storing user API keys)
ENCRYPTION_KEY=your-encryption-key-64-hex-chars

# AWS
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=atelier-dev

# CORS
CORS_ORIGINS=http://localhost:5173
```

**Frontend (`frontend/.env`)**

```bash
VITE_API_URL=http://localhost:3000
```

## Project Structure

```
atelier/
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration files
│   │   ├── db/               # Database connection and migrations
│   │   │   ├── migrations/   # Knex migration files
│   │   │   └── init/         # Init scripts for Docker
│   │   ├── errors/           # Error classes and codes
│   │   ├── middleware/       # Express middleware
│   │   ├── routes/           # API route handlers
│   │   ├── schemas/          # Joi validation schemas
│   │   ├── services/         # Business logic
│   │   │   ├── auth/
│   │   │   ├── encryption/
│   │   │   ├── imageGeneration/
│   │   │   ├── promptCompiler/
│   │   │   └── storage/
│   │   ├── types/            # TypeScript type definitions
│   │   ├── utils/            # Utility functions
│   │   ├── app.ts            # Express app setup
│   │   └── server.ts         # Server entry point
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/              # API client and endpoints
│   │   ├── assets/           # Static assets
│   │   ├── components/       # React components
│   │   │   ├── common/       # Shared UI components
│   │   │   ├── layout/       # Layout components
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── components-library/
│   │   │   ├── storyboard/
│   │   │   ├── annotations/
│   │   │   ├── generation/
│   │   │   └── settings/
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   ├── routes/           # Route definitions
│   │   ├── stores/           # Zustand stores
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Utility functions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests/
│   │   ├── unit/
│   │   └── e2e/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── BACKEND.md
│   ├── FRONTEND.md
│   ├── INFRASTRUCTURE.md
│   ├── DEPLOYMENT.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   └── DEFERRED_FEATURES.md
│
├── docker-compose.yml        # Local development setup
└── README.md
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

**Backend**

```bash
cd backend

npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:integration  # Run integration tests
npm run migrate      # Run database migrations
```

**Frontend**

```bash
cd frontend

npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run unit tests
npm run test:e2e     # Run Playwright E2E tests
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass: `npm run test:all`
4. Submit a pull request

## License

Proprietary - All rights reserved.
