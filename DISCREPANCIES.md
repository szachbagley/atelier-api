# DISCREPANCIES.md

A catalogue of inconsistencies found by cross-referencing the **codebase** (current
`main`, through Phase 6 Step 6.1), **`BACKEND_DEVELOPMENT_PLAN.md`**, and the **`docs/`**
specification set. Each item is something to **resolve later** — nothing here is fixed by
this document.

**How to read this:** every entry has a severity, the conflicting locations, what's wrong,
and a suggested direction. "Source of truth" is generally the **plan** for *what to build*
and the **docs** for *the spec it implements against* (per AGENTS.md §8); where the
**code** is already correct and a doc is stale, the doc should be updated to match.

Status legend: **Open** · **Resolved-in-code** (already corrected during implementation;
docs/plan may still need updating).

---

## Summary

| # | Severity | Theme | Status |
|---|----------|-------|--------|
| D1 | High | Plan references `docs/README.md`, which was moved to root `README.md` | Resolved (Option 1) |
| D2 | High | `BACKEND.md` `softDelete` helper names don't exist in code | Resolved (Option 1) |
| D3 | High | `BACKEND.md` `projectRepository` example omits plan-required behavior | Resolved (Option 2) — refresh at 6.3 |
| D4 | High | No env var / config for `shareUrl` base URL (needed by Step 6.4) | Resolved (Option 1) |
| D5 | Medium | Root `README.md` describes a monorepo layout that doesn't match this repo | Resolved (Option 1) |
| D6 | Medium | `.env.example` missing optional vars that `config` reads | Resolved |
| D7 | Medium | ESLint: plan says `.eslintrc.cjs`, code uses `eslint.config.mjs` | Resolved |
| D8 | Medium | Project-access middleware: filename + `req.project: any` mismatch | Resolved |
| D9 | Medium | Project-ownership error code (`AUTHZ_PROJECT_ACCESS_DENIED`) | Resolved |
| D10 | Medium | `BACKEND.md` `app.ts` example diverges from actual `app.ts` | Resolved |
| D11 | Medium | Auth schema shape + password complexity described inconsistently | Resolved |
| D12 | Medium | Health endpoint path: `/api/health` vs `/health` | Resolved |
| D13 | Medium | `vitest.config.ts` `globals: false` vs plan/`TESTING.md` `true` | Resolved (code → `true`) |
| D14 | Medium | AGENTS.md claims a snake↔camel helper "already exists" — it doesn't | Resolved (helper builds at 6.3) |
| D15 | Low | Root `README.md` typo: `TypeScript \|G` (stray `G`) | Resolved (folded into D5) |
| D16 | Low | Test file layout differs from `TESTING.md`/Phase 13 target | Deferred (Phase 13) |
| D17 | Low | API-key provider enum: 4 in DB/model vs `gemini`-only at API | Resolved (intentional, documented) |
| D18 | Low | `ARCHITECTURE.md` internal: prompt section order self-conflict | Resolved |
| D19 | Low | `SECURITY.md` CORS example hardcodes origins; code is config-driven | Resolved |
| D20 | Low | `DEPLOYMENT.md` Dependabot/paths reference `/backend`,`/frontend` | Partially resolved — remainder deferred (Phase 12) |

---

## High

### D1 — Plan references `docs/README.md` (moved to root)
- **Locations:** `BACKEND_DEVELOPMENT_PLAN.md:5`, `:41`; file `docs/README.md` no longer exists; content now at repo-root `README.md`. `AGENTS.md:164` already says `README.md`.
- **Issue:** The plan's "all implementation follows … `docs/README.md`" and "env vars from `docs/README.md`" point at a missing file.
- **Suggested:** Update the two plan references to `README.md` (root). Confirm `README.md` is the intended home for env-var/quick-start spec.
- **Resolution (Option 1):** Repointed `BACKEND_DEVELOPMENT_PLAN.md:5` and `:41` from `docs/README.md` → `README.md`, matching `AGENTS.md`. README *content* quality is handled by D5.

### D2 — `BACKEND.md` uses `softDelete` helpers that don't exist
- **Locations:** `docs/BACKEND.md:2014` (`import { notDeleted, softDelete }`), `:2071` (`notDeleted`), `:2095` (`purgeDeleted`) vs actual `src/utils/softDelete.ts:19` `addActiveFilter`, `:25` `permanentDelete`.
- **Issue:** The documented `projectRepository` imports `notDeleted` — code copied from the doc would not compile. Helper names diverged.
- **Suggested:** Update `BACKEND.md` to the real exports (`addActiveFilter`, `permanentDelete`), or rename the utils to match the doc. Code names are the established ones (used in `authorize.ts`); prefer updating the doc.
- **Resolution (Option 1):** Updated `docs/BACKEND.md` — the stale `projectRepository` import and the "Soft Delete Utilities" block now match `src/utils/softDelete.ts` exactly (`softDelete`, `restore`, `addActiveFilter`, `permanentDelete(olderThanDays)`, `import type { Knex }`). No code changed.

### D3 — `BACKEND.md` `projectRepository` omits plan-required behavior
- **Locations:** `docs/BACKEND.md:2016-2061` vs `BACKEND_DEVELOPMENT_PLAN.md` Step 6.3.
- **Issue:** The doc example: (a) returns raw **snake_case** rows with no camelCase conversion, (b) has no `actCount`/`shotCount` aggregates, (c) `create()` does not also insert the default `art_style` row. The plan requires all three.
- **Suggested:** Treat the plan as authoritative; the `BACKEND.md` snippet is illustrative and should be annotated/expanded. Decide the snake↔camel approach here (ties to D14) — this is the first repository and sets the pattern.
- **Resolution (Option 2):** Added an "illustrative sketch" note above the `BACKEND.md` Repository Pattern example pointing to Step 6.3 as authoritative (camelCase boundary, `actCount`/`shotCount` aggregates, transactional default-`art_style` on `create()`). **Follow-up:** refresh the snippet to mirror the real `projectRepository` when Step 6.3 is implemented; the camelCase decision is made there with D14.

### D4 — No config/env var for the share-link base URL
- **Locations:** `docs/API.md:508` (`shareUrl: https://atelier.app/shared/{token}`) vs `src/config/index.ts` (no app/base URL), `.env.example` (none).
- **Issue:** Step 6.4's `POST /:projectId/share` must return an absolute `shareUrl`, but there's no configured base URL to build it from (not derivable from `CORS_ORIGINS`).
- **Suggested:** Add a config value (e.g. `PUBLIC_APP_URL`) to `src/config/index.ts` + `.env.example`, consumed by the share route. Decide the var name before Step 6.4.
- **Resolution (Option 1):** Added `config.app.publicUrl` (`PUBLIC_APP_URL`, dev default `http://localhost:5173`) in `src/config/index.ts` and a `PUBLIC_APP_URL` entry in `.env.example`. Step 6.4's share route builds `${config.app.publicUrl}/shared/{token}`. Build/lint pass. (README env-var docs to be updated with D5/D6.)

---

## Medium

### D5 — Root `README.md` describes a monorepo that doesn't match this repo
- **Locations:** `README.md:43-57, 74, 84-121, 148, 213` (references `backend/`, `frontend/`, `cp backend/.env.example`, `cd backend`, root `docker-compose.yml`).
- **Issue:** This repository is **`atelier-api`** (backend only). The README's quick-start, env setup, and project-structure tree assume a combined `atelier/` repo with `backend/` and `frontend/` subdirs. Following it verbatim fails.
- **Suggested:** Either retarget the README to the backend-only repo (paths relative to repo root, no `frontend/`), or clearly mark it as the umbrella product README and add backend-specific setup. Ties to D20.
- **Resolution (Option 1):** Retargeted the whole `README.md` to the backend-only `atelier-api` repo. Retitled "Atelier API" with a "backend only" note; dropped all `frontend/`/`backend/` paths, the monorepo tree, and the `cp backend/.env.example` / `cd backend` steps. Quick Start now reflects reality (no `docker-compose.yml`/`Dockerfile` in this repo yet — a `docker run` MySQL one-liner + `npm install`/`npm run migrate`/`npm run dev`). Structure tree and Development Commands mirror the actual `src/`, `tests/`, and `package.json` scripts. **Swept in:** D15 (stray `TypeScript |G` fixed) and D6's README side (env block now lists `JWT_ACCESS_EXPIRY`/`JWT_REFRESH_EXPIRY`/`BCRYPT_ROUNDS`/`PUBLIC_APP_URL` with defaults and notes AWS creds go through the SDK chain). **Still open under D6:** the matching `.env.example` additions. D20 (Dependabot `/backend` paths) tracked separately.

### D6 — `.env.example` missing optional vars `config` reads
- **Locations:** `.env.example` vs `src/config/index.ts:28-30` (`JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `BCRYPT_ROUNDS` via `optional()`); plan Step 1.2 says `.env.example` lists *all* env vars.
- **Issue:** The three optional auth vars aren't in `.env.example`. Separately, `.env.example` lists `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, which `config` does **not** read (the AWS SDK uses its default credential chain) — harmless but undocumented.
- **Suggested:** Add the optional auth vars (with default values as comments) and note the AWS creds are consumed by the SDK, not `config`. Combine with D4's new var.
- **Resolution:** Added `JWT_ACCESS_EXPIRY=15m`, `JWT_REFRESH_EXPIRY=7d`, `BCRYPT_ROUNDS=12` to `.env.example` with `# optional (default: …)` comments, and a comment noting the AWS access keys are resolved by the SDK default credential chain, not read by `src/config`. Mirrors the README env block from D5. `.env.example` now covers every var `config` reads.

### D7 — ESLint config: plan vs code
- **Locations:** `BACKEND_DEVELOPMENT_PLAN.md:40` (`.eslintrc.cjs`) and `:56`-ish lint script `eslint src/ --ext .ts` vs actual `eslint.config.mjs` (flat config) and `package.json` script `eslint src/`.
- **Issue:** Project uses ESLint flat config; the plan describes legacy `.eslintrc.cjs` and an `--ext` flag that flat config ignores.
- **Suggested:** Update the plan to reflect flat config (`eslint.config.mjs`) and the actual script. Code is correct.
- **Resolution:** Updated `BACKEND_DEVELOPMENT_PLAN.md` Step 1.2: `.eslintrc.cjs` → `eslint.config.mjs` (flat config) and the lint script `eslint src/ --ext .ts` → `eslint src/`. No code changed.

### D8 — Project-access middleware: filename + typing
- **Locations:** `docs/BACKEND.md:1572` (`src/middleware/projectAccess.ts`, `req.project?: any` global redeclare) and `docs/SECURITY.md:351` vs plan Step 6.1 (`src/middleware/authorize.ts`) and actual `src/middleware/authorize.ts` + `src/types/express.d.ts` (`req.project?: Project`).
- **Issue:** Doc names the file `projectAccess.ts` and types `req.project` as `any`; code follows the plan (`authorize.ts`) and the existing typed `req.project`.
- **Suggested:** Update `BACKEND.md`/`SECURITY.md` to `authorize.ts` and drop the `any` redeclare. Code/plan are aligned.
- **Resolution:** `docs/BACKEND.md` Project Access Middleware section now mirrors the real `src/middleware/authorize.ts` verbatim (no `declare global`, `req.project` typed via `src/types/express.d.ts`, `addActiveFilter`, `requireProjectAccessAllowDeleted` variant). `docs/SECURITY.md` example corrected likewise. Also closes D9's doc side.

### D9 — Project-ownership error code *(Resolved-in-code)*
- **Locations:** `docs/API.md:94` (`AUTHZ_PROJECT_ACCESS_DENIED` → 403) vs `docs/BACKEND.md:1600` / `docs/SECURITY.md:365` examples throwing generic `ForbiddenError` (→ `AUTHZ_RESOURCE_ACCESS_DENIED`).
- **Issue:** Doc examples would emit the wrong code.
- **Resolution:** Step 6.1 made `ForbiddenError` code-aware (`src/errors/AppError.ts`) and `authorize.ts` passes `AUTHZ_PROJECT_ACCESS_DENIED`. Doc side closed with D8: both `docs/BACKEND.md` and `docs/SECURITY.md` examples now throw `ForbiddenError('project', ErrorCodes.AUTHZ_PROJECT_ACCESS_DENIED)`. Fully resolved.

### D10 — `BACKEND.md` `app.ts` example diverges from actual
- **Locations:** `docs/BACKEND.md:2117-2135` (imports `requestIdMiddleware`, `import routes from './routes'`, omits pino-http logger and rate limiter, different middleware order) vs `src/app.ts` (named `requestId`, `apiRouter` from `./routes/index.js`, pino-http present, `globalLimiter` on `/api`).
- **Issue:** The documented app wiring is stale relative to what was built.
- **Suggested:** Refresh the `BACKEND.md` `app.ts` snippet to match (or annotate as illustrative). Code is the source of truth here.
- **Resolution:** Replaced the `docs/BACKEND.md` snippet with the actual `src/app.ts` verbatim (requestId, pino-http logger, security headers, CORS, cookie/JSON parsing at `1mb`, `/health`, `globalLimiter` on `/api`, error handler last).

### D11 — Auth schema shape + password complexity
- **Locations:** `docs/BACKEND.md:1617` (`authSchemas` object, `register`/`login` keys, password only `min/max`) vs actual `src/schemas/auth.ts` (named exports `registerSchema`/`loginSchema`, password **complexity regex**). `docs/SECURITY.md:53` *does* list complexity requirements.
- **Issue:** `BACKEND.md` implies no complexity rule and a different export shape; code enforces complexity (matching `SECURITY.md`) via named exports.
- **Suggested:** Update `BACKEND.md` to named exports + complexity. Code aligns with `SECURITY.md`.
- **Resolution:** Replaced the `docs/BACKEND.md` auth-schema snippet with the actual `src/schemas/auth.ts` (named exports `registerSchema`/`loginSchema`, complexity regex) and noted the complexity rule matches `SECURITY.md`. Adjacent future-phase snippets (e.g. `shot.ts`) left as illustrative.

### D12 — Health endpoint path inconsistency
- **Locations:** `docs/DEPLOYMENT.md:743` (`https://atelier.app/api/health`) vs actual `src/app.ts` `/health`, and `docs/DEPLOYMENT.md:53` (Dockerfile `/health`), `docs/INFRASTRUCTURE.md:212,229` (`/health`), `docs/BACKEND.md:2135` (`/health`).
- **Issue:** One line documents the health URL as `/api/health`; everywhere else (and the code) it's root `/health`. Note `ARCHITECTURE.md:92` only routes `/api/*` to the backend, so `/health` relies on the explicit ALB rule in `INFRASTRUCTURE.md:212`.
- **Suggested:** Fix `DEPLOYMENT.md:743` to `/health` (or, if `/api/health` is desired, move the route and update the ALB rule + Dockerfile). Decide canonical path.
- **Resolution:** Canonical path is root `/health` — code, Dockerfile healthcheck, `INFRASTRUCTURE.md` ALB rule, and `BACKEND.md` all agree; the one `DEPLOYMENT.md` line was the outlier and was fixed to `https://atelier.app/health`. (`/health` also stays exempt from the `/api` rate limiter by design.)

### D13 — Vitest `globals` mismatch
- **Locations:** `vitest.config.ts:5` (`globals: false`) vs `docs/TESTING.md:93` and plan Step 13.1 (`globals: true`). Actual config also lacks the coverage thresholds, `setupFiles`, and `@` alias resolver those specify.
- **Issue:** Present contradiction (existing tests import `describe/it/expect` explicitly, consistent with `globals:false`). The richer config is a Phase 13 deliverable, but the `globals` value directly conflicts now.
- **Suggested:** Decide `globals` true vs false and align tests + config + docs in Phase 13. Low urgency but a real contradiction.
- **Resolution (judgment call — code aligned to plan/docs):** Changed `vitest.config.ts` to `globals: true`. Rationale: plan Step 13.1 and `TESTING.md` both specify `true` and the plan is authoritative for what to build; existing tests' explicit `vitest` imports remain valid under `globals: true`, so this is a one-line, zero-breakage fix. The richer config (coverage thresholds, `setupFiles`, `@` alias) remains a Step 13.1 deliverable. Unit tests verified green.

### D14 — AGENTS.md claims a snake↔camel helper already exists
- **Locations:** `AGENTS.md:101` ("Snake↔camel conversion … already have helpers — reuse them") vs `src/utils/` (no such helper; only `logger`, `sequencing`, `softDelete`).
- **Issue:** Guidance points at a non-existent utility. This is the crux of the Phase 6.3 repository convention (ties to D3).
- **Suggested:** Either build the helper (and keep the guidance) or amend AGENTS.md. Resolve as part of the Step 6.3 convention decision.
- **Resolution:** Amended `AGENTS.md` §5 to stop asserting the helper exists: soft-delete and sequencing helpers "already exist — reuse them"; snake↔camel "gets a shared helper when the first repository lands (Step 6.3) — build it once there." The convention decision itself still lands at Step 6.3 (with the D3 snippet refresh). No speculative helper built now (YAGNI).

---

## Low

### D15 — Root `README.md` typo
- **Location:** `README.md:24` — `| **Backend** | Node.js, Express, TypeScript |G` (stray trailing `G`).
- **Suggested:** Delete the stray `G`.
- **Resolution:** Fixed as part of the D5 README rewrite (Option 1).

### D16 — Test file layout vs target
- **Locations:** actual `tests/unit/auth-schemas.test.ts`, `tests/unit/sequencing.test.ts` (flat) vs `docs/TESTING.md:27-54` / plan Step 13.x (`tests/unit/{services,middleware,utils}/…`).
- **Issue:** Current tests are flat; the documented structure is nested. Phase 13 is where this is built out.
- **Suggested:** Reorganize when Phase 13 lands; no action needed now beyond awareness.
- **Resolution:** Deferred to Phase 13 by design — the flat `tests/unit/*.test.ts` layout is fine until Phase 13 builds out the nested `tests/unit/{services,middleware,utils}` structure per `TESTING.md`. No action now.

### D17 — API-key provider enum breadth
- **Locations:** `src/db/migrations/002_create_user_api_keys.ts:8` + `src/types/models.ts` (`gemini|openai|stability|midjourney`) vs `src/schemas/userSettings.ts:5` (`valid('gemini')`) and `docs/API.md` (gemini-only).
- **Issue:** DB/model allow four providers; API restricts to `gemini` for MVP (intentional, noted in FEATURE-TESTS). Listed for traceability.
- **Suggested:** Keep as-is for MVP; ensure docs note the DB enum is forward-looking.
- **Resolution:** Kept as-is (intentional). Added a note under the `user_api_keys` table in `docs/DATABASE.md`: the `provider` enum is forward-looking; the API layer accepts only `gemini` for the MVP.

### D18 — `ARCHITECTURE.md` prompt section order self-conflict
- **Locations:** `docs/ARCHITECTURE.md:338-349` ("Section Builders" lists `buildDescriptionSection` after lighting) vs `:382-391` ("Prompt Structure" places description right after framing).
- **Issue:** Internal inconsistency about where the user description sits in the compiled prompt. Relevant when building the Phase 10 compiler.
- **Suggested:** Pick the canonical order before Step 10.1 and make both diagrams agree.
- **Resolution (judgment call — description after framing):** Canonical order taken from the "Prompt Structure" diagram *and* the worked example prompt, which both place the user's description immediately after framing (2 of 3 sources agreed). Moved `buildDescriptionSection()` to right after `buildFramingSection()` in the Section Builders box so all three now agree. Binding for the Phase 10 compiler.

### D19 — `SECURITY.md` CORS example hardcodes origins
- **Locations:** `docs/SECURITY.md:432-455` (hardcoded `atelier.app`/`www`) vs `src/middleware/cors.ts` (config-driven via `CORS_ORIGINS`).
- **Issue:** Doc snippet is illustrative and less correct than the implemented config-driven approach.
- **Suggested:** Update the doc to reference `config.cors.origins`. Low priority.
- **Resolution:** Replaced the hardcoded-origins snippet in `docs/SECURITY.md` with the actual `src/middleware/cors.ts` (config-driven via `CORS_ORIGINS`), noting production origins are set through the environment, not code.

### D20 — `DEPLOYMENT.md` references `/backend`,`/frontend` dirs
- **Locations:** `docs/SECURITY.md:679-698` (Dependabot `directory: "/backend"`/`"/frontend"`) and `docs/DEPLOYMENT.md` build paths.
- **Issue:** Assumes the monorepo layout (see D5); this repo is `atelier-api`.
- **Suggested:** Adjust paths when CI/infra is set up (Phase 12). Awareness only.
- **Resolution (partial — remainder deferred to Phase 12):** Fixed the `docs/SECURITY.md` Dependabot example to this repo's reality (single `npm` + `docker` entries at `directory: "/"`; frontend repo keeps its own config). `docs/DEPLOYMENT.md` is pervasively monorepo (compose file, GH Actions matrix, frontend Dockerfile/nginx — 30+ path references); rewriting it before Phase 12 decides the CI/CD layout would be speculative, so a **Status note** was added at the top of `DEPLOYMENT.md` flagging that paths reflect the pre-split monorepo and will be revised in Phase 12.

---

## Notes / scope of this pass

- **Not exhaustively audited:** a per-table comparison of all 19 migrations against
  `docs/DATABASE.md` columns/enums/indexes was **not** done line-by-line (spot checks of
  `projects`, `art_styles`, `user_api_keys` matched). Recommend a dedicated DB audit pass
  before Phase 8/9 build out the storyboard + image tables.
- **Frontend docs** (`FRONTEND.md`, `STYLE_GUIDE.md`) are out of backend scope and were not
  cross-referenced beyond confirming they don't contradict the API contract.
- **Illustrative code in docs:** many `docs/BACKEND.md` snippets are simplified pseudo-code.
  Only divergences that would mislead implementation or contradict the contract are listed
  (D2, D3, D8, D10, D11); trivially-simplified snippets were not flagged individually.

---

## Resolution report (2026-07-03)

All 20 items are now dispositioned. D1–D5 were resolved interactively (options presented,
user selected); D6–D20 were resolved autonomously per user delegation. Everything lives
uncommitted on the `main` working tree, pending a cleanup branch + PR.

### Files changed in this cleanup pass
| File | Items |
|------|-------|
| `README.md` | D5 (full backend-only rewrite), D15, D6 (env docs) |
| `.env.example` | D4, D6 |
| `src/config/index.ts` | D4 (`config.app.publicUrl`) |
| `vitest.config.ts` | D13 (`globals: true`) — *only code-behavior change in this pass* |
| `AGENTS.md` | D14 |
| `BACKEND_DEVELOPMENT_PLAN.md` | D1, D7 |
| `docs/BACKEND.md` | D2, D3 (annotation), D8, D9, D10, D11 |
| `docs/SECURITY.md` | D8/D9 (example), D19 (CORS), D20 (Dependabot) |
| `docs/DEPLOYMENT.md` | D12 (health URL), D20 (status note) |
| `docs/DATABASE.md` | D17 (enum note) |
| `docs/ARCHITECTURE.md` | D18 (builder order) |

### Judgment calls made autonomously (flag if you disagree)
1. **D13 — `globals: true` in `vitest.config.ts`** (code changed to match plan/docs,
   not vice versa). Plan Step 13.1 + `TESTING.md` both specify `true`; existing explicit
   imports keep working. One line, tests verified green.
2. **D18 — description-after-framing** as the canonical prompt order (Prompt Structure
   diagram + worked example outvoted the Section Builders list, which was edited).
3. **D20 — partial resolution.** Dependabot example fixed now; the rest of
   `DEPLOYMENT.md`'s monorepo paths deferred to Phase 12 behind an explicit status note,
   since a rewrite before the CI/CD design lands would be speculative.

### Deliberately deferred (tracked, with owners)
| Item | What remains | When |
|------|--------------|------|
| D3 | Refresh `BACKEND.md` repository snippet to mirror the real `projectRepository` | Step 6.3 |
| D14 | Build the shared snake↔camel helper (guidance already corrected) | Step 6.3 |
| D16 | Nest `tests/unit/` into `{services,middleware,utils}` | Phase 13 |
| D13 | Full vitest config (coverage thresholds, `setupFiles`, `@` alias) | Step 13.1 |
| D20 | Rewrite `DEPLOYMENT.md` paths/pipeline for the split repos | Phase 12 |
| — | Line-by-line migration audit vs `DATABASE.md` (spot checks passed) | Before Phase 8/9 |

### Verification
`npm run build`, `npm run lint`, and `npm run test` all pass after the changes
(D13 is the only change affecting runtime/test behavior). Doc edits spot-checked by
grep: no remaining references to `projectAccess.ts`, `.eslintrc`, `authSchemas`,
`notDeleted`, `/api/health`, or `/backend`-scoped Dependabot entries.

---

## Deferred-item closure (fast-track Phases 6–14, 2026-07-16)

All five deliberately-deferred items above are now **closed** by the fast-track
implementation (branch `fast-track-phases-6-14`):

| Item | Closed by | Where |
|------|-----------|-------|
| D3 | `docs/BACKEND.md` repository snippet refreshed to mirror the real `projectRepository` (camelCase boundary, `actCount`/`shotCount` aggregates, transactional default `art_style`) | Phase 6 Step 6.3 |
| D14 | Shared snake↔camel helper built: `src/utils/caseMapping.ts` (`toCamelRow`/`toCamelRows`/`toSnakeRow`); every repository routes through it | Phase 6 Step 6.3 |
| D16 | `tests/unit/` nested into `{services,middleware,utils,schemas}`; the two pre-existing flat tests moved | Phase 13 Step 13.1 |
| D13 | Full `vitest.config.ts` — v8 coverage thresholds (70/60/70/70, scoped `include`), `setupFiles`, `@`→`src` alias — plus `vitest.integration.config.ts` | Phase 13 Step 13.1 |
| D20 | `docs/DEPLOYMENT.md` Docker sections rewritten to the real backend-only `Dockerfile`/`docker-compose.yml` (repo root); the pre-split status note narrowed to the still-pending CI/CD + frontend sections | Phase 12 |

### New discrepancy found and fixed during Phase 13
- **D21 — `GEN_ALREADY_IN_PROGRESS` returned HTTP 422, docs/API.md specifies 409.**
  The generation service threw a `GenerationError` (422) for a concurrent-generation
  conflict. Fixed to `ConflictError` (409) in `src/services/imageGeneration/index.ts`;
  regression-locked by `tests/integration/generation.test.ts`. **Status: Resolved (code).**
