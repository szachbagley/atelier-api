# FEATURE-TESTS.md

A living catalogue of **testing strategy per feature** for the Atelier backend.

> **Maintenance rule (see `AGENTS.md` §4):** Whenever you implement or materially change a feature, add or update its section here **in the same PR**. This describes the *strategy* — what to test and why — which guides both the tests you write now and future regression work. It is not just an inventory of existing test files.

Every feature section MUST address all four dimensions:

- **Happy path** — primary success flow(s) and what proves they work.
- **Edge cases** — boundaries, empty/optional inputs, ordering, concurrency, idempotency.
- **Known limitations** — what is intentionally not covered or deferred (cross-ref `docs/DEFERRED_FEATURES.md`).
- **Error scenarios** — invalid input, auth failures, conflicts, downstream/provider failures, and the exact error codes returned.

Reference `docs/TESTING.md` for the testing stack, structure, and coverage targets (Vitest unit; Testcontainers + Supertest integration).

---

## Template

```markdown
## <Feature name>

**Status:** <implemented | in progress | planned> · **Related:** <plan step(s), key files, docs>

### Happy path
- ...

### Edge cases
- ...

### Known limitations
- ...

### Error scenarios
- ... (include error codes, e.g. `AUTH_INVALID_CREDENTIALS` → 401)
```

---

## Authentication (register / login / refresh / logout / me)

**Status:** implemented · **Related:** plan steps 5.2–5.5 · `src/services/auth/authService.ts`, `src/middleware/authenticate.ts`, `src/routes/auth.ts`, `src/schemas/auth.ts` · `docs/SECURITY.md`, `docs/API.md`

### Happy path
- Register a new user → 201 with `{ user, accessToken }` and an httpOnly refresh-token cookie set.
- Login with correct credentials → 200 with `{ user, accessToken }` + refresh cookie.
- Use a valid access token on `GET /auth/me` → 200 with `{ user: { id, email, createdAt } }`.
- `POST /auth/refresh` with a valid refresh cookie → 200 with a new `accessToken` and a rotated refresh cookie.
- `POST /auth/logout` (authenticated) → 204, refresh token revoked in DB, cookie cleared.

### Edge cases
- Password complexity boundaries: exactly 8 chars (min) and 128 chars (max) accepted; each rule (uppercase, lowercase, digit) enforced independently.
- `loginSchema` is lenient (no complexity check) — only presence required.
- Refresh-token **rotation**: the old token is marked `replaced_by_id` and a new one issued; the old token can no longer be used.
- Idempotent logout: logging out an already-revoked token does not error (filtered by `whereNull('revoked_at')`).
- `req.cookies` may be undefined (Express 5) — refresh/logout must tolerate a missing cookie.

### Known limitations
- Single token family per device is not tracked separately (no device/session management UI — see `docs/DEFERRED_FEATURES.md`).
- No email verification or password-reset flow in MVP.
- Rate limiting on auth endpoints is keyed by IP + email; distributed rate limiting (shared store) is not implemented.

### Error scenarios
- Duplicate email on register → `AUTH_EMAIL_IN_USE` (409).
- Weak password / invalid email on register → validation error (400) with field details.
- Wrong password or unknown email on login → `AUTH_INVALID_CREDENTIALS` (401). **Timing must be constant** whether the email exists or not (dummy-hash compare guards against user enumeration) — assert no measurable divergence in behavior between the two.
- Missing/blank Bearer token on protected route → `AUTH_TOKEN_MISSING` (401).
- Expired access token → `AUTH_TOKEN_EXPIRED` (401); malformed/invalid signature → `AUTH_TOKEN_INVALID` (401).
- Refresh with missing cookie → `AUTH_TOKEN_MISSING`; revoked/unknown/already-rotated token → `AUTH_TOKEN_INVALID`. **Replay detection:** presenting an already-rotated refresh token revokes the entire token family.
- `GET /auth/me` for a soft-deleted/nonexistent user → `NotFoundError` (404).

---

## API key encryption (encryptApiKey / decryptApiKey / generateKeyHint)

**Status:** implemented · **Related:** plan step 5.6 · `src/services/encryption/encryptionService.ts` · `docs/BACKEND.md` (Encryption Service), `docs/SECURITY.md` · consumed by step 5.7 user-settings routes

### Happy path
- `encryptApiKey(plaintext)` → a base64 string; `decryptApiKey(...)` of it returns the original plaintext exactly (round-trip identity), including non-ASCII and long keys.
- `generateKeyHint(key)` → `•••••` + the last 4 characters (e.g. `•••••ABCD`), never the full key.

### Edge cases
- **Non-determinism:** encrypting the same plaintext twice yields different output (fresh random 32-byte salt + 16-byte IV per call); both still decrypt back to the same plaintext.
- Empty-string plaintext round-trips. Keys shorter than 4 chars produce a hint padded only by the available characters (document, don't crash).
- AES-256-GCM with a PBKDF2-derived 32-byte key (100K iterations, SHA-256) — derived key length and digest are pinned constants; changing them must be treated as a format break.

### Known limitations
- The encrypted payload format (JSON of `{ciphertext, iv, authTag, salt}`, base64-wrapped) is implicitly versioned; there is no explicit version byte. Master-key rotation is an operational script (see `docs/BACKEND.md` Key Rotation), not covered here.
- The master key is read once at module load via `config.encryption.key`; rotation requires a process restart (out of MVP scope — see `docs/DEFERRED_FEATURES.md`).

### Error scenarios
- **Tamper detection:** any mutation of ciphertext, IV, auth tag, or salt makes `decryptApiKey` throw (GCM auth-tag verification failure). Assert it throws rather than returning corrupted plaintext.
- Malformed input (not base64 / not the expected JSON shape) throws on parse. Callers (step 5.7 routes) surface this as a `KEY_xxx`/`SYS_INTERNAL_ERROR`, never leaking the plaintext or master key.
- Missing/short `ENCRYPTION_KEY` is caught at startup by `config` (`required()`), not at encrypt time.

---

## User API key management (list / add-update / delete / validate)

**Status:** implemented · **Related:** plan steps 5.7–5.8 · `src/routes/userSettings.ts`, `src/schemas/userSettings.ts`, mounted via `src/routes/index.ts` at `/api/user` · uses `src/services/encryption/encryptionService.ts` · `docs/API.md` (User Settings)

### Happy path
- `GET /user/api-keys` → `{ apiKeys: [{ provider, keyHint, isValid, updatedAt }] }` for the authenticated user — **never** the encrypted or plaintext key.
- `POST /user/api-keys` with `{ provider: "gemini", apiKey }` → encrypts the key, stores hint, upserts on `(user_id, provider)`, returns `{ provider, keyHint, isValid: true }`.
- `DELETE /user/api-keys/:provider` → soft-deletes the active row, `204`.
- `POST /user/api-keys/:provider/validate` → decrypts, calls the provider, persists `is_valid`, returns `{ isValid }`.

### Edge cases
- **Upsert across soft-delete:** the `(user_id, provider)` unique index ignores `deleted_at`, so add/update must match *any* existing row (including a soft-deleted one) and clear `deleted_at` rather than insert a duplicate — assert re-adding a previously deleted provider resurrects one row, not two.
- Re-`POST` for an existing provider replaces the key and refreshes the hint; `updatedAt` advances.
- Idempotent delete: deleting a provider with no active key still returns `204` (no error).
- Keys are scoped per user — one user's keys never appear in another's list.
- `is_valid` comes back from MySQL as `0/1`; it is coerced to a real boolean in responses.

### Known limitations
- Only `gemini` is accepted at the API layer (Joi `valid('gemini')`), though the DB enum allows more providers (`openai`, `stability`, `midjourney`) — see `docs/DEFERRED_FEATURES.md`.
- The validate endpoint performs an **interim** lightweight Gemini reachability check via global `fetch`; Phase 10 will move provider calls into the image-generation/provider layer with the shared error mapper.
- No automated test mocks the provider call yet (integration coverage lands in Phase 13); validation currently requires network access to Gemini.

### Error scenarios
- Unauthenticated request to any route → `AUTH_TOKEN_MISSING` (401) via `authenticate`.
- Unsupported/missing `provider` or empty `apiKey` → validation error (400) with field details.
- Validate with no configured key → `KEY_NOT_CONFIGURED` (422).
- Stored key fails to decrypt (corrupt/rotated master key) → `KEY_DECRYPTION_FAILED` (500); never leaks ciphertext or key material.
- Provider rejects the key (HTTP 400/401/403) → `{ isValid: false }` (200) and `is_valid` persisted false — **not** an error response.
- Provider unreachable or unexpected status → `SYS_SERVICE_UNAVAILABLE` (503); a transient outage must not be recorded as an invalid key. The key/URL is never logged.

---

## API routing / app wiring

**Status:** implemented · **Related:** plan step 5.8 · `src/routes/index.ts` (master `apiRouter`), `src/app.ts` (mounts at `/api`)

### Happy path
- The master `apiRouter` mounts feature routers under `/api`: auth at `/api/auth`, user settings at `/api/user`. Reaching a sub-route's validation/auth layer proves it is wired (e.g. `POST /api/auth/login` with an empty body → `400`; `GET /api/user/api-keys` with no token → `401`).
- `GET /health` remains reachable and unauthenticated, returning `{ status: "ok" }`.

### Edge cases
- Global middleware (request ID, logging, security headers, CORS, body parsing) applies to `/api` routes because the router is mounted after them and before the error handler.
- New feature routers (projects, components, storyboard, …) attach here in later phases — adding one must not disturb existing mounts.

### Rate limiting
- `globalLimiter` (100 req/min per IP) is mounted on `/api`, so all API traffic is throttled; exceeding the limit returns `429` with `SYS_RATE_LIMITED` + `requestId` and `RateLimit-*` standard headers.
- `/health` is mounted before the limiter and is intentionally **exempt** — infra healthchecks (ECS `HEALTHCHECK`, ALB target group) must never be throttled. A successful `/health` response carries no `RateLimit-*` headers.
- `authLimiter` still stacks on auth routes (10 / 15 min keyed by IP+email), so auth endpoints are guarded by both limiters.

### Known limitations
- Rate limiting is in-memory per process; a shared store for distributed limiting across instances is not implemented (see `docs/DEFERRED_FEATURES.md`).
- Full end-to-end auth/API-key flows require a live MySQL and are covered by integration tests in Phase 13; this step's verification is limited to routing reachability (no DB).

### Error scenarios
- Unknown path under `/api` (e.g. `GET /api/nope`) → `404` (Express default, no matching route).
- Errors thrown in any mounted route are formatted by the global `errorHandler` into `{ error: { code, message, details, requestId } }`.

---

## Project authorization (`requireProjectAccess`)

**Status:** in progress · **Related:** plan step 6.1 · `src/middleware/authorize.ts`, `src/errors/AppError.ts` (`ForbiddenError`) · `docs/API.md` (error table), `docs/SECURITY.md` · **not reachable until project routes are mounted (step 6.4)**

### Happy path
- An authenticated owner requesting their own active project → middleware loads the row, attaches it to `req.project`, and calls `next()`. Downstream handlers can rely on `req.project` being set.
- `requireProjectAccessAllowDeleted` additionally matches a soft-deleted project the user owns — the basis for the restore route (step 6.4).

### Edge cases
- Ownership is enforced by matching **both** `id` and `user_id`, so a valid project id owned by another user is treated identically to a non-existent one.
- Active-only variant filters `deleted_at IS NULL` via `addActiveFilter`; the allow-deleted variant omits that filter and matches deleted or active.
- Runs only after `authenticate` (which sets `req.user`); the chain order is what guarantees `req.user.id` is present.

### Known limitations
- Component/sub-resource authorization (characters, shots, etc.) is layered in later phases; this middleware scopes access at the project level only.
- No automated test until routes exist — owner/non-owner/deleted behavior is covered by integration tests in step 6.4 and Phase 13. Unit verification so far: `ForbiddenError` code/status shape.

### Error scenarios
- Non-owner, unknown, or (active variant) soft-deleted project → `403` `AUTHZ_PROJECT_ACCESS_DENIED` (deliberately not `404`, to match `docs/API.md`; existence is not revealed via a distinct status).
- Unauthenticated request → fails earlier at `authenticate` with `AUTH_TOKEN_MISSING` (401) before authorization runs.
- `ForbiddenError`'s default code remains `AUTHZ_RESOURCE_ACCESS_DENIED` (used by generic resource guards); the project middleware passes `AUTHZ_PROJECT_ACCESS_DENIED` explicitly. Both are 403 with a `requestId`.

---

## Projects (CRUD / restore / share) + shared public view

**Status:** implemented · **Related:** plan Steps 6.2–6.6; `src/routes/projects.ts`, `src/routes/shared.ts`, `src/db/repositories/projectRepository.ts`, `src/utils/caseMapping.ts`; `docs/API.md` §Projects

### Happy path
- Create → 201 `{id, title, isPublic:false, createdAt}`; a default (empty) `art_styles` row is created in the same transaction (proven by the shared view returning `artStyle` non-null for a brand-new project).
- List → `{data:[…]}` with `actCount`/`shotCount` aggregates (0 for fresh projects); detail adds `sceneCount`/`characterCount`/`shareToken`/`deletedAt`.
- Update (PATCH title) → 200 with fresh `updatedAt`; delete → 204 (soft); restore → 200 `{deletedAt:null}`.
- Share → `{shareToken, shareUrl: ${PUBLIC_APP_URL}/shared/{token}, isPublic:true}`; public `GET /api/shared/:token` needs no auth and returns the full acts→scenes→shots tree; revoke flips back and kills the link (404 afterwards).

### Edge cases
- Aggregates use correlated subqueries with per-level soft-delete filters (deleted scenes don't count their shots).
- Re-sharing regenerates the token (old links die). Restore uses `requireProjectAccessAllowDeleted`.
- All repository output is camelCase (`caseMapping.ts`); `is_public` tinyint → boolean cast.

### Known limitations
- Shared-view `imageUrl`/`thumbnailUrl` are `null` until Phase 9 presigns S3 URLs.
- No pagination on the project list (MVP; fine for expected volumes).

### Error scenarios
- Missing/empty/over-255 title → 400 `VAL_REQUIRED_FIELD` with field details; empty PATCH body → 400.
- Non-owner or deleted project (any verb incl. update/restore-by-stranger) → 403 `AUTHZ_PROJECT_ACCESS_DENIED`; unauthenticated → 401 `AUTH_TOKEN_MISSING`.
- Unknown/revoked share token → 404 `RES_NOT_FOUND`.
- Verified live (23-check smoke script) 2026-07-03; integration tests land in Phase 13 (`tests/integration/projects.test.ts`).

---

## Component library (art style / characters / variants / settings / props / lighting)

**Status:** implemented · **Related:** plan Steps 7.1–7.4; `src/routes/{artStyle,characters,variants,settings,props,lighting}.ts`, `src/routes/componentHelpers.ts` (shared CRUD router factory), `src/db/repositories/*`, `componentCrud.ts` (shared repo factory)

### Happy path
- Standard CRUD for every type; create → 201 full camelCase object; list → `{data:[…]}`; patch → updated object; delete → 204 (soft).
- Characters list carries `variantCount` + `referenceImageCount`; settings list carries `referenceImageCount`; character detail embeds `variants[]` + `referenceImages[]`.
- Art style is one-per-project: exists (empty) from project creation, `PUT` upserts, `GET` self-heals via upsert if the row is missing.
- Variants are nested under characters; the router verifies the character belongs to the project before any variant op.

### Edge cases
- Setting `timeOfDay`/`weather` restricted to the 7-value enums (DB defaults `unspecified`).
- `technicalTerms` JSON round-trips as a real array.
- Component IDs are invisible across projects: fetching Alice's prop via Bob's project → 404 (not 403 — the project gate passed, the resource simply isn't in that project).
- Deleting a character makes its variants unreachable (nested scope), and soft-deleted components disappear from lists and gets.

### Known limitations
- `generate-description` endpoints return **501** until Phase 10 wires Gemini.
- Character-delete does not cascade-soft-delete variant rows (they're unreachable via API; DB-level CASCADE applies only to hard deletes).
- Reference image arrays/counts are exercised properly in Phase 9 (upload flow).

### Error scenarios
- Missing `name` → 400; invalid enum → 400; empty PATCH body → 400 (`.min(1)`).
- Non-owner → 403 `AUTHZ_PROJECT_ACCESS_DENIED` at the project gate; wrong-project resource → 404 `RES_NOT_FOUND`; stubs → 501 `SYS_SERVICE_UNAVAILABLE`.
- Verified live (27-check smoke script) 2026-07-03.

---

## Storyboard structure (acts / scenes / shots)

**Status:** implemented · **Related:** plan Steps 8.1–8.4; `src/routes/{acts,scenes,shots}.ts`, `src/routes/storyboardHelpers.ts`, `src/db/repositories/{act,scene,shot}Repository.ts`, `src/utils/sequencing.ts`, `src/schemas/{act,scene,shot}.ts`

### Happy path
- Hierarchy: act (auto-seq 1000, 2000, …) → scene (per-act sequence, optional default setting/lighting) → shot (per-scene sequence, characters+variants and props via junction tables written transactionally).
- Lists carry aggregates (`sceneCount`, `shotCount`) and resolved default names; shot list embeds character/variant names; shot detail resolves **effective** setting/lighting with `source: 'shot' | 'scene'`.
- Reorder endpoints take `orderedIds` (must equal the exact active-child set) → `{updated: N}` with resequenced GAP spacing; move endpoints append at the target parent's end.
- Annotations: `AnnotationLayer` JSON validated (arrow/textBox/symbol discriminated union), stored, round-trips as parsed JSON.

### Edge cases
- Sequence numbers per parent (scene seq restarts per act, shot seq per scene).
- Reorder rejects partial/duplicated/foreign id sets → 400.
- Junction replacement: PATCH with `characters: []` clears; omitting the key leaves junctions untouched.
- Soft-delete cascade is enforced by chain checks (shot→scene→act→project all active): deleting an act 404s its scenes and shots and drops them from project aggregates.
- Cross-project references (settings/lighting/characters/variants/props in bodies, move targets) rejected 400 — prevents attaching another user's components.

### Known limitations
- `imageUrl`/`thumbnailUrl` null until Phase 9/10 (no generated images yet).
- Reorder resequences one UPDATE per row inside a transaction (fine at storyboard scale).
- `getInsertBetweenSequence` exists but no insert-between endpoint is specced (drag-reorder uses full reorder).

### Error scenarios
- Invalid enums (shotType/cameraAngle/cameraMovement), bad annotation schema (wrong version/shape), empty PATCH → 400.
- Unknown act/scene/shot in project → 404 `RES_NOT_FOUND`; non-owner → 403 `AUTHZ_PROJECT_ACCESS_DENIED`.
- Verified live (30-check smoke script) 2026-07-03; integration tests land in Phase 13 (`tests/integration/shots.test.ts`).

---

## Image storage (S3 presigned uploads / reference images / generated image records)

**Status:** implemented · **Related:** plan Steps 9.1–9.4; `src/services/storage/{s3Client,storageService}.ts`, `src/routes/referenceImages.ts`, `src/schemas/referenceImage.ts`, `src/db/repositories/generatedImageRepository.ts`, `src/config/storage.ts`

### Happy path
- Presign: validates filename ext + MIME + component-in-project, mints imageId, returns `{uploadUrl (15-min PUT), imageId, s3Key, expiresAt}`; key layout `projects/{pid}/references/{imageId}{ext}` (generated: `/generated/`, thumbnails: `/thumbnails/{id}_thumb.webp`).
- Confirm: re-derives the expected key (never trusts client key), HEADs S3, inserts `reference_images` row, best-effort 400×225 webp thumbnail via sharp, returns presigned download URL.
- List by componentType+componentId (or whole project via key-prefix scope) with presigned URLs; delete soft-deletes the record (S3 cleanup left to lifecycle policy).
- Shot list/detail, shared view, and character detail now presign real image/thumbnail URLs when a generated/reference image exists.

### Edge cases
- Presigned URL generation is a local signature computation — works with any configured creds; URL validity is S3's concern at request time.
- Thumbnail failure does not fail the confirm (logged warning); image remains usable.
- List query enforces componentType and componentId together (`.and()`).

### Known limitations
- **No live AWS verification** — dev env has dummy creds; presign shape verified live, S3 round-trips (HEAD/GET/PUT) exercised via mocked integration tests in Phase 13. User should verify with real creds post-merge.
- File size limit (10MB) is not enforceable via presigned PUT (needs presigned POST policy or a HEAD-size check at confirm — deferred).
- Orphaned S3 objects (presigned but never confirmed) rely on lifecycle policy.

### Error scenarios
- Bad extension/MIME/unknown component/tampered s3Key → 400; missing S3 object at confirm → 422 `UPL_S3_ERROR`; unknown image on delete → 404.
- Verified live (9-check smoke) 2026-07-03.

---

## Prompt compiler & image generation (compile-prompt / generate / revert / generate-image / generate-description)

**Status:** implemented · **Related:** plan Steps 10.1–10.6; `src/services/promptCompiler/*`, `src/services/imageGeneration/*`, routes in `shots.ts`, `imageGeneration.ts`, component routers

### Happy path
- `GET …/compile-prompt` → `{prompt, sections, warnings, error}`; section order **framing → description → characters → props → setting → lighting → style → quality** (binding per ARCHITECTURE.md); output verified against the doc's worked example (framing prose, "featuring …; …", "with …", "Set in …", "Rendered in …", quality boosters, sentence-cased).
- `POST …/generate` (optional `editedPrompt`): DRAFT→GENERATING→GENERATED; Gemini `imagen-3.0-generate-002:predict` via fetch (user's decrypted key, 60s timeout) → S3 upload → webp thumbnail → `generated_images` row → shot pointers updated (`previous_image_id` kept for revert); returns presigned URLs.
- `POST …/revert` swaps current/previous image pointers.
- `POST /projects/:id/generate-image` — free-form concept-art generation (same pipeline, no shot).
- `generate-description` (all 6 component types) — Gemini `gemini-2.5-flash:generateContent` builds an AI-optimized visual description from the component's human fields (variant = combined base+variant). Returns `{aiDescription}` (not auto-persisted; client saves via PATCH/PUT).

### Edge cases
- Effective setting/lighting inheritance flows into the context builder (scene defaults when shot fields null).
- Missing descriptions produce warnings, not failures; >1500-char prompt returns a `GEN_PROMPT_TOO_LONG` **error object** from compile (HTTP 200 preview; generate throws 422).
- Prompt-injection sanitization (SECURITY.md): brackets/code fences stripped, newlines limited, 2000-char cap — applied to every user text entering a prompt.
- Failed generation always lands status FAILED (never stuck GENERATING) — prompt resolution happens *before* the status flip.

### Known limitations
- **No live image generated** (no real Gemini key in dev): success path exercised via mocked integration tests (Phase 13); error mapping verified live against the real Gemini endpoint with an invalid key → `KEY_INVALID`.
- Single provider (gemini); model ids centralized in `geminiClient.ts`.
- `GEN_ALREADY_IN_PROGRESS` guard is read-then-write, not a DB-level lock (single-user MVP tolerance).

### Error scenarios
- No key → 422 `KEY_NOT_CONFIGURED`; bad key → 422 `KEY_INVALID`; 429 → `KEY_RATE_LIMITED`; safety block → 422 `GEN_CONTENT_FILTERED`; timeout → 504 `GEN_PROVIDER_TIMEOUT`; other → 502 `GEN_PROVIDER_ERROR`; concurrent generate → 409 `GEN_ALREADY_IN_PROGRESS`; revert without previous → 422 `GEN_NO_PREVIOUS_IMAGE`; `editedPrompt`>1500 → 400.
- Verified live (22-check smoke incl. real Gemini error mapping) 2026-07-03.

---

## Concept art sessions (create / messages / abandon / finalize)

**Status:** implemented · **Related:** plan Steps 11.1–11.3; `src/routes/conceptSessions.ts`, `src/db/repositories/conceptSessionRepository.ts`, `src/routes/componentLookup.ts` (shared component-in-project checks), `src/schemas/conceptSession.ts`

### Happy path
- Create (componentType+componentId validated in-project) → 201 ACTIVE with empty messages; list carries `messageCount`; detail returns full message history with presigned image URLs.
- Message flow: user message persisted → image generated from component context + message content (same pipeline as Phase 10) → assistant message with `generatedImageId` + `imageUrl`; response returns both messages.
- Finalize: `selectedImageId` must have been generated in the session → Gemini text-gen builds the component description (component fields + selected image's prompt) → component `ai_description` updated → session COMPLETED → `{status, generatedDescription}`.
- PATCH allows exactly one client transition: ACTIVE → ABANDONED.

### Edge cases
- User message persists even if generation fails afterwards (conversation history intact for retry).
- Non-ACTIVE sessions reject messages/finalize/abandon with 409 `RES_CONFLICT`.
- Client cannot set COMPLETED directly (schema restricts to ABANDONED).

### Known limitations
- Finalize derives the description from the selected image's *generation prompt* (text proxy), not from vision analysis of the image itself — an MVP choice per plan Step 10.5's template allowance; upgrade path is Gemini multimodal input.
- Assistant message content is templated (no conversational LLM turn) — the image is the real payload.
- Generation success paths mocked in Phase 13 (no live Gemini key).

### Error scenarios
- Unknown/foreign component or foreign `selectedImageId` → 400; unknown session → 404; non-owner → 403; no Gemini key → 422 `KEY_NOT_CONFIGURED`; non-ACTIVE ops → 409.
- Verified live (14-check smoke) 2026-07-03.
