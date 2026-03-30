# Backend Development Plan

This document defines the phased implementation plan for the Atelier backend API. Each phase builds on the previous one, and each step within a phase includes the specific files to create and the acceptance criteria.

All implementation follows the specifications in `docs/README.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/BACKEND.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, and `docs/TESTING.md`.

---

## Phase 1: Project Scaffolding & Configuration

Bootstrap the Node.js/Express/TypeScript project with all tooling, configuration files, and the local development environment.

### Step 1.1 — Initialize the Node.js project

- Run `npm init` inside `atelier-api/`
- Install production dependencies:
  - `express`, `cors`, `helmet`, `cookie-parser`
  - `knex`, `mysql2`
  - `jsonwebtoken`, `bcrypt`, `uuid`
  - `joi`
  - `pino`, `pino-http`
  - `dotenv`
  - `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
  - `sharp` (thumbnail generation)
  - `express-rate-limit`
- Install dev dependencies:
  - `typescript`, `@types/node`, `@types/express`, `@types/cors`, `@types/cookie-parser`, `@types/jsonwebtoken`, `@types/bcrypt`, `@types/uuid`
  - `tsx` (dev runner), `nodemon`
  - `vitest`, `supertest`, `@types/supertest`
  - `@testcontainers/mysql`
  - `@faker-js/faker`
  - `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-config-prettier`
- **Acceptance:** `npm install` completes without errors.

### Step 1.2 — TypeScript and tooling configuration

Create the following configuration files:

- `tsconfig.json` — Target ES2022, module NodeNext, strict mode, `src/` as rootDir, `dist/` as outDir, path alias `@/*` → `src/*`.
- `.eslintrc.cjs` — TypeScript ESLint with Prettier compatibility. Rules: no unused vars (warn), no explicit any (warn), consistent return types.
- `.env.example` — Template with all environment variables from `docs/README.md` (NODE_ENV, PORT, DATABASE_URL, JWT secrets, ENCRYPTION_KEY, AWS config, CORS_ORIGINS).
- `.gitignore` — node_modules, dist, .env, coverage, *.log.
- `nodemon.json` — Watch `src/`, extensions `ts`, exec `tsx src/server.ts`.

Add npm scripts to `package.json`:
```
dev          → nodemon
build        → tsc
start        → node dist/server.js
lint         → eslint src/ --ext .ts
test         → vitest run
test:watch   → vitest
test:coverage → vitest run --coverage
test:integration → vitest run --config vitest.integration.config.ts
migrate      → knex migrate:latest --knexfile src/db/knexfile.ts
migrate:make → knex migrate:make --knexfile src/db/knexfile.ts
```

- **Acceptance:** `npm run build` compiles with zero errors. `npm run lint` passes.

### Step 1.3 — Configuration module

Create the centralized configuration loader that validates required environment variables at startup.

Files:
- `src/config/index.ts` — `required()` and `optional()` helpers. Export a typed `config` object covering: env, port, database.url, auth (accessTokenSecret, refreshTokenSecret, accessTokenExpiry, refreshTokenExpiry, bcryptRounds), encryption.key, aws (region, s3Bucket), cors.origins.
- `src/config/auth.ts` — Derived auth config: access token settings (secret, expiresIn, algorithm HS256), refresh token settings (secret, expiresIn, algorithm HS256, cookie options: httpOnly, secure, sameSite strict, path /api/auth, maxAge 7d), password settings (saltRounds, minLength 8, maxLength 128).
- `src/config/storage.ts` — S3 config: bucket, region, presigned URL expiries (upload 15min, download 1hr), file limits (reference 10MB, allowed MIME types image/jpeg|png|webp), thumbnail settings (400×225, webp, quality 80).

- **Acceptance:** Importing `config` with missing required vars throws a clear error. All config values are typed.

### Step 1.4 — Express application setup

Create the Express app with all global middleware wired up, but no routes yet.

Files:
- `src/app.ts` — Create Express app. Apply middleware in order: `requestId`, `pino-http` logger, `helmet` (security headers with CSP from docs/SECURITY.md), `cors` (origin whitelist from config, credentials: true), `cookie-parser`, `express.json` (limit 1mb), rate limiter (global: 100 req/min). Mount `/health` endpoint returning `{ status: "ok" }`. Mount API router at `/api`. Apply `errorHandler` as final middleware.
- `src/server.ts` — Import app, listen on configured port, log startup message. Handle uncaught exceptions and unrejected promises with graceful shutdown.

- **Acceptance:** `npm run dev` starts the server. `GET /health` returns 200. Security headers present in responses (check with curl -I).

### Step 1.5 — Logger setup

- `src/utils/logger.ts` — Configure Pino logger. In development: pino-pretty transport. In production: JSON output. Include request ID in all log entries. Export a `logger` instance.

- **Acceptance:** Requests log method, URL, status code, and response time.

---

## Phase 2: Error System

Build the structured error handling system before any business logic, so all subsequent code uses consistent error patterns.

### Step 2.1 — Error codes and classes

Files:
- `src/errors/codes.ts` — Export `ErrorCodes` object with all codes from docs/API.md: AUTH_xxx (5), AUTHZ_xxx (2), VAL_xxx (5), RES_xxx (4), KEY_xxx (6), GEN_xxx (6), UPL_xxx (3), SYS_xxx (3). Export `ErrorCode` type.
- `src/errors/AppError.ts` — Base `AppError` class (code, statusCode, message, details, toResponse method). Subclasses: `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ApiKeyError`, `GenerationError`, `ProviderError`. Each maps to the correct HTTP status code per docs/BACKEND.md.
- `src/errors/index.ts` — Re-export all error classes and codes.

- **Acceptance:** Each error class produces the correct JSON response shape: `{ error: { code, message, details, requestId } }`.

### Step 2.2 — Global error handler middleware

- `src/middleware/errorHandler.ts` — Catch all errors. If `AppError`, use its `toResponse()`. If Joi `ValidationError`, map to 400 with field details. If JWT errors, map to appropriate AUTH codes. Otherwise, log the full error and return 500 `SYS_INTERNAL_ERROR` (never expose internal details). Include `requestId` from `req.requestId` in all error responses.

- **Acceptance:** Throwing any `AppError` subclass from a route handler produces the correct HTTP status and JSON body. Unknown errors return 500 without leaking stack traces.

---

## Phase 3: Database Setup & Migrations

Stand up the database connection and create all tables via migrations.

### Step 3.1 — Knex configuration and connection

Files:
- `src/db/knexfile.ts` — Knex configuration for development (mysql2, connection from DATABASE_URL), test, and production environments. Migrations directory: `src/db/migrations/`. Configure pool min:0, max:10.
- `src/db/index.ts` — Create and export the Knex instance. On connection error, log and exit. Export a `testConnection()` function that runs a simple query.

- **Acceptance:** `npm run dev` connects to MySQL and logs success. Connection failure produces a clear error.

### Step 3.2 — Database migrations

Create migrations in execution order. Each migration creates one or more related tables with all columns, indexes, foreign keys, and constraints exactly as specified in docs/DATABASE.md.

Migration files (in `src/db/migrations/`):
1. `001_create_users.ts` — `users` table (id CHAR(36) PK, email VARCHAR(255) UNIQUE, password_hash, created_at, updated_at, deleted_at, indexes).
2. `002_create_user_api_keys.ts` — `user_api_keys` table (id, user_id FK → users, provider ENUM, encrypted_key TEXT, key_hint, is_valid, timestamps, deleted_at, UNIQUE user_id+provider).
3. `003_create_refresh_tokens.ts` — `refresh_tokens` table (id, user_id FK → users, token_hash, expires_at, created_at, revoked_at, replaced_by_id, user_agent, ip_address, indexes on user_id, expires_at, token_hash).
4. `004_create_projects.ts` — `projects` table (id, user_id FK → users CASCADE, title, share_token UNIQUE, is_public, timestamps, deleted_at, indexes).
5. `005_create_art_styles.ts` — `art_styles` table (id, project_id FK → projects CASCADE UNIQUE, name, description, color_palette, style_references, technical_terms JSON, ai_description, timestamps, deleted_at).
6. `006_create_characters.ts` — `characters` table (id, project_id FK, name, physical_description, default_appearance, personality, ai_description, timestamps, deleted_at, indexes).
7. `007_create_variants.ts` — `variants` table (id, character_id FK → characters CASCADE, name, description, ai_description, timestamps, deleted_at, indexes).
8. `008_create_settings.ts` — `settings` table (id, project_id FK, name, description, set_dressing, time_of_day ENUM 7 values, weather ENUM 7 values, lighting, mood, ai_description, timestamps, deleted_at, indexes).
9. `009_create_props.ts` — `props` table (id, project_id FK, name, description, handled_by, ai_description, timestamps, deleted_at, indexes).
10. `010_create_lighting_setups.ts` — `lighting_setups` table (id, project_id FK, name, description, mood, ai_description, timestamps, deleted_at, indexes).
11. `011_create_acts.ts` — `acts` table (id, project_id FK CASCADE, title, sequence_number INT DEFAULT 1000, timestamps, deleted_at, composite index on project_id+sequence_number).
12. `012_create_scenes.ts` — `scenes` table (id, act_id FK → acts CASCADE, title, sequence_number, default_setting_id FK → settings SET NULL, default_lighting_id FK → lighting_setups SET NULL, timestamps, deleted_at, composite index on act_id+sequence_number).
13. `013_create_shots.ts` — `shots` table with all columns from docs/DATABASE.md (id, scene_id FK CASCADE, sequence_number, description, shot_type ENUM 13 values, camera_angle ENUM 6 values, camera_movement ENUM 7 values, setting_id FK SET NULL, lighting_id FK SET NULL, generated_image_id, previous_image_id, annotations JSON, caption, compiled_prompt, edited_prompt, status ENUM 4 values DEFAULT 'DRAFT', timestamps, deleted_at, indexes).
14. `014_create_shot_characters.ts` — `shot_characters` junction table (id, shot_id FK CASCADE, character_id FK CASCADE, variant_id FK → variants SET NULL, created_at, UNIQUE shot_id+character_id).
15. `015_create_shot_props.ts` — `shot_props` junction table (id, shot_id FK CASCADE, prop_id FK CASCADE, created_at, UNIQUE shot_id+prop_id).
16. `016_create_generated_images.ts` — `generated_images` table (id, project_id FK CASCADE, s3_key, prompt, provider, model, width, height, created_at, deleted_at, indexes).
17. `017_create_reference_images.ts` — `reference_images` table (id, component_type ENUM 6 values, component_id, s3_key, filename, mime_type, uploaded_at, deleted_at, composite index on component_type+component_id).
18. `018_create_concept_art_sessions.ts` — `concept_art_sessions` table (id, project_id FK CASCADE, component_type ENUM 6 values, component_id, status ENUM 3 values DEFAULT 'ACTIVE', timestamps, deleted_at, indexes).
19. `019_create_concept_art_messages.ts` — `concept_art_messages` table (id, session_id FK CASCADE, role ENUM 3 values, content TEXT, generated_image_id FK → generated_images SET NULL, created_at, index on session_id).

Every migration must have both `up` and `down` functions.

- **Acceptance:** `npm run migrate` creates all 19 tables. `npm run migrate -- --rollback` drops them cleanly. All foreign keys, indexes, enums, and constraints match docs/DATABASE.md exactly.

### Step 3.3 — Utility functions

Files:
- `src/utils/softDelete.ts` — Helper functions: `softDelete(table, id)`, `restore(table, id)`, `addActiveFilter(query)` (appends `whereNull('deleted_at')`), `permanentDelete(table, olderThanDays)`.
- `src/utils/sequencing.ts` — `SEQUENCE_GAP = 1000`. Functions: `getNextSequenceNumber(table, parentColumn, parentId)` (returns max + GAP or GAP if none), `renumber(items)` (reassigns sequence numbers with GAP spacing), `getInsertBetweenSequence(before, after)` (returns midpoint).

- **Acceptance:** Unit tests pass for sequence number edge cases (first item, between items, renumbering).

---

## Phase 4: Request Validation & Core Middleware

Build the middleware layer that all routes will depend on.

### Step 4.1 — Request ID middleware

- `src/middleware/requestId.ts` — Generate a UUID for each request. Attach as `req.requestId`. Set `X-Request-ID` response header.

### Step 4.2 — Validation middleware

- `src/middleware/validate.ts` — Accept a Joi schema. Validate `req.body` with `abortEarly: false, stripUnknown: true`. On failure, throw `ValidationError` with field details. On success, replace `req.body` with validated/stripped value. Create an additional `validateParams` variant for URL params and `validateQuery` for query strings.

### Step 4.3 — Security headers middleware

- `src/middleware/securityHeaders.ts` — Configure Helmet with the CSP directives from docs/SECURITY.md (defaultSrc self, scriptSrc self, imgSrc self + S3 + data + blob, connectSrc self + amazonaws, frameSrc none, objectSrc none). Enable HSTS (1 year, includeSubDomains, preload), X-Frame-Options DENY, noSniff, xssFilter, hidePoweredBy, referrerPolicy strict-origin-when-cross-origin.

### Step 4.4 — CORS middleware

- `src/middleware/cors.ts` — Allowed origins from config. In development, include localhost:5173. Credentials: true. Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS. Allowed headers: Content-Type, Authorization, X-Request-ID. Exposed headers: X-Request-ID. Max age: 86400.

### Step 4.5 — Rate limiter middleware

- `src/middleware/rateLimiter.ts` — Export two limiters:
  - `globalLimiter`: 100 requests per minute per IP.
  - `authLimiter`: 10 requests per 15 minutes, keyed by IP + email (from request body).

- **Acceptance:** All middleware can be imported and applied without errors. Rate limiter returns 429 with correct headers when exceeded.

---

## Phase 5: Authentication & User Management

Implement the full auth flow: registration, login, JWT access/refresh tokens with rotation, and user API key management.

### Step 5.1 — TypeScript types

- `src/types/models.ts` — Define interfaces for all database models: `User`, `UserApiKey`, `RefreshToken`, `Project`, `ArtStyle`, `Character`, `Variant`, `Setting`, `Prop`, `LightingSetup`, `Act`, `Scene`, `Shot`, `ShotCharacter`, `ShotProp`, `GeneratedImage`, `ReferenceImage`, `ConceptArtSession`, `ConceptArtMessage`. Include all columns from docs/DATABASE.md.
- `src/types/express.d.ts` — Extend Express `Request` interface to include `requestId: string`, `user?: { id: string; email: string }`, `project?: Project`.

### Step 5.2 — Auth validation schemas

- `src/schemas/auth.ts` — Joi schemas:
  - `registerSchema`: email (valid email, required), password (string, min 8, max 128, must contain uppercase + lowercase + number, required).
  - `loginSchema`: email (required), password (required).

### Step 5.3 — Auth service

- `src/services/auth/authService.ts` — Implement the full auth service as specified in docs/BACKEND.md:
  - `register(email, password)` — Check for existing user (active only), hash password with bcrypt (cost from config), create user with UUID, generate token pair, return user + tokens.
  - `login(email, password)` — Find user by email (active only), compare password hash, generate token pair. Use identical timing for user-not-found and wrong-password to prevent enumeration.
  - `refresh(refreshToken)` — Verify JWT signature, look up token hash in DB, check not revoked, check not already rotated (if rotated → replay attack → revoke entire family), generate new pair, mark old token as replaced_by.
  - `logout(refreshToken)` — Hash token, mark as revoked in DB.
  - `verifyAccessToken(token)` — Verify JWT, return { id, email }. Map TokenExpiredError → AUTH_TOKEN_EXPIRED, other errors → AUTH_TOKEN_INVALID.
  - `generateTokenPair(userId, email)` — Create access token (15min, HS256) and refresh token (7d, HS256, includes jti). Store refresh token hash (SHA-256) in DB with expiry.
  - `revokeTokenFamily(tokenId)` — Follow replaced_by chain and revoke all tokens.
  - `hashToken(token)` — SHA-256 hex digest.

### Step 5.4 — Authentication middleware

- `src/middleware/authenticate.ts` — Extract Bearer token from Authorization header. If missing, throw AUTH_TOKEN_MISSING. Call `authService.verifyAccessToken()`. Attach user to `req.user`. Export as `authenticate`.

### Step 5.5 — Auth routes

- `src/routes/auth.ts` — Express router:
  - `POST /auth/register` — Apply `authLimiter`, validate with `registerSchema`. Call `authService.register()`. Set refresh token cookie (httpOnly, secure, sameSite strict, path /api/auth, maxAge 7d). Return 201 with `{ user, accessToken }`.
  - `POST /auth/login` — Apply `authLimiter`, validate with `loginSchema`. Call `authService.login()`. Set refresh token cookie. Return 200 with `{ user, accessToken }`.
  - `POST /auth/refresh` — Read refresh token from cookie. Call `authService.refresh()`. Set new refresh token cookie. Return 200 with `{ accessToken }`.
  - `POST /auth/logout` — Requires `authenticate`. Read refresh token from cookie. Call `authService.logout()`. Clear refresh token cookie. Return 204.
  - `GET /auth/me` — Requires `authenticate`. Look up user by `req.user.id`. Return 200 with `{ user: { id, email, createdAt } }`.

### Step 5.6 — Encryption service

- `src/services/encryption/encryptionService.ts` — Implement as specified in docs/BACKEND.md:
  - `encryptApiKey(plaintext)` — Generate random IV (16 bytes) and salt (32 bytes). Derive key with PBKDF2 (SHA-256, 100K iterations). Encrypt with AES-256-GCM. Return JSON string of { ciphertext, iv, authTag, salt } all base64-encoded.
  - `decryptApiKey(encrypted)` — Parse JSON, decode base64 fields, derive key with same salt, decrypt with AES-256-GCM, verify auth tag.
  - `generateKeyHint(apiKey)` — Return `•••••` + last 4 characters.

### Step 5.7 — User settings routes (API key management)

- `src/schemas/userSettings.ts` — Joi schemas for API key operations: provider (enum: gemini), apiKey (string, required).
- `src/routes/userSettings.ts` — All routes require `authenticate`:
  - `GET /user/api-keys` — List user's API keys (provider, keyHint, isValid, updatedAt). Never expose actual keys.
  - `POST /user/api-keys` — Validate input. Encrypt the API key. Upsert into `user_api_keys` (insert or update if user+provider exists). Generate key hint. Return `{ provider, keyHint, isValid: true }`.
  - `DELETE /user/api-keys/:provider` — Soft delete the key record. Return 204.
  - `POST /user/api-keys/:provider/validate` — Decrypt the stored key. Make a lightweight test call to the provider API. Update `is_valid` flag. Return `{ isValid }`.

### Step 5.8 — Wire auth routes into the app

- `src/routes/index.ts` — Create the master API router. Mount auth routes at `/auth`, user settings at `/user`. Export the router.
- Update `src/app.ts` to mount the master router at `/api`.

- **Acceptance:** Full auth flow works end-to-end: register → login → access protected route → refresh token → logout. Refresh token rotation works. Replay detection revokes token family. API keys can be stored and retrieved (hint only). Rate limiting enforces on auth endpoints.

---

## Phase 6: Project CRUD & Authorization

### Step 6.1 — Project authorization middleware

- `src/middleware/authorize.ts` — `requireProjectAccess` middleware: extract `projectId` from params, query for project where `user_id = req.user.id` and `deleted_at IS NULL`. If not found, throw `ForbiddenError`. Attach project to `req.project`.

### Step 6.2 — Project validation schemas

- `src/schemas/project.ts` — Joi schemas:
  - `createProjectSchema`: title (string, max 255, required).
  - `updateProjectSchema`: title (string, max 255, optional).

### Step 6.3 — Project repository

- `src/db/repositories/projectRepository.ts` — Data access functions:
  - `findByUserId(userId)` — List projects with act count and shot count aggregates.
  - `findById(id)` — Single project with summary stats.
  - `create(userId, data)` — Insert project, also create a default (empty) art_style row.
  - `update(id, data)` — Partial update.
  - `softDelete(id)` — Set deleted_at.
  - `restore(id)` — Clear deleted_at.
  - `setShareToken(id)` — Generate UUID share token, set is_public = true.
  - `revokeShare(id)` — Clear share token, set is_public = false.
  - `findByShareToken(token)` — Look up public project by share token.

### Step 6.4 — Project routes

- `src/routes/projects.ts` — All routes require `authenticate`:
  - `GET /projects` — List user's projects. Return `{ data: [...] }` with actCount, shotCount.
  - `POST /projects` — Validate, create project + default art style. Return 201.
  - `GET /projects/:projectId` — Require project access. Return project with summary stats.
  - `PATCH /projects/:projectId` — Require project access. Validate, update. Return 200.
  - `DELETE /projects/:projectId` — Require project access. Soft delete. Return 204.
  - `POST /projects/:projectId/restore` — Require project access (allow deleted). Restore. Return 200.
  - `POST /projects/:projectId/share` — Require project access. Generate share token. Return `{ shareToken, shareUrl, isPublic }`.
  - `DELETE /projects/:projectId/share` — Require project access. Revoke sharing. Return 200.

### Step 6.5 — Shared project route

- `src/routes/shared.ts` — Public (no auth):
  - `GET /shared/:shareToken` — Look up project by share token. Build full read-only view: project info, art style, acts with scenes with shots (including image URLs, annotations, captions). Return 200.

### Step 6.6 — Mount project routes

- Update `src/routes/index.ts` to mount project routes at `/projects` and shared routes at `/shared`.

- **Acceptance:** Projects can be created, listed, updated, soft-deleted, restored. Users cannot access other users' projects (403). Sharing generates a working public link. Shared view returns the full storyboard tree.

---

## Phase 7: Component Library

Build CRUD for all component types: art style, characters (with variants), settings, props, and lighting setups.

### Step 7.1 — Validation schemas for components

- `src/schemas/artStyle.ts` — Update art style schema: name, description, colorPalette, styleReferences, technicalTerms (array of strings), aiDescription. All optional for PUT.
- `src/schemas/character.ts` — Create: name (required, max 255), physicalDescription, defaultAppearance, personality, aiDescription. Update: all optional.
- `src/schemas/variant.ts` — Create: name (required, max 255), description, aiDescription. Update: all optional.
- `src/schemas/setting.ts` — Create: name (required), description, setDressing, timeOfDay (enum), weather (enum), lighting, mood, aiDescription. Update: all optional.
- `src/schemas/prop.ts` — Create: name (required), description, handledBy, aiDescription. Update: all optional.
- `src/schemas/lighting.ts` — Create: name (required), description, mood, aiDescription. Update: all optional.

### Step 7.2 — Component repositories

Create a repository for each component type in `src/db/repositories/`:

- `characterRepository.ts` — CRUD scoped to project. Include variant count and reference image count in list queries.
- `variantRepository.ts` — CRUD scoped to character. Verify character belongs to project.
- `settingRepository.ts` — CRUD scoped to project. Include reference image count.
- `propRepository.ts` — CRUD scoped to project.
- `lightingRepository.ts` — CRUD scoped to project.
- `artStyleRepository.ts` — Get and update (upsert) scoped to project. One per project.

All repositories:
- Apply `whereNull('deleted_at')` on all reads.
- Use soft delete.
- Return camelCase field names (convert from snake_case).

### Step 7.3 — Component routes

Create route files in `src/routes/`. All require `authenticate` + `requireProjectAccess`:

- `src/routes/artStyle.ts`:
  - `GET /projects/:projectId/art-style` — Return art style.
  - `PUT /projects/:projectId/art-style` — Validate, update (or create if missing). Return 200.
  - `POST /projects/:projectId/art-style/generate-description` — (Stub for now — return 501. Will be implemented in Phase 10.)

- `src/routes/characters.ts`:
  - `GET /projects/:projectId/characters` — List with variant count.
  - `POST /projects/:projectId/characters` — Create. Return 201.
  - `GET /projects/:projectId/characters/:characterId` — Get with variants and reference images.
  - `PATCH /projects/:projectId/characters/:characterId` — Update.
  - `DELETE /projects/:projectId/characters/:characterId` — Soft delete.
  - `POST /projects/:projectId/characters/:characterId/generate-description` — (Stub 501.)

- `src/routes/variants.ts` (nested under characters):
  - `GET /projects/:projectId/characters/:characterId/variants` — List.
  - `POST /projects/:projectId/characters/:characterId/variants` — Create. Return 201.
  - `GET /projects/:projectId/characters/:characterId/variants/:variantId` — Get.
  - `PATCH /projects/:projectId/characters/:characterId/variants/:variantId` — Update.
  - `DELETE /projects/:projectId/characters/:characterId/variants/:variantId` — Soft delete.
  - `POST .../variants/:variantId/generate-description` — (Stub 501.)

- `src/routes/settings.ts`:
  - Standard CRUD: list, create, get, update, delete.
  - `POST .../generate-description` — (Stub 501.)

- `src/routes/props.ts`:
  - Standard CRUD: list, create, get, update, delete.
  - `POST .../generate-description` — (Stub 501.)

- `src/routes/lighting.ts`:
  - Standard CRUD: list, create, get, update, delete.
  - `POST .../generate-description` — (Stub 501.)

### Step 7.4 — Mount component routes

- Update `src/routes/index.ts` to mount all component routers under `/projects/:projectId/...`.

- **Acceptance:** Full CRUD works for all component types. Components are scoped to their project. Deleting a character cascades to its variants. Art style is one-per-project (upsert). All list endpoints return expected counts.

---

## Phase 8: Storyboard Structure (Acts, Scenes, Shots)

### Step 8.1 — Validation schemas

- `src/schemas/act.ts` — Create: title (required, max 255). Update: title optional. Reorder: orderedIds (array of UUIDs, required).
- `src/schemas/scene.ts` — Create: title (required), defaultSettingId (UUID, optional), defaultLightingId (UUID, optional). Update: all optional. Reorder: orderedIds. Move: targetActId (UUID, required).
- `src/schemas/shot.ts` — Create: description, shotType (enum), cameraAngle (enum), cameraMovement (enum), settingId, lightingId, characters (array of { characterId, variantId }), props (array of UUIDs). All optional except a valid combination. Update: all optional, same fields plus annotations (JSON matching AnnotationLayer schema), caption. Reorder: orderedIds. Move: targetSceneId.

### Step 8.2 — Storyboard repositories

- `src/db/repositories/actRepository.ts` — CRUD scoped to project. List with scene count. Auto-assign sequence number on create. Reorder (update sequence numbers from orderedIds array). Soft delete.
- `src/db/repositories/sceneRepository.ts` — CRUD scoped to act. List with shot count. Include default setting/lighting names. Auto-assign sequence number. Reorder. Move to different act. Soft delete.
- `src/db/repositories/shotRepository.ts` — CRUD scoped to scene. List with character names and image URLs. Auto-assign sequence number. Get full shot detail (join characters with variants, props, effective setting/lighting with inheritance from scene). Reorder. Move to different scene. Manage shot_characters and shot_props junction tables on create/update (delete existing, insert new). Soft delete.

### Step 8.3 — Storyboard routes

- `src/routes/acts.ts` — All require auth + project access:
  - `GET /projects/:projectId/acts` — List acts with scene counts, ordered by sequence_number.
  - `POST /projects/:projectId/acts` — Create with auto sequence number. Return 201.
  - `GET /projects/:projectId/acts/:actId` — Get act detail.
  - `PATCH /projects/:projectId/acts/:actId` — Update.
  - `DELETE /projects/:projectId/acts/:actId` — Soft delete (cascades to scenes and shots).
  - `POST /projects/:projectId/acts/reorder` — Accept orderedIds, reassign sequence numbers. Return `{ updated: N }`.

- `src/routes/scenes.ts`:
  - `GET /projects/:projectId/acts/:actId/scenes` — List with shot counts.
  - `POST /projects/:projectId/acts/:actId/scenes` — Create. Return 201.
  - `GET /projects/:projectId/scenes/:sceneId` — Get detail (verify scene's act belongs to project).
  - `PATCH /projects/:projectId/scenes/:sceneId` — Update.
  - `DELETE /projects/:projectId/scenes/:sceneId` — Soft delete.
  - `POST /projects/:projectId/acts/:actId/scenes/reorder` — Reorder within act.
  - `POST /projects/:projectId/scenes/:sceneId/move` — Move to target act.

- `src/routes/shots.ts`:
  - `GET /projects/:projectId/scenes/:sceneId/shots` — List with character names and thumbnails.
  - `POST /projects/:projectId/scenes/:sceneId/shots` — Create with junction table entries for characters and props. Return 201.
  - `GET /projects/:projectId/shots/:shotId` — Full detail: characters (with variant info), props, effective setting (shot override or scene default), effective lighting, image URLs, annotations, caption, compiled prompt.
  - `PATCH /projects/:projectId/shots/:shotId` — Update shot fields and junction tables. Validate annotations JSON against the AnnotationLayer schema.
  - `DELETE /projects/:projectId/shots/:shotId` — Soft delete.
  - `POST /projects/:projectId/scenes/:sceneId/shots/reorder` — Reorder within scene.
  - `POST /projects/:projectId/shots/:shotId/move` — Move to target scene.

### Step 8.4 — Mount storyboard routes

- Update `src/routes/index.ts` to mount act, scene, and shot routers.

- **Acceptance:** Full hierarchy creation works: create act → create scene within act → create shot within scene with characters and props. Ordering is correct. Moving scenes between acts and shots between scenes works. Scene defaults are inherited by shots when shot overrides are null. Deleting an act cascades through scenes and shots.

---

## Phase 9: Image Storage & Reference Images

### Step 9.1 — S3 storage service

- `src/services/storage/s3Client.ts` — Create and export configured S3 client using `@aws-sdk/client-s3`.
- `src/services/storage/storageService.ts` — Functions:
  - `generatePresignedUploadUrl(key, contentType, expiresIn)` — Return presigned PUT URL.
  - `generatePresignedDownloadUrl(key, expiresIn)` — Return presigned GET URL.
  - `deleteObject(key)` — Delete S3 object.
  - `getImageUrl(s3Key)` — Generate presigned download URL with 1hr expiry.
  - `getThumbnailUrl(s3Key)` — Derive thumbnail key from image key, generate presigned URL.
  - `generateThumbnail(imageBuffer, s3Key)` — Use sharp to resize to 400×225 webp, upload to S3 at thumbnail path.
  - Key path helpers: `getGeneratedImageKey(projectId, imageId)`, `getReferenceImageKey(projectId, imageId, ext)`, `getThumbnailKey(imageId)`.

### Step 9.2 — Reference image routes

- `src/routes/referenceImages.ts` — All require auth + project access:
  - `POST /projects/:projectId/reference-images/presign` — Validate filename, contentType (must be allowed MIME type), componentType, componentId. Validate file size limit. Generate imageId (UUID), compute S3 key. Return `{ uploadUrl, imageId, s3Key, expiresAt }`.
  - `POST /projects/:projectId/reference-images/confirm` — Verify the S3 object exists (HEAD request). Create `reference_images` DB record. Generate thumbnail. Return 201 with `{ id, url, filename }`.
  - `GET /projects/:projectId/reference-images` — Query params: componentType, componentId. List reference images with presigned URLs. Return `{ images: [...] }`.
  - `DELETE /projects/:projectId/reference-images/:imageId` — Soft delete DB record. (S3 objects cleaned up by lifecycle policy or background job.)

### Step 9.3 — Generated image repository

- `src/db/repositories/generatedImageRepository.ts` — Functions:
  - `create(projectId, s3Key, prompt, provider, model, width, height)` — Insert record, return ID.
  - `findById(id)` — Return image record with presigned URL.
  - `findByProject(projectId)` — List images.

### Step 9.4 — Mount image routes

- Update `src/routes/index.ts` to mount reference image routes.

- **Acceptance:** Presigned upload URLs work for browser-to-S3 uploads. Upload confirmation creates DB record and thumbnail. Reference images can be listed by component. Presigned download URLs work.

---

## Phase 10: Prompt Compiler & Image Generation

### Step 10.1 — Prompt compiler

- `src/services/promptCompiler/PromptCompiler.ts` — Define the `ShotContext` interface (shot data, scene, artStyle, characters with variants, setting, lighting, props) and `CompilationResult` interface (prompt string, sections array, warnings array, error). Define abstract `PromptCompiler` base class with `compile(context): CompilationResult`.
- `src/services/promptCompiler/descriptors.ts` — Maps for shot type codes → natural language descriptions ("MS" → "Medium shot showing figure from waist up"), camera angle codes → descriptions, camera movement codes → descriptions.
- `src/services/promptCompiler/geminiAdapter.ts` — `GeminiPromptCompiler` extends `PromptCompiler`. Implement section builders as specified in docs/ARCHITECTURE.md:
  - `buildFramingSection()` — Shot type + camera angle in natural language.
  - `buildDescriptionSection()` — User's shot description.
  - `buildCharactersSection()` — Each character's AI description with variant, position info.
  - `buildPropsSection()` — Each prop's AI description.
  - `buildSettingSection()` — Setting AI description with time of day and weather.
  - `buildLightingSection()` — Lighting AI description with mood.
  - `buildStyleSection()` — Art style AI description.
  - `buildQualitySection()` — Gemini-specific quality boosters ("Highly detailed, professional cinematography, cinematic composition, dramatic lighting").
  - `compile()` — Assemble sections in optimal order. Track sources. Generate warnings for missing AI descriptions. Enforce 1500-char prompt limit (return error if exceeded). Sanitize user inputs for prompt injection (strip brackets, code blocks, limit newlines, enforce length).
- `src/services/promptCompiler/index.ts` — Factory function `getPromptCompiler(provider)` that returns the appropriate adapter (only Gemini for now).

### Step 10.2 — Image generation service

- `src/services/imageGeneration/index.ts` — `ImageGenerationService`:
  - `generateFromPrompt(userId, projectId, prompt)` — Decrypt user's Gemini API key. Call Gemini Imagen API. Upload resulting image to S3. Generate thumbnail. Create `generated_images` DB record. Return image record with presigned URL.
  - `generateForShot(userId, projectId, shotId, editedPrompt?)` — Check shot status is not GENERATING (throw GEN_ALREADY_IN_PROGRESS). Set shot status to GENERATING. Build ShotContext by loading shot + all related data. Compile prompt (or use editedPrompt). Call `generateFromPrompt`. Store previous_image_id. Update shot with new generated_image_id, compiled_prompt, status GENERATED. On error: set status FAILED, rethrow.
- `src/services/imageGeneration/errorMapper.ts` — Map Gemini API errors to application error codes: invalid key → KEY_INVALID, rate limited → KEY_RATE_LIMITED, content filtered → GEN_CONTENT_FILTERED, timeout → GEN_PROVIDER_TIMEOUT, other → GEN_PROVIDER_ERROR.

### Step 10.3 — Shot generation routes

Add to `src/routes/shots.ts`:
  - `GET /projects/:projectId/shots/:shotId/compile-prompt` — Build ShotContext, compile prompt, return `{ prompt, sections, warnings, error }` without generating.
  - `POST /projects/:projectId/shots/:shotId/generate` — Accept optional `{ editedPrompt }`. Call `ImageGenerationService.generateForShot()`. Return shot with image URL and status.
  - `POST /projects/:projectId/shots/:shotId/revert` — Check previous_image_id exists (throw GEN_NO_PREVIOUS_IMAGE if null). Swap generated_image_id and previous_image_id. Return updated shot.

### Step 10.4 — Generic image generation route

- `src/routes/imageGeneration.ts`:
  - `POST /projects/:projectId/generate-image` — Accept `{ prompt }`. Call `ImageGenerationService.generateFromPrompt()`. Return `{ id, url, prompt, provider, model }`. This is for the concept art phase (free-form generation not tied to a shot).

### Step 10.5 — Implement generate-description stubs

Update the stub routes created in Phase 7 for all component types. Each `generate-description` endpoint should:
  - Load the component's current data.
  - Construct a prompt asking the LLM to create an AI-optimized description from the component's human-readable fields (and optionally a reference image).
  - Call Gemini's text generation API (not image generation).
  - Return `{ aiDescription: "..." }`.

For MVP, if full LLM integration is complex, these can construct the description from a template instead.

### Step 10.6 — Mount generation routes

- Update `src/routes/index.ts` to mount image generation routes.

- **Acceptance:** Prompt compilation produces correct output matching the example in docs/ARCHITECTURE.md. Warnings generated for missing AI descriptions. Image generation calls Gemini API, stores image in S3, creates DB record, updates shot status. Shot status transitions are correct (DRAFT → GENERATING → GENERATED/FAILED). Revert swaps images correctly. Content filtering errors surface user-friendly messages.

---

## Phase 11: Concept Art Sessions

### Step 11.1 — Concept art repository

- `src/db/repositories/conceptSessionRepository.ts` — Functions:
  - `create(projectId, componentType, componentId)` — Create session with ACTIVE status.
  - `findByProject(projectId)` — List sessions with message count.
  - `findById(id)` — Get session with all messages (include generated image URLs).
  - `addMessage(sessionId, role, content, generatedImageId?)` — Insert message.
  - `updateStatus(id, status)` — Update session status.
  - `finalize(id, selectedImageId)` — Set status to COMPLETED, generate description from selected image.

### Step 11.2 — Concept art routes

- `src/routes/conceptSessions.ts` — All require auth + project access:
  - `GET /projects/:projectId/concept-sessions` — List sessions with message counts.
  - `POST /projects/:projectId/concept-sessions` — Create session. Validate componentType and componentId. Return 201.
  - `GET /projects/:projectId/concept-sessions/:sessionId` — Get session with full message history and image URLs.
  - `POST /projects/:projectId/concept-sessions/:sessionId/messages` — Accept `{ content }`. Create user message. Generate image from content (incorporating component context). Create assistant message with generated image. Return both messages.
  - `PATCH /projects/:projectId/concept-sessions/:sessionId` — Update status (ABANDONED).
  - `POST /projects/:projectId/concept-sessions/:sessionId/finalize` — Accept `{ selectedImageId }`. Mark session COMPLETED. Generate AI description from selected image. Update the component's aiDescription. Return `{ status, generatedDescription }`.

### Step 11.3 — Mount concept art routes

- Update `src/routes/index.ts`.

- **Acceptance:** Full concept art flow works: create session → send messages with image generation → iterate → finalize with description generation. Session status transitions correctly. Component's aiDescription updated on finalize.

---

## Phase 12: Docker & Local Development Environment

### Step 12.1 — Backend Dockerfile

- `Dockerfile` — Multi-stage build as specified in docs/DEPLOYMENT.md:
  - Builder stage: node:20-alpine, install deps with `npm ci`, copy source, `npm run build`, prune dev deps.
  - Production stage: node:20-alpine, create non-root user (nodejs:1001), copy dist + node_modules + package.json from builder, set NODE_ENV=production, expose 3000, healthcheck with wget to /health, CMD node dist/server.js.

### Step 12.2 — Database init script

- `src/db/init/01-init.sql` — Create database and user for Docker MySQL initialization (matches docker-compose environment variables).

### Step 12.3 — Docker Compose contribution

Create or update `docker-compose.yml` in the project root (`atelier/`) as specified in docs/DEPLOYMENT.md:
- `db` service: mysql:8.0, ports 3306, volume for data persistence, healthcheck, init scripts mounted.
- `backend` service: build from atelier-api, ports 3000, environment variables for development, source volume mount for hot reload, `npm run dev` command, depends on db healthy.
- Network: atelier-network bridge.

(Frontend service is out of scope for this plan but the compose file should leave room for it.)

### Step 12.4 — Environment files

- `.env.example` — Complete with all variables and safe development defaults (matching docker-compose).
- `.env` added to `.gitignore`.

- **Acceptance:** `docker-compose up` starts MySQL and backend. Backend connects to MySQL. Migrations run successfully. API is accessible at localhost:3000.

---

## Phase 13: Testing

### Step 13.1 — Test configuration

Files:
- `vitest.config.ts` — Unit test config: globals true, environment node, include `tests/unit/**/*.test.ts`, coverage with v8 provider (thresholds: 70% statements, 60% branches, 70% functions, 70% lines), path alias `@/` → `src/`, setup file.
- `vitest.integration.config.ts` — Integration test config: include `tests/integration/**/*.test.ts`, 30s timeout, serial execution (singleFork), setup file.
- `tests/unit/setup.ts` — Set test environment variables, clear mocks before each test.
- `tests/integration/setup.ts` — Start MySQL Testcontainer, connect Knex, run migrations, export db instance and `truncateTables` helper. Teardown: destroy connection, stop container.

### Step 13.2 — Test fixtures

- `tests/fixtures/index.ts` — Export factory functions:
  - `createTestUser(db, overrides?)` — Insert user with hashed password, return { userId, email, token }.
  - `createTestProject(db, userId, overrides?)` — Insert project + default art style, return { id }.
  - `createTestAct(db, projectId, overrides?)` — Insert act.
  - `createTestScene(db, actId, overrides?)` — Insert scene.
  - `createTestShot(db, sceneId, overrides?)` — Insert shot.
  - `createTestCharacter(db, projectId, overrides?)` — Insert character.
  - `createMockShotContext(overrides?)` — Return a ShotContext object for prompt compiler testing.

### Step 13.3 — Unit tests (high priority)

Write unit tests for:
- `tests/unit/services/auth.test.ts` — Password hashing, token generation, token verification, expiry handling.
- `tests/unit/services/encryption.test.ts` — Encrypt/decrypt round-trip, different ciphertext for same input, tamper detection, key hint generation.
- `tests/unit/services/promptCompiler.test.ts` — Full compilation with all components, prompt length enforcement, missing description warnings, section source tracking, prompt injection sanitization.
- `tests/unit/middleware/validate.test.ts` — Valid input passes, invalid input throws with field details, unknown fields stripped.
- `tests/unit/middleware/authenticate.test.ts` — Valid token passes, missing token throws, expired token throws, invalid token throws.
- `tests/unit/utils/sequencing.test.ts` — First item gets 1000, second gets 2000, insert between, renumbering.
- `tests/unit/utils/softDelete.test.ts` — Soft delete sets timestamp, restore clears it, active filter excludes deleted.

### Step 13.4 — Integration tests (high priority)

Write integration tests using Testcontainers + Supertest:
- `tests/integration/auth.test.ts` — Register (success, duplicate email, weak password), login (success, wrong password), refresh (success, replay detection), me (success, no token).
- `tests/integration/projects.test.ts` — CRUD lifecycle, authorization (cannot access other user's project), sharing, restore.
- `tests/integration/shots.test.ts` — Create with auto-sequence, ordering, junction tables (characters/props), reorder, move between scenes.
- `tests/integration/generation.test.ts` — Prompt compilation (mock the Gemini API), status transitions, revert.

### Step 13.5 — Verify coverage targets

- Run `npm run test:coverage` and verify thresholds are met.
- Run `npm run test:integration` and verify all integration tests pass.

- **Acceptance:** `npm run test` passes all unit tests with >70% coverage on high-priority areas. `npm run test:integration` passes all integration tests against a real MySQL instance. No flaky tests.

---

## Phase 14: Final Assembly & Validation

### Step 14.1 — Route audit

Review every route in `src/routes/index.ts` against docs/API.md:
- Verify every documented endpoint exists.
- Verify HTTP methods match.
- Verify response status codes match.
- Verify error codes match.
- Verify request/response shapes match.

### Step 14.2 — Security audit

Review against docs/SECURITY.md checklist:
- [ ] All secrets loaded from environment, never hardcoded.
- [ ] No secrets in error messages or logs.
- [ ] All database queries use parameterized statements (Knex).
- [ ] All user input validated with Joi before processing.
- [ ] Prompt injection sanitization applied to all text entering prompts.
- [ ] CORS restricted to configured origins.
- [ ] Rate limiting on auth endpoints.
- [ ] Security headers present (Helmet).
- [ ] Refresh token rotation with replay detection.
- [ ] API keys encrypted at rest.
- [ ] Presigned URLs have appropriate expiry times.

### Step 14.3 — End-to-end manual test

Perform a full manual test of the primary user journey:
1. Register a new user.
2. Configure a Gemini API key.
3. Create a project.
4. Set up an art style.
5. Create a character with a variant.
6. Create a setting, prop, and lighting setup.
7. Create an act, scene, and shot.
8. Add characters and props to the shot.
9. Preview the compiled prompt.
10. Generate an image (requires valid Gemini key).
11. Add annotations and caption to the shot.
12. Revert to the previous image.
13. Share the project and view the shared link.
14. Delete and restore the project.

### Step 14.4 — Documentation

- Update this plan, marking completed phases.
- Ensure `.env.example` is complete and accurate.
- Verify all npm scripts work as documented.

- **Acceptance:** All API endpoints match docs/API.md. Security checklist passes. Manual end-to-end test succeeds. The backend is ready for frontend integration.

---

## Dependency Graph

```
Phase 1  (Scaffolding)
   │
   ▼
Phase 2  (Error System)
   │
   ▼
Phase 3  (Database & Migrations)
   │
   ├──────────────────┐
   ▼                  ▼
Phase 4  (Middleware)  Phase 3.3 (Utilities)
   │
   ▼
Phase 5  (Auth & Users)
   │
   ▼
Phase 6  (Projects & Authorization)
   │
   ├──────────────────┐
   ▼                  ▼
Phase 7  (Components)  Phase 8  (Storyboard)
   │                  │
   └────────┬─────────┘
            ▼
Phase 9  (Image Storage)
            │
            ▼
Phase 10 (Prompt Compiler & Generation)
            │
            ▼
Phase 11 (Concept Art Sessions)
            │
            ▼
Phase 12 (Docker & Dev Environment)
            │
            ▼
Phase 13 (Testing)
            │
            ▼
Phase 14 (Final Validation)
```

---

## Notes

- **Snake_case ↔ camelCase:** Database columns use snake_case. API request/response bodies use camelCase. Repositories are responsible for the conversion.
- **UUID generation:** Use `uuid` v4 for all primary keys, generated application-side before insert.
- **Transactions:** Use Knex transactions for operations that span multiple tables (e.g., creating a shot with junction table entries, token rotation).
- **Logging:** Use the Pino logger for all server-side logging. Include requestId in all log entries. Log auth failures, validation errors, and generation errors at warn level. Log unexpected errors at error level. Never log secrets or full API keys.
- **Error responses:** Every error response must include `requestId` for debugging.
- **Soft deletes:** All queries must filter by `deleted_at IS NULL` unless explicitly operating on deleted records (restore, permanent delete).
