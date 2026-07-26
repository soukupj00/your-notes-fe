# M0 Slice 1 - Tooling & CI/CD

**Status:** retroactive record of shipped work.
This slice landed in commit `c3b4727` ("[ADD] Biomejs, CI/CD, Docker, project docs, plans and ADRs, fix dependencies") but was never written up as a plan at the time.
The date in the filename is provisional - adjust to match the team's actual records if it differs.

**Goal:** Give the project automatic, hands-off lint/format enforcement and a real CI/CD pipeline that produces a self-hostable container image, before feature work resumes in M1.

## Context

Before this slice, `.gitlab-ci.yml` only included GitLab's SAST and Secret-Detection templates - no lint, typecheck, test, build, or publish automation.
Linting/formatting was ESLint 9 (flat config) + Prettier, but the pre-commit hook only ran `prettier --write`, so lint issues (including unenforced `eslint-plugin-react-hooks` rules) were never actually caught on commit.
Two decisions were made to fix this: adopt Biome as a single lint+format tool ([ADR 0005](../../adr/0005-biome-replaces-eslint-prettier.md)), and build out the GitLab pipeline with a `quality -> test -> build -> publish` stage sequence targeting a Docker image as the distribution artifact ([ADR 0006](../../adr/0006-ci-cd-and-container-image-distribution.md)).

## Tasks

### Task 1 - Adopt Biome, replacing ESLint + Prettier
- [x] Added `biome.json`: recommended rule preset, `organizeImports` via the `assist` block, formatter (single quotes, trailing commas, `lineWidth: 100`), and nursery `useSortedClasses` configured for `className` plus the `cn`/`clsx`/`cva`/`tw` helpers.
- [x] Removed `eslint.config.ts`.
- [x] Added scripts to `package.json`: `check` (`biome check --write .`), `check:ci` (`biome ci .`), `format` (`biome format --write .`); dropped the old `lint` script.
- [x] Repointed `lint-staged` (in `package.json`) to `biome check --write --no-errors-on-unmatched` for `*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,json,jsonc}`. Husky's `.husky/pre-commit` (`pnpm exec lint-staged`) was kept as-is.
- [x] `eslint`/`prettier`/`eslint-plugin-*` dependency entries are gone from `package.json`.

**Discrepancy found:** `.prettierrc` (with the `prettier-plugin-tailwindcss` plugin entry) was still present in the repo root. ADR 0005 and `PLAN.md` both say Prettier configs were removed; the file was evidently missed. It was inert (no `prettier` dependency remained and nothing invoked it). **Resolved 2026-07-25:** `.prettierrc` and `.prettierignore` removed from the repo.

### Task 2 - Pin the toolchain
- [x] Added `.nvmrc` and `packageManager: "pnpm@10.12.1"` to `package.json`.
- [x] `Dockerfile`'s build stage runs `corepack enable` + `pnpm install --frozen-lockfile` (no more global `npm i -g pnpm`).

**Discrepancy found:** `PLAN.md`'s M0 section says "Node 20 (`.nvmrc`)", but the shipped `.nvmrc` pins **Node 22**, and both the `Dockerfile` build stage and the `.gitlab-ci.yml` pnpm-setup image use `node:22-alpine`. The pipeline is internally consistent on Node 22 - it was the `PLAN.md` prose that was stale. **Resolved 2026-07-25:** `PLAN.md` corrected to say Node 22.

### Task 3 - GitLab pipeline: quality stage
- [x] `.gitlab-ci.yml` defines stages `quality -> test -> build -> publish -> secret-detection`, keeping the `Security/SAST` and `Security/Secret-Detection` includes (`sast` and `secret_detection` jobs pinned to the `quality`/`secret-detection` stages respectively).
- [x] Shared `.pnpm-setup` anchor: `node:22-alpine` image, `corepack enable`, `pnpm config set store-dir "$PNPM_STORE_PATH"`, `pnpm install --frozen-lockfile`, with the pnpm store cached by `pnpm-lock.yaml` hash.
- [x] `lint` job runs `pnpm check:ci` (Biome's non-mutating CI gate).
- [x] `typecheck` job runs `pnpm exec tsc -b --noEmit`.
- Both `quality` jobs run on merge-request pipelines and on branch pipelines.

### Task 4 - GitLab pipeline: test, build, publish stages
- [x] `test:unit` runs `pnpm test --run` (Vitest); `test:e2e` runs `pnpm test:e2e` against the `mcr.microsoft.com/playwright` image. Both are wired with `allow_failure: true` on MR and branch pipelines, matching the plan's "enabled as M1 suites land" intent (Vitest suites now exist per M1; the Playwright script/suite itself is still not added to the repo, so `test:e2e` will fail until that lands).
- [x] `build` runs `pnpm build`, publishing `dist/` as a job artifact (`expire_in: 1 week`), restricted to the default branch and tags.
- [x] `publish:image` uses the Kaniko executor (`gcr.io/kaniko-project/executor:v1.23.2-debug`) to build the existing `Dockerfile` and push to `$CI_REGISTRY_IMAGE` tagged with `$CI_COMMIT_SHORT_SHA` and `latest`; restricted to the default branch and tags, `needs: [build]`. A tag-triggered extra destination variable (`EXTRA_DESTINATION`) is set for tag builds and, since **2026-07-25**, is appended to the executor command (with an empty job-level default for non-tag builds), so tagged releases now push the `${CI_REGISTRY_IMAGE}:${CI_COMMIT_TAG}` image described in ADR 0006. (It was previously defined but never consumed - a real gap that meant tag releases pushed only `:<sha>` and `:latest`.)

### Task 5 - Project documentation scaffold
- [x] Added `CONTEXT.md` (domain glossary), `PLAN.md` (roadmap), `docs/adr/0001` through `0006`, and `INSTRUCTIONS.md` in the same commit, establishing the documentation structure referenced by the project's `CLAUDE.md`.

## Verification

- `pnpm check:ci` (Biome CI gate) and `pnpm exec tsc -b --noEmit` are wired as the `quality` stage and gate every MR/branch pipeline.
- `pnpm build` is wired as the `build` stage, gated to default branch and tags.
- Local pre-commit (`husky` + `lint-staged`) applies safe Biome fixes and blocks on the rest, verified by the hook running `pnpm exec lint-staged` on every commit since this slice landed.
- No dedicated test suite for the CI/CD config itself (pipeline YAML isn't something this project unit-tests); correctness was verified by the pipeline running on GitLab post-merge.
