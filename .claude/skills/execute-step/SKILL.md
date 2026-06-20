---
name: execute-step
description: Use whenever the user asks to execute a step of `atelier-api/BACKEND_DEVELOPMENT_PLAN.md` (e.g. "Execute Step 3.3"). Performs the per-step PR workflow — creates a feature branch, does the work, commits, pushes, and opens a PR for the user to review and merge manually.
---

# Atelier per-step PR workflow

Every step of `atelier-api/BACKEND_DEVELOPMENT_PLAN.md` happens on its own branch and is reviewed via a pull request. The user merges manually after review.

## Repository

- Git repo path: `/Users/zachbagley/atelier/atelier-api/`
- Remote: `origin` → `https://github.com/szachbagley/atelier-api.git`
- Default branch: `main`

All git commands must run from inside `atelier-api/`. The skill assumes the working directory is the project root (`/Users/zachbagley/atelier`), so pass the repo path explicitly via `git -C` or `cd` into it.

## Workflow

Follow these steps in order. Do not skip ahead.

### 1. Pre-flight check

Before doing anything else, confirm the repo is in a clean state:

```bash
cd /Users/zachbagley/atelier/atelier-api
git status --short
git branch --show-current
```

Required state:
- `status --short` returns empty (no uncommitted changes)
- `branch --show-current` returns `main`

If not on `main`, the previous step's PR may not be merged yet. Stop and ask the user how to proceed — do NOT switch branches or stash changes without their say-so.

If on `main` but the working tree is dirty, stop and ask.

If both conditions are met, sync with origin:

```bash
git pull --ff-only origin main
```

### 2. Create the branch

**Naming convention:** `phase{N}-step{N}-{1-3 word summary, kebab-case, lowercase}`

The summary should describe the deliverable, not the verb. Examples:
- `phase2-step1-error-codes`
- `phase2-step2-error-handler`
- `phase3-step1-knex-config`
- `phase3-step2-migrations`
- `phase3-step3-utilities`
- `phase5-step3-auth-service`

```bash
cd /Users/zachbagley/atelier/atelier-api
git checkout -b phase{N}-step{N}-{summary}
```

### 3. Execute the step's work

Perform the changes described in the plan for this step. Verify acceptance criteria (build, lint, any inline tests) before moving on.

### 4. Commit

Stage only the files changed for this step (avoid `git add -A` unless every untracked file is part of the step's deliverable):

```bash
cd /Users/zachbagley/atelier/atelier-api
git add <files>
git commit -m "$(cat <<'EOF'
Phase {N} Step {N.N}: {Step title from plan}

{1-3 sentence summary of what was added, focused on the why}

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### 5. Push

```bash
cd /Users/zachbagley/atelier/atelier-api
git push -u origin {branch-name}
```

### 6. Open the PR

Use `gh pr create` — `gh` is installed and authenticated as `szachbagley`.

```bash
cd /Users/zachbagley/atelier/atelier-api
gh pr create --title "Phase {N} Step {N.N} — {Step title}" --body "$(cat <<'EOF'
## TLDR
{2-4 short bullet points summarizing what changed and why it matters}

## Files
- {list of files added/modified, grouped if many}

## Verification
- {acceptance criteria verified — e.g. "build passes", "lint passes", "manual smoke test of X"}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the PR URL printed by `gh pr create` and include it in the response to the user.

### 7. Report back to the user

After the PR is open, respond with:

1. The branch name
2. The PR URL (from `gh pr create` output)
3. A one-sentence preview of the **next** step in the plan, so the user can decide whether to proceed after merging

**Do not merge the PR.** The user reviews and approves manually.

**Do not check out `main` after pushing.** Stay on the feature branch — the next invocation of this skill will switch back to `main` after the user confirms the previous PR is merged.

## Edge cases

- **Working tree dirty on entry:** Stop and ask the user. Could be in-progress work from a previous session.
- **Already on a feature branch:** Stop and ask. The previous step may not be merged yet.
- **Build/lint fails after the work:** Fix the issue, then commit. Don't push a broken branch.
- **Step touches files outside `atelier-api/`:** That's a planning bug — flag it to the user. The plan should be scoped to one repo per step.
- **`git push` rejected:** Investigate. Don't `--force` without the user's say-so.
