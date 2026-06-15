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
