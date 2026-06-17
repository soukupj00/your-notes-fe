# 0002 — Separate frontend and backend repositories

- Status: Accepted
- Date: 2026-06-15

## Context

The project has two deliverables: this React SPA/PWA and a self-hosted REST/HATEOAS sync server. They have different runtimes, deploy targets, and release cadences. Self-hosters need to run the backend (via Docker Compose) without necessarily touching the frontend.

## Decision

Keep the frontend and backend in **two separate git repositories**. This repo is frontend-only. The backend's API contract is referenced but not designed here; the frontend plans only the **client side** of sync (API client, caching, offline mutation queue, conflict resolution).

## Consequences

- Independent versioning and deployment; self-hosters can run the backend image without the frontend source.
- The REST/HATEOAS contract is a shared boundary that must be coordinated across repos; a contract change touches both.
- This repo's PLAN/ADRs deliberately stop at the network boundary — endpoint/link-relation design lives in the backend repo.
- Local end-to-end testing of sync requires both repos (or a mock server) running together.
