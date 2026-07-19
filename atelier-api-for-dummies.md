# Atelier API for Dummies

A friendly, detailed tour of this codebase for a **junior developer** who is new to the
project. It assumes you can read JavaScript/TypeScript and have seen a web server before,
but it does **not** assume you know this codebase, Knex, JWTs, or the design patterns we
use. We'll build up from the big picture to the details, and end with a step-by-step
recipe for adding your own feature.

> If you only read one section, read **"The life of a request"** — everything else is
> elaboration on it.

---

## Table of contents

1. [What is this thing?](#1-what-is-this-thing)
2. [The 30-second mental model](#2-the-30-second-mental-model)
3. [Concepts you should be comfortable with](#3-concepts-you-should-be-comfortable-with)
4. [Running it locally](#4-running-it-locally)
5. [The big picture: layered architecture](#5-the-big-picture-layered-architecture)
6. [The life of a request](#6-the-life-of-a-request)
7. [Directory tour](#7-directory-tour)
8. [Core patterns, explained](#8-core-patterns-explained)
9. [The domain model](#9-the-domain-model)
10. [Feature areas](#10-feature-areas)
11. [Testing](#11-testing)
12. [Docker](#12-docker)
13. [The rules (conventions & gotchas)](#13-the-rules-conventions--gotchas)
14. [Recipe: adding a new feature](#14-recipe-adding-a-new-feature)
15. [Glossary](#15-glossary)

---

## 1. What is this thing?

**Atelier** is an AI-powered storyboarding tool for filmmakers. This repo (`atelier-api`)
is the **backend** — a REST API. The frontend (a React app) lives in a different repo and
talks to this one over HTTP.

The backend's job is to:
- Manage user accounts and logins.
- Store each user's **projects** and everything inside them (characters, settings, props,
  acts, scenes, shots, images…).
- Talk to **Google Gemini** to generate images and text.
- Store images in **AWS S3**.

It's a fairly standard **CRUD API** (Create, Read, Update, Delete) with two interesting
twists: AI image generation and a hierarchical storyboard structure.

---

## 2. The 30-second mental model

A request comes in over HTTP. It flows through a pipeline:

```
HTTP request
   → middleware (logging, security, auth, validation)
   → a route handler (the "controller")
   → a service (business logic) and/or a repository (database access)
   → MySQL / S3 / Gemini
   → a JSON response flows back out
```

Every layer has one responsibility. Route handlers stay thin; the real logic lives in
**services** and **repositories**. If you keep that separation in your head, the code will
feel predictable.

---

## 3. Concepts you should be comfortable with

You don't need to be an expert, but skim these if any are unfamiliar:

- **TypeScript** — JavaScript with types. Types are checked at build time (`npm run build`
  runs the compiler `tsc`) and then erased; at runtime it's plain JavaScript.
- **Express 5** — the web framework. You define `app.use(...)` middleware and
  `router.get('/path', handler)` routes. A big feature of Express 5: if an `async` handler
  throws, Express automatically forwards the error to the error handler — so we rarely
  write `try/catch` in route handlers.
- **async/await** — almost every function that touches the DB or network is `async` and we
  `await` it. If you forget an `await`, you get a `Promise` instead of a value — a very
  common bug.
- **SQL / relational databases** — we use MySQL. You don't write raw SQL much; you use
  **Knex**, a query builder (`db('users').where({ id }).first()`).
- **JWT (JSON Web Token)** — a signed string that proves "this request is from user X". We
  use them for auth. More on this below.
- **Environment variables** — configuration (secrets, DB URL) comes from the environment,
  loaded from a `.env` file locally. Never hardcode secrets.

---

## 4. Running it locally

Two ways. The fastest is Docker Compose (starts MySQL + the API together):

```bash
docker compose up -d --build
docker compose exec backend npm run migrate   # create the DB tables
curl localhost:3000/health                     # → {"status":"ok"}
```

Or run Node directly against your own MySQL (see the README's "Option B"). Either way:

- The server entry point is `src/server.ts`. It imports the Express `app` and calls
  `app.listen(port)`.
- `GET /health` returns `{"status":"ok"}` and is used by infra to check liveness.
- Everything else is under `/api`.

`src/server.ts` also wires up **graceful shutdown** (on `SIGTERM`/`SIGINT` it stops
accepting connections, finishes in-flight ones, then exits) and crashes hard on
`uncaughtException`/`unhandledRejection` so a broken process doesn't linger in a zombie
state.

---

## 5. The big picture: layered architecture

We use a classic **layered architecture**. Each layer only talks to the one below it:

```
┌─────────────────────────────────────────────────────────┐
│  Routes (src/routes)         "controllers" — thin        │
│  parse the request, call services/repos, shape the JSON  │
├─────────────────────────────────────────────────────────┤
│  Services (src/services)     business logic              │
│  auth, encryption, prompt compiling, image generation    │
├─────────────────────────────────────────────────────────┤
│  Repositories (src/db/repositories)   database access    │
│  the ONLY place that runs SQL for a given table          │
├─────────────────────────────────────────────────────────┤
│  Infra: MySQL (Knex), AWS S3, Google Gemini              │
└─────────────────────────────────────────────────────────┘

Cross-cutting (used by every layer):
  config · errors · middleware · schemas (validation) · utils · types
```

**Why bother?** Because when you need to change something you know exactly where to look.
Database query wrong? It's in a repository. Validation wrong? It's in a schema. Status code
wrong? It's in a route or an error class. You never have to read the whole codebase.

---

## 6. The life of a request

Let's trace a real one: **"create a shot in a scene"**, i.e.
`POST /api/projects/:projectId/scenes/:sceneId/shots`.

### Step 0 — App setup (`src/app.ts`)

`app.ts` builds the Express app and registers global middleware **in order**:

```ts
app.use(requestId);          // assign every request a unique id (for log tracing)
app.use(pinoHttp({...}));    // structured logging
app.use(securityHeaders);    // Helmet — safe HTTP headers
app.use(corsMiddleware);     // only allow configured frontend origins
app.use(cookieParser());     // parse cookies (refresh token lives in a cookie)
app.use(express.json({ limit: '1mb' }));  // parse JSON bodies
app.get('/health', ...);     // health check (exempt from rate limiting)
app.use('/api', globalLimiter, apiRouter); // everything else, rate-limited
app.use(errorHandler);       // catches everything that throws
```

Order matters: middleware runs top to bottom. `errorHandler` is **last** because Express
error handlers (functions with 4 args) are only reached when something throws.

### Step 1 — Routing (`src/routes/index.ts`)

`apiRouter` mounts sub-routers by URL prefix. Our request matches:

```ts
apiRouter.use('/projects/:projectId/scenes/:sceneId/shots', sceneShotsRouter);
```

Note `:projectId` and `:sceneId` are **URL parameters**. The sub-router is created with
`Router({ mergeParams: true })` so it can still see those parent params.

### Step 2 — Per-router middleware (`src/routes/shots.ts`)

```ts
sceneShotsRouter.use(authenticate, requireProjectAccess);
sceneShotsRouter.use(async (req, _res, next) => { /* verify scene ∈ project */ });
```

- `authenticate` reads the `Authorization: Bearer <token>` header, verifies the JWT, and
  sets `req.user = { id, email }`. No token → it throws `401`.
- `requireProjectAccess` loads the project named in the URL, checks the logged-in user
  **owns** it, and sets `req.project`. Not the owner (or unknown id) → `403`.
- The third middleware checks the scene actually belongs to that project (through an active
  act). Not found → `404`.

This is **defense in depth**: by the time the handler runs, we already know the user is
authenticated, owns the project, and the scene is valid.

### Step 3 — Validation (`validate(createShotSchema)`)

```ts
sceneShotsRouter.post('/', validate(createShotSchema), async (req, res) => { ... });
```

`validate(schema)` is middleware that checks `req.body` against a **Joi schema**. If the
body is invalid it throws a `400` with a list of bad fields. If valid, it **replaces**
`req.body` with a cleaned version (unknown fields stripped). So inside the handler,
`req.body` is guaranteed well-formed.

### Step 4 — The handler (thin!)

```ts
sceneShotsRouter.post('/', validate(createShotSchema), async (req, res) => {
  const data = req.body as shotRepository.CreateShotData;
  await assertComponentRefsInProject(projectIdOf(req), data);   // referenced ids valid?
  const shot = await shotRepository.create(sceneIdOf(req), data);
  res.status(201).json(shot);
});
```

The handler does almost nothing itself: it checks that any referenced components (setting,
characters, props) belong to the project, then delegates to the **repository** to do the
insert, then returns `201 Created` with the new shot.

### Step 5 — The repository (`src/db/repositories/shotRepository.ts`)

`create()` runs the SQL: it auto-assigns a `sequence_number`, inserts the row, inserts the
character/prop **junction table** rows, all inside a **transaction** (so it's all-or-
nothing), and returns the new shot **in camelCase**.

### Step 6 — The response

The repository returns a plain object; the handler `res.json(...)`s it. On the way out,
`pino-http` logs the request/response with the request id and status code.

### If anything threw…

Any thrown error (from validation, auth, a repository, whatever) skips the rest of the
handler and lands in `errorHandler` (`src/middleware/errorHandler.ts`), which converts it
to a consistent JSON error shape. **You never call `res.status(500)` yourself** — you throw
an error and let the handler format it.

---

## 7. Directory tour

```
src/
├── config/          Reads env vars once, exports a typed `config` object.
├── db/
│   ├── index.ts         Creates the Knex `db` connection (one shared instance).
│   ├── knexfile.ts      Knex config (per-environment).
│   ├── migrations/      19 files that build the schema, in order.
│   ├── repositories/    One file per table/aggregate; the ONLY place SQL lives.
│   └── init/            SQL the Docker MySQL runs on first boot.
├── errors/          AppError class hierarchy + the ErrorCodes catalog.
├── middleware/      Reusable request-pipeline steps (auth, validate, cors, …).
├── routes/          Route handlers ("controllers"), grouped by feature.
├── schemas/         Joi validation schemas (one per feature).
├── services/        Business logic that isn't just a DB query:
│   ├── auth/            JWT + password hashing + refresh rotation.
│   ├── encryption/      AES-256-GCM for user API keys.
│   ├── storage/         AWS S3 (presign, upload, thumbnails).
│   ├── promptCompiler/  Turns a shot + its components into a text prompt.
│   └── imageGeneration/ Calls Gemini, stores the result, updates the shot.
├── types/           TypeScript interfaces for DB rows and enums (models.ts).
├── utils/           Small shared helpers (caseMapping, sequencing, softDelete, logger).
├── app.ts           Builds the Express app (middleware + routes).
└── server.ts        Starts the HTTP server; graceful shutdown.
```

**A useful habit:** when reading a feature, open its four files together — the **schema**
(`schemas/x.ts`), the **route** (`routes/x.ts`), the **repository**
(`db/repositories/xRepository.ts`), and sometimes a **service** (`services/x/`). Those four
tell the whole story.

---

## 8. Core patterns, explained

These patterns recur everywhere. Learn them once and the whole codebase opens up.

### 8.1 Config (`src/config/index.ts`)

All environment variables are read in **one place** and exported as a typed object:

```ts
export const config = {
  database: { url: required('DATABASE_URL') },
  auth: { accessTokenSecret: required('JWT_ACCESS_SECRET'), ... },
  encryption: { key: required('ENCRYPTION_KEY') },
  ...
};
```

`required('X')` throws at startup if `X` is missing (fail fast — better than a confusing
error hours later). `optional('X', 'default')` provides a fallback. **Never** read
`process.env` anywhere else — always go through `config`.

### 8.2 The database connection (`src/db/index.ts`)

```ts
export const db = knex(knexConfig);
```

There's exactly **one** `db` object shared across the app (a connection pool under the
hood). Everyone imports this same `db`. `knexfile.ts` points it at `config.database.url`.

### 8.3 Migrations (`src/db/migrations/`)

The database schema is defined by **migration files**, numbered `001_…` to `019_…`. Each
exports an `up()` (apply the change) and `down()` (undo it). You never edit the DB by hand;
you write a migration and run `npm run migrate`. This keeps every environment's schema
identical and reproducible.

To add a table/column, run `npm run migrate:make my_change` to scaffold a new file.

### 8.4 The repository pattern (`src/db/repositories/`)

**Rule: SQL for a given table lives in exactly one repository file.** Routes and services
never build queries directly. Benefits: queries are reused, the snake/camel conversion
happens in one spot, and soft-delete filters are applied consistently.

A repository does three jobs:

1. Run the query with Knex.
2. Convert **snake_case** DB columns to **camelCase** for the API.
3. Apply soft-delete filters and any type coercion.

Example from `projectRepository.ts`:

```ts
function toRecord(row: Project): ProjectRecord {
  const record = toCamelRow<ProjectRecord>(row);  // is_public → isPublic, etc.
  record.isPublic = Boolean(row.is_public);        // MySQL tinyint(1) → real boolean
  return record;
}
```

### 8.5 snake_case ↔ camelCase (`src/utils/caseMapping.ts`)

MySQL columns are `snake_case` (`created_at`, `is_public`). Our JSON API is `camelCase`
(`createdAt`, `isPublic`). Repositories translate at the boundary:

- `toCamelRow(row)` / `toCamelRows(rows)` — DB → API (on the way out).
- `toSnakeRow(obj)` — API → DB (on the way in, for updates).

The conversion is **shallow** (only top-level keys). Values — `Date`s, parsed JSON columns
— pass through untouched.

### 8.6 Soft deletes (`src/utils/softDelete.ts`)

We almost never actually delete rows. Instead every table has a `deleted_at` timestamp
column. "Deleting" sets `deleted_at = now()`; "restoring" sets it back to `null`.

```ts
softDelete(db, 'projects', id);   // sets deleted_at = now()
restore(db, 'projects', id);      // sets deleted_at = null
addActiveFilter(query);           // adds `WHERE deleted_at IS NULL`
```

**Golden rule:** every read query must filter out soft-deleted rows with
`addActiveFilter` (or a manual `whereNull('deleted_at')`) — **unless** you're explicitly
operating on deleted rows (like restore). ⚠️ When a query **joins** other tables that also
have `deleted_at`, `addActiveFilter`'s unqualified `deleted_at` is ambiguous — you must
qualify it per table (e.g. `whereNull('scenes.deleted_at')`). This has bitten us before.

### 8.7 Sequencing (`src/utils/sequencing.ts`)

Acts, scenes, and shots are **ordered**. Instead of numbering them 1, 2, 3 (which forces
renumbering everything on every insert), we space them out by `SEQUENCE_GAP = 1000`: the
first is `1000`, the next `2000`, etc. To insert between two items you pick the midpoint.
When the list is explicitly reordered, we renumber cleanly as `(index+1) * 1000`.

```ts
getNextSequenceNumber(db, 'shots', 'scene_id', sceneId); // max + 1000
```

### 8.8 Validation (`src/schemas/` + `src/middleware/validate.ts`)

We validate **all** input with [Joi](https://joi.dev/) before using it. Schemas describe
the allowed shape:

```ts
export const createShotSchema = Joi.object({
  description: Joi.string().max(5000).allow('', null),
  shotType: Joi.string().valid('EWS','WS','FS', ...).allow(null),
  characters: Joi.array().items(Joi.object({
    characterId: Joi.string().uuid().required(),
    variantId: Joi.string().uuid().allow(null),
  })),
  ...
});
```

The `validate(schema)` middleware runs it with `{ abortEarly: false, stripUnknown: true }`
— it reports **all** errors at once and **drops** any fields you didn't declare (so a
client can't sneak extra columns in). Invalid → `400` with `details.fields`. There are
three variants: `validate` (body), `validateParams` (URL params), `validateQuery`
(query string).

### 8.9 Error handling (`src/errors/` + `src/middleware/errorHandler.ts`)

We throw typed errors and let one central handler format them. The base is `AppError`:

```ts
class AppError extends Error {
  constructor(public code, public statusCode, message, public details?) { ... }
  toResponse(requestId) { return { error: { code, message, details, requestId } }; }
}
```

Subclasses set a sensible status code:

| Class | Status | When |
|-------|--------|------|
| `ValidationError` | 400 | bad input |
| `UnauthorizedError` | 401 | not logged in / bad token |
| `ForbiddenError` | 403 | logged in but not allowed |
| `NotFoundError` | 404 | resource doesn't exist |
| `ConflictError` | 409 | state conflict (e.g. already generating) |
| `ApiKeyError` / `GenerationError` | 422 | key/generation problems |
| `ProviderError` | 502 | upstream (Gemini/S3) failed |

Every error also carries a **machine-readable code** from `src/errors/codes.ts`
(`AUTH_TOKEN_EXPIRED`, `RES_NOT_FOUND`, `GEN_ALREADY_IN_PROGRESS`, …). The frontend
switches on the `code`, not the human message.

`errorHandler` (registered last in `app.ts`):
- If it's an `AppError` → use its status + shape. Logs `warn` for 4xx, `error` for 5xx.
- If it's a raw Joi or JWT error → map to the right 400/401.
- Anything else (an unexpected bug) → log it fully, but return a generic
  `500 "An unexpected error occurred"` so we never leak internals to clients.

Every error response includes the `requestId` so you can find the matching log line.

### 8.10 Authentication (`src/services/auth/authService.ts` + middleware)

We use **two** JWTs:

- **Access token** — short-lived (15 min). Sent by the client as
  `Authorization: Bearer <token>` on every request. `authenticate` middleware verifies it.
- **Refresh token** — long-lived (7 days). Stored in an **HttpOnly cookie** (JavaScript
  can't read it, which mitigates XSS). Used only to get a new access token via
  `POST /api/auth/refresh`.

**Refresh rotation + replay detection** (the clever part): every time you refresh, the old
refresh token is marked as replaced by the new one (`replaced_by_id`). If someone tries to
use an already-rotated token (a sign it was stolen), we detect it, **revoke the whole
token family**, and reject the request. Refresh tokens are stored **hashed** (SHA-256), so
a database leak doesn't expose usable tokens.

Also note the **login timing defense**: `login()` always runs `bcrypt.compare` — even when
the email doesn't exist (against a dummy hash) — so an attacker can't tell which emails are
registered by measuring response time.

The two auth middleware you'll use constantly:
- `authenticate` — "is this a valid logged-in user?" → sets `req.user`.
- `requireProjectAccess` (`src/middleware/authorize.ts`) — "does this user own the project
  in the URL?" → sets `req.project`. Returns `403` for both "not yours" and "doesn't
  exist" (intentionally indistinguishable, so you can't probe for which project ids exist).

### 8.11 Encrypting user API keys (`src/services/encryption/encryptionService.ts`)

Users bring their own Google Gemini API key. We **never** store it in plaintext. We encrypt
it with **AES-256-GCM**:

- A fresh random salt + IV per encryption, so the same key never produces the same
  ciphertext.
- The GCM auth tag detects tampering on decrypt (a flipped byte throws).
- The master key comes from `config.encryption.key` (a 64-hex-char env var).

`generateKeyHint('sk-...1234')` → `'•••••1234'` for safe display in the UI.

---

## 9. The domain model

The core entities (all defined as TypeScript interfaces in `src/types/models.ts`, one
table each):

```
User
 └── Project (owned by a user; soft-deletable; shareable via a token)
      ├── ArtStyle           (exactly one per project)
      ├── Character          (has many Variants — e.g. "Ada", "Ada in armor")
      ├── Setting            (a location: description, time of day, weather)
      ├── Prop
      ├── LightingSetup
      ├── ReferenceImage / GeneratedImage   (stored in S3)
      ├── ConceptArtSession  (a chat that generates concept art)
      └── Act                 ┐
           └── Scene          │  the storyboard hierarchy (all ordered by
                └── Shot       ┘  sequence_number)
                     ├── ShotCharacter (junction: which characters are in the shot)
                     └── ShotProp       (junction: which props are in the shot)
```

Things worth internalizing:
- **Everything is scoped to a project**, and a project is owned by one user. That's why so
  many URLs start `/api/projects/:projectId/...` and go through `requireProjectAccess`.
- **Acts → Scenes → Shots** is the storyboard spine. A shot is where the AI image lives.
- A **Shot** references components (a setting, lighting, characters, props). Characters and
  props are many-to-many via **junction tables** (`shot_characters`, `shot_props`).
- A shot has a **status**: `DRAFT → GENERATING → GENERATED | FAILED`, plus a
  `previous_image_id` so you can revert to the prior image.

---

## 10. Feature areas

A quick map from URL group → files. Full request/response detail is in `docs/API.md`.

### Auth & users
`routes/auth.ts`, `routes/userSettings.ts`, `services/auth/`. Register, login, refresh,
logout, `me`, and storing/validating the user's encrypted Gemini key.

### Projects & sharing
`routes/projects.ts`, `routes/shared.ts`, `db/repositories/projectRepository.ts`. CRUD,
soft-delete + restore, and a public share link. `shared.ts` is the only place an
unauthenticated user can read data — it serves a read-only project tree by share token.

### Component library
`routes/{artStyle,characters,variants,settings,props,lighting}.ts`. Most reuse a shared
CRUD factory in `routes/componentHelpers.ts` (`makeComponentCrudRouter`) so we don't
repeat the same GET/POST/PATCH/DELETE for each component type. Each supports an AI
`generate-description` endpoint that asks Gemini to write a description used later in
prompts.

### Storyboard
`routes/{acts,scenes,shots}.ts`, `db/repositories/{act,scene,shot}Repository.ts`. The
hierarchy, with auto-sequencing, **reorder** (pass the full ordered id list; we renumber),
**move** (relocate a shot/scene to another parent), and the shot↔component junctions.
`shot.ts`'s schema also validates freeform **annotations** (arrows, text boxes, camera
symbols) with a discriminated-union Joi schema.

### Images & S3
`services/storage/`, `routes/referenceImages.ts`,
`db/repositories/generatedImageRepository.ts`. Uploads use a **presign → confirm** flow:
the client asks us for a temporary signed S3 URL, uploads directly to S3, then calls
`confirm`, at which point we verify the object exists (S3 `HEAD`) and generate a thumbnail
with `sharp`. Presigning is a local cryptographic computation — it works even with dummy
credentials (handy for local dev/tests).

### Prompt compiler
`services/promptCompiler/`. Turns a shot plus all its components into a single text prompt.
`PromptCompiler.ts` is an abstract base that assembles sections in a **fixed order**
(framing → description → characters → props → setting → lighting → style → quality);
`geminiAdapter.ts` renders those sections as natural prose for Gemini. Key safety feature:
`sanitizeForPrompt` strips brackets/code-fences/excess newlines from **all** user text so
users can't inject instructions into the prompt. If the prompt exceeds 1500 chars it
returns a `GEN_PROMPT_TOO_LONG` error object instead of a prompt.

### Image generation
`services/imageGeneration/`. `geminiClient.ts` calls Gemini over plain `fetch` (no SDK).
`index.ts` orchestrates the pipeline and the **status machine**:

```ts
// generateForShot(userId, projectId, shotId, editedPrompt?)
if (shot.status === 'GENERATING') throw new ConflictError(GEN_ALREADY_IN_PROGRESS); // 409
// resolve the prompt BEFORE flipping status, so a bad prompt leaves it DRAFT, not stuck
await db('shots').update({ status: 'GENERATING' });
try {
  const result = await generateFromPrompt(...);  // Gemini → S3 → thumbnail → DB record
  await db('shots').update({ status: 'GENERATED', generated_image_id, previous_image_id });
} catch (err) {
  await db('shots').update({ status: 'FAILED' });  // never leave it stuck GENERATING
  throw err;
}
```

That "resolve prompt first, always land in a terminal state" design is the important bit —
study it.

### Concept art sessions
`routes/conceptSessions.ts`, `db/repositories/conceptSessionRepository.ts`. A
conversational flow: each user message triggers an image generation; **finalize** turns a
chosen image into a component's AI description and marks the session `COMPLETED`.

---

## 11. Testing

Two suites (strategy is documented per-feature in `FEATURE-TESTS.md`).

### Unit tests (`tests/unit/`, run with `npm test`)
Fast, no I/O. They test pure logic in isolation: encryption round-trips, the prompt
compiler, token verification, the `validate`/`authenticate` middleware, sequencing, and
soft-delete helpers. Config for these is `vitest.config.ts`, which also enforces a
**coverage gate** (`npm run test:coverage`, thresholds 70/60/70/70) on the high-priority
modules.

Tests are organized by mirror of `src/`: `tests/unit/{services,middleware,utils,schemas}`.
`tests/unit/setup.ts` sets fake env vars before anything imports `config`.

### Integration tests (`tests/integration/`, run with `npm run test:integration`)
Slower, realistic. They **require Docker**: `tests/integration/globalSetup.ts` spins up a
real MySQL 8 in a throwaway container (via Testcontainers), applies the migrations, and
publishes the connection URL. Then each test drives the **real Express app** with
[Supertest](https://github.com/ladjs/supertest) — actual HTTP requests, real DB writes.
Between tests, `truncateTables` wipes the data so tests don't interfere.

External services (Gemini, S3) are **mocked** in `generation.test.ts` with `vi.mock`, so we
test our pipeline and status machine without real credentials.

> Fun fact: writing these tests caught a real bug — `GEN_ALREADY_IN_PROGRESS` was returning
> `422` when `docs/API.md` says `409`. Tests are worth it.

### Test fixtures (`tests/fixtures/index.ts`)
Factory functions (`createTestUser`, `createTestProject`, `createTestShot`, …) that insert
rows and return their ids, plus `createMockShotContext` for prompt-compiler tests. Use
these instead of hand-building objects in every test.

Run everything: `npm run test:all`.

---

## 12. Docker

- **`Dockerfile`** — a multi-stage build. `builder` installs all deps and compiles;
  `prod-deps` prunes dev dependencies; `production` copies just the compiled `dist/` +
  production `node_modules` into a small image, runs as a **non-root** user, and has a
  `HEALTHCHECK` hitting `/health`.
- **`docker-compose.yml`** — for local dev. Starts MySQL and the API together. It targets
  the `builder` stage and mounts `./src` so you get **hot reload**. The DB is published on
  host port **3308** (to avoid clashing with a local MySQL on 3306); inside the network the
  API reaches it at `db:3306`.
- **`src/db/init/01-init.sql`** — runs once when the MySQL container's data volume is first
  created (charset/grants).

---

## 13. The rules (conventions & gotchas)

Internalize these — they're the difference between code that fits in and code that gets
sent back in review:

1. **Routes are thin.** Business logic goes in a service; SQL goes in a repository.
2. **Never read `process.env` outside `config/`.** Import `config`.
3. **Never run SQL outside a repository** (routes/services import repositories).
4. **Repositories convert case.** Rows leave in camelCase; updates go in as snake_case.
5. **Always filter soft-deleted rows** on reads (`addActiveFilter` / `whereNull`), and
   **qualify `deleted_at`** when joining tables that also have it.
6. **Validate all input** with a Joi schema via `validate(...)` before using it.
7. **Don't `res.status(500)` manually** — throw an `AppError` (or let it bubble) and the
   `errorHandler` formats it. Give it the right **code** from `errors/codes.ts`.
8. **Match `docs/API.md`.** Status codes and error codes are a contract with the frontend.
9. **Multi-table writes use a transaction** (shot + junctions, project + art style, token
   rotation). All-or-nothing.
10. **Never log secrets or full API keys.** The logger serializers are deliberately minimal.
11. **`await` everything async.** A missing `await` is the classic silent bug here.
12. **This project compiles to CommonJS.** Imports are written with a `.js` suffix
    (`'./foo.js'`) even though the source is `foo.ts` — that's expected. **Don't use
    `import.meta`**; use `__dirname`.
13. **Update `docs/`, `FEATURE-TESTS.md` when you change behavior**, in the same PR.

---

## 14. Recipe: adding a new feature

Say you're asked to add "tags" to a project. Here's the well-worn path:

1. **Migration** — `npm run migrate:make create_tags`, write `up()`/`down()` to create the
   `tags` table (include `id`, `project_id`, timestamps, and `deleted_at`). Run
   `npm run migrate`.
2. **Types** — add a `Tag` interface to `src/types/models.ts` matching the columns.
3. **Repository** — create `src/db/repositories/tagRepository.ts`. Write `create`,
   `findByProject`, `update`, `remove` (soft delete). Use `toCamelRow`/`toSnakeRow`, apply
   `addActiveFilter` on reads.
4. **Schema** — create `src/schemas/tag.ts` with `createTagSchema` / `updateTagSchema`.
5. **Route** — create `src/routes/tags.ts`. Mount under
   `/projects/:projectId/tags` behind `authenticate` + `requireProjectAccess`. Keep
   handlers thin; call the repository; return the documented status codes.
6. **Mount** — add the router to `src/routes/index.ts` (mind the ordering: more specific
   paths before more general ones).
7. **Docs** — add the endpoints to `docs/API.md` (paths, methods, status/error codes,
   shapes). Add a section to `FEATURE-TESTS.md`.
8. **Tests** — a unit test for the schema; an integration test hitting the routes against
   the Testcontainers DB using the fixtures.
9. **Verify** — `npm run build && npm run lint && npm run test:all`. Then smoke-test the
   routes with `curl` (or the browser) against a running server.

Follow an existing feature (props or lighting are simple) as a template — copy its shape,
then change the specifics.

---

## 15. Glossary

- **Middleware** — a function `(req, res, next)` that runs before (or around) a route
  handler. Chained in order. Calls `next()` to continue, or throws to bail out.
- **Route handler / controller** — the function that produces the response for a specific
  method+path.
- **Repository** — the object that owns all database queries for one table/aggregate.
- **Service** — business logic that isn't a plain DB query (auth, encryption, generation).
- **Knex** — the SQL query builder we use instead of writing raw SQL strings.
- **Migration** — a versioned script that changes the DB schema; run in order.
- **Soft delete** — marking a row deleted (`deleted_at`) instead of removing it.
- **Junction table** — a table that models a many-to-many link (e.g. `shot_characters`).
- **JWT** — a signed token proving identity. We use short access + long refresh tokens.
- **Presigned URL** — a temporary, signed S3 URL that lets a client upload/download an
  object directly, without our server proxying the bytes.
- **Joi** — the schema library we validate request input with.
- **Vitest / Supertest / Testcontainers** — our test runner / HTTP test client / throwaway
  real-database helper.
- **AppError** — our base error class; carries an HTTP status + a machine-readable code.
- **Sequence gap** — spacing ordered items by 1000 so inserts rarely need renumbering.

---

*Still stuck? Read the four files for the feature you're touching (schema, route,
repository, service), then trace one request through them with this doc's "life of a
request" section beside you. That's the whole game.*
