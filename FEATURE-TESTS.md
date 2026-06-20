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

**Status:** implemented · **Related:** plan step 5.7 · `src/routes/userSettings.ts`, `src/schemas/userSettings.ts` · uses `src/services/encryption/encryptionService.ts` · `docs/API.md` (User Settings) · **not mounted until step 5.8**

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
