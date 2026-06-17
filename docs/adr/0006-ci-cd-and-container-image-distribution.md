# 0006 — GitLab CI/CD and container-image distribution

- Status: Accepted
- Date: 2026-06-15

## Context

`.gitlab-ci.yml` currently only includes GitLab's `Security/SAST` and `Security/Secret-Detection` templates — there is no build, lint, test, or release automation. The app is a self-hosted PWA: end users run it on their own network ([ADR 0002](./0002-separate-frontend-backend-repositories.md)) and the repo already ships a multi-stage `Dockerfile` (build → nginx) plus a `docker-compose.yml`. We need a pipeline that enforces quality and delivers a runnable artifact to self-hosters.

## Decision

Build out the GitLab pipeline, keeping the existing security templates, with stages **`quality → test → build → publish`** (plus the existing `secret-detection`):

- **quality** — `biome ci .` ([ADR 0005](./0005-biome-replaces-eslint-prettier.md)) + `tsc` typecheck; pnpm store cached; pnpm via `corepack` pinned by `packageManager`.
- **test** — Vitest unit/component/data tests and Playwright E2E (enabled as the M1 test suites land; see root `PLAN.md`).
- **build** — `pnpm build`, publishing `dist/` as an artifact.
- **publish** — build the existing `Dockerfile` with **Kaniko** and push to the **GitLab Container Registry** (`$CI_REGISTRY_IMAGE`), tagged with the commit SHA, plus `latest` on the default branch and the git tag on releases. Restricted by `rules` to the default branch and tags.

Distribution to self-hosters is the **published container image**: they `docker pull` / compose against the registry image rather than building from source.

## Consequences

- Quality gates run on every pipeline; releases produce a versioned, runnable image.
- **Kaniko** builds images without a privileged Docker-in-Docker runner, fitting shared GitLab runners.
- Self-hosters need access to the registry image (public project or provided credentials); those who prefer to build from source still can via the `Dockerfile` — the image is the recommended path, not the only one.
- **Trade-off:** image-based distribution adds a registry dependency and image-tagging discipline, but spares users a Node/pnpm build toolchain — appropriate for a "self-hostable by non-programmers" goal.
- Requires the Container Registry enabled on the GitLab project; release tagging convention must be defined when versioning starts.
