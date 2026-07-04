# AGENTS.md — Atelier Backend

Operating guide for AI agents working in **`atelier-api`**, the backend for Atelier (an AI-powered storyboarding tool for filmmakers). Read this in full before making changes. It governs *how* you work here, not just *what* the code does.

This file covers the **backend only**. The frontend lives in a separate directory and is out of scope.

---

## 1. The golden rules

1. **Develop one plan step at a time.** All work is driven by `BACKEND_DEVELOPMENT_PLAN.md`. Implement exactly one step per branch/PR — never batch steps.
2. **One PR per step**, with a TLDR. Branch from `main`, do the work, open a PR, and let the human merge. Never push to `main`, never self-merge. See §3.
3. **Maintain `FEATURE-TESTS.md`.** Every time you build or meaningfully change a feature, add/update its section with a testing strategy. See §4.
4. **Keep dependencies lean.** Do not add a dependency without explicit justification. See §6.
5. **Follow the specs in `docs/`.** The plan and the docs are the source of truth. If code and docs disagree, surface it rather than guessing. See §8.
6. **Honor the principles: DRY, SOLID, KISS, YAGNI.** See §5.

---

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node.js 20+ | Alpine in production |
| Language | TypeScript 6, **strict mode** | `module`/`moduleResolution`: `NodeNext`, target ES2022 |
| Web framework | Express 5 | Async handler rejections auto-forward to error middleware |
| Database | MySQL 8.0 via **Knex** | `mysql2` driver; migrations in `src/db/migrations/` |
| Auth | `jsonwebtoken` (HS256), `bcrypt` | Access (15m) + refresh (7d, rotated) tokens |
| Validation | **Joi** | `abortEarly: false, stripUnknown: true` |
| Security | `helmet`, `cors`, `express-rate-limit` | CSP + HSTS per `docs/SECURITY.md` |
| Storage | AWS S3 (`@aws-sdk/client-s3`, presigner), `sharp` | Presigned uploads/downloads, thumbnails |
| Logging | `pino` + `pino-http` | Request-ID correlation; pretty in dev, JSON in prod |
| IDs | `uuid` v4 | Generated app-side before insert; PKs are `CHAR(36)` |
| Config | `dotenv` | Validated at startup in `src/config/index.ts` |
| Tests | **Vitest**, Supertest, Testcontainers (MySQL), Faker | Unit + integration |
| Lint | ESLint (flat config) + `eslint-config-prettier` | |

**AI integration:** Google Gemini (Imagen for images, text models for descriptions). Single provider for MVP — the prompt compiler uses an adapter pattern so more can be added later.

---

## 3. Development workflow (per-step PR process)

This is **mandatory**. It is also encoded in the `execute-step` skill.

Repository: `/Users/zachbagley/atelier/atelier-api/` · Remote: `origin` → `https://github.com/szachbagley/atelier-api.git` · Default branch: `main`. Run all git commands from inside `atelier-api/`.

**For each step of `BACKEND_DEVELOPMENT_PLAN.md`:**

1. **Pre-flight.** Confirm `git status --short` is empty and you are on `main`. If not on `main`, the previous PR may be unmerged — **stop and ask**, don't switch/stash silently. Then `git pull --ff-only origin main`. If the new step has no dependency on an unmerged PR, it may branch from current `main` independently — but verify, don't assume.
2. **Branch.** Name it `phase{N}-step{N}-{1-3 word kebab-case summary}` (e.g. `phase5-step6-encryption`). The summary names the *deliverable*, not the verb.
3. **Do the work** for that step only. Verify acceptance criteria.
4. **Verify before committing:** `npm run build` (zero errors) and `npm run lint` (clean) must pass. Run `npm test` if the step has unit tests.
5. **Commit.** Stage only the step's files (avoid blanket `git add -A`). Message format:
   ```
   Phase {N} Step {N.N}: {Step title}

   {1-3 sentences on what and why}

   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
6. **Push** the branch: `git push -u origin {branch}`.
7. **Open a PR** with `gh pr create`. The body **must include a TLDR**:
   ```
   ## TLDR
   {2-4 bullets: what changed and why it matters}

   ## Files
   {files added/modified}

   ## Verification
   {acceptance criteria checked — build/lint/tests}

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```
8. **Report back:** branch name, PR URL, and a one-sentence preview of the next step. **Do not merge.** **Do not check out `main`** after pushing — stay on the feature branch.

**Edge cases:** dirty tree on entry → ask. Already on a feature branch → ask (prior step may be unmerged). Build/lint fails → fix before pushing, never push broken. Step touches files outside `atelier-api/` → flag as a planning bug. `git push` rejected → investigate, never `--force` without permission.

---

## 4. `FEATURE-TESTS.md` maintenance (required)

`FEATURE-TESTS.md` is a living catalogue of testing strategy per feature. **Whenever you implement or materially change a feature, add or update its section in the same PR.** This is part of "done," not optional follow-up.

Each feature section must address **all four** dimensions:

- **Happy path** — the primary success flow(s) and what proves they work.
- **Edge cases** — boundaries, empty/optional inputs, ordering, concurrency, idempotency.
- **Known limitations** — what is intentionally *not* covered, MVP shortcuts, deferred behavior (cross-reference `docs/DEFERRED_FEATURES.md` where relevant).
- **Error scenarios** — invalid input, auth failures, conflicts, downstream/provider failures, and the exact error codes returned.

Write the *strategy* (what to test and why), not just a list of existing test files. It guides both new tests and future regression work. Keep entries concise. The file's own header documents the template; follow it.

---

## 5. Programming principles

Hold the line on these. Reviewers will push back when they're violated.

- **DRY** — No copy-paste logic. Shared behavior belongs in `utils/`, services, or repositories. Soft-delete filtering and sequence numbering already have helpers — reuse them. Snake↔camel conversion gets a shared helper when the first repository lands (Step 6.3) — build it once there, then reuse it everywhere.
- **SOLID** —
  - *Single responsibility:* routes handle HTTP; services hold business logic; repositories own data access. Don't write SQL in a route handler.
  - *Open/closed:* extend via new modules/adapters (e.g. prompt-compiler adapters), don't bolt special cases onto stable code.
  - *Dependency inversion:* depend on the service/repository interface, not on Knex internals scattered everywhere.
- **KISS** — Prefer the simplest design that satisfies the step. No speculative abstraction.
- **YAGNI** — Build what the current step requires. Don't pre-build for hypothetical future steps (the plan will get there).
- **Separation of concerns / layering:** `routes → services → repositories → db`. Keep the direction of dependencies one-way.
- **Fail loud, fail safe:** validate input at the edge (Joi), throw typed `AppError`s, never leak internals in responses.

If a step seems to require duplicating or contorting code, that's a signal to refactor a shared helper — note it in the PR rather than silently copy-pasting.

---

## 6. Dependency leanness policy

**Every dependency is a liability** (security surface, maintenance, bundle/image size). Before adding one:

1. Can it be done with the standard library or an existing dependency? (e.g. `crypto` for hashing/encryption — already used; no new crypto libs.)
2. Is it already listed in the plan / `package.json`? The stack is largely fixed — prefer what's there.
3. If genuinely needed: prefer well-maintained, widely-used, minimal-transitive-dependency packages, and **call it out explicitly in the PR** with the justification.

Do **not** add: utility kitchen-sink libs (lodash, moment, etc.), redundant HTTP clients, ORMs on top of Knex, or anything that overlaps an existing dependency. Dev dependencies follow the same bar. When in doubt, ask before adding.

---

## 7. Coding conventions

- **ESM + NodeNext:** relative imports **must** carry the `.js` extension even from `.ts` sources (e.g. `import { db } from '../db/index.js'`). This is required by `module: NodeNext`.
- **snake_case ↔ camelCase:** DB columns are snake_case; API request/response bodies are camelCase. **Repositories** own the conversion — routes/services speak camelCase.
- **UUIDs:** generate v4 app-side before insert for all PKs.
- **Soft deletes:** every read filters `whereNull('deleted_at')` unless explicitly operating on deleted rows (restore, permanent delete). Use the `softDelete` helpers.
- **Transactions:** use Knex transactions for multi-table operations (shot + junction tables, token rotation, project + default art_style).
- **Errors:** throw `AppError` subclasses with the correct `ErrorCode` from `src/errors/codes.ts`. The global `errorHandler` formats the response `{ error: { code, message, details, requestId } }`. Never expose stack traces or internal detail; unknown errors become `SYS_INTERNAL_ERROR` (500).
- **Express 5:** async route handlers don't need try/catch — rejections auto-forward to the error handler. `req.cookies` may be `undefined`; `req.query` is a read-only getter.
- **Validation:** every mutating route validates with a Joi schema via the `validate`/`validateParams`/`validateQuery` middleware. Validated, stripped value replaces `req.body`.
- **Logging:** use the Pino `logger`; include `requestId`. Log auth/validation/generation failures at `warn`, unexpected errors at `error`. **Never log secrets, passwords, API keys, or full tokens.**
- **Secrets/config:** only via `src/config`. Never hardcode secrets; never read `process.env` ad hoc in business code.
- **Types:** no implicit `any`; avoid non-null assertions (`!`) — both are ESLint warnings. Prefer explicit annotations over assertions. Model interfaces live in `src/types/models.ts`.

### Commands

```bash
npm run dev         # nodemon + tsx, hot reload
npm run build       # tsc → dist/ (must be zero errors before PR)
npm run lint        # eslint src/ (must be clean before PR)
npm test            # vitest unit tests
npm run test:integration   # Testcontainers + Supertest (real MySQL)
npm run test:all    # unit + integration
npm run migrate          # knex migrate:latest
npm run migrate:make     # scaffold a migration
```

---

## 8. Documentation structure

`BACKEND_DEVELOPMENT_PLAN.md` (repo root) is the **execution plan** — 14 phases, each broken into steps with files to create and acceptance criteria. Work through it sequentially; it is the spec for *what to build next*.

The `docs/` directory is the **specification set** (the source of truth the plan implements against):

| Doc | What it covers | Consult when… |
|---|---|---|
| `README.md` | Product overview, tech stack, env vars, quick start | Orienting; checking env variables |
| `ARCHITECTURE.md` | System architecture, data flow, **prompt compiler design**, shot context | Building services/generation/prompt compiler |
| `API.md` | Complete REST reference: endpoints, methods, request/response shapes, **error codes** | Building or auditing any route |
| `BACKEND.md` | Backend project structure, config, services, middleware details | Implementing services/middleware (auth, encryption) |
| `DATABASE.md` | Full data model: tables, columns, enums, FKs, indexes, conventions | Writing migrations, models, repositories |
| `SECURITY.md` | Auth, encryption, validation, CSP/headers, infra security, audit checklist | Anything touching auth, secrets, headers, crypto |
| `DEPLOYMENT.md` | Docker (multi-stage), CI/CD, deploy procedures | Phase 12 / Dockerfile / compose |
| `TESTING.md` | Testing stack, structure, patterns, coverage targets | Writing tests; informs `FEATURE-TESTS.md` |
| `INFRASTRUCTURE.md` | AWS topology (VPC, ECS, S3, EC2 MySQL) | Infra/deploy context |
| `DEFERRED_FEATURES.md` | Explicitly out-of-MVP features + rationale | Resisting scope creep; "Known limitations" in tests |
| `FRONTEND.md` | Frontend (separate app) | Understanding API consumers — **not** for backend changes |
| `STYLE_GUIDE.md` | Visual design system | Frontend-only — rarely relevant to backend |

When the plan references a doc for a step, read that doc's relevant section before coding. If a doc and the plan conflict, **flag it** rather than silently picking one.

---

## 9. Other important considerations

- **Security is non-negotiable** (see `docs/SECURITY.md` checklist): parameterized queries only (Knex), Joi validation on all input, prompt-injection sanitization on text entering AI prompts, API keys encrypted at rest (AES-256-GCM), passwords bcrypt-hashed, refresh-token rotation with replay detection (revoke the family), presigned URLs with short expiry, no secrets in logs/errors.
- **Status reporting must be faithful.** If build/lint/tests fail, say so with the output. Don't claim a step is done if acceptance criteria aren't met.
- **Stay in scope.** Implement the current step. If you spot adjacent problems, note them for the user instead of expanding the PR.
- **Mounting vs. defining.** Routers/services are often *defined* in one step and *wired in* (mounted) in a later step — check the plan before assuming something should be reachable yet.
- **Don't retroactively restructure history.** Early phases were committed directly to `main` before the per-step PR workflow existed; leave that history alone unless asked.
- **Parent directory is not a git repo.** Only `atelier-api/` is version-controlled here.
```
