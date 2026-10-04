# 0022 - OOP by interfaces and closure factories, never by classes

- Status: Accepted
- Date: 2026-10-02

## Context

A refactoring pass asked whether OOP principles and patterns (interfaces, factories, adapters, decorators, strategies) would make the frontend easier to change, understand and keep free of copies.
Four surveys of the code found the repetition concentrated in a few places (the sync half of the two Local Stores, attachment insertion and node views, eleven near-identical editor extensions, the editor dialog's saving logic, entity rows built inline) and found that the codebase already practises OOP in one particular style.
Its seams are TypeScript interfaces with closure factories behind them: `LocalStore` has two implementations under one contract suite ([ADR 0020](./0020-the-local-store-seam.md)), `TourStage` has two, `createAttachmentNode` has five products, `createSyncEngine` and `createHalClient` are closures over their dependencies.
There are 121 interfaces and five classes, three of them `Error` subtypes and the other two forced by Dexie and React.
The question was whether "introduce OOP" meant applying that style's principles where the copies are, or moving the refactored areas to classes, inheritance and decorators.

## Decision

**The patterns are applied in the existing style. No classes, inheritance or decorators are introduced.**

- An interface is the contract and a closure factory (`createX(deps)`) is the implementation.
- A strategy is a `Record<Kind, …>` table keyed by a domain kind, not a class per kind.
- A template is a helper function that takes the varying part as an argument (`withButton(Upstream, ctx => props)`), not a base class with abstract methods.
- Shared algorithms over two implementations are pure functions that decide, with each implementation reading before and writing after, not a base class the implementations extend.
- A stateful thing with identity and a lifecycle (the sync engine, the editor's Draft, the Tour's run) is a closure that returns a small object of functions, as `createSyncEngine` already is.
- `class` stays reserved for what a library requires: an `Error` subtype, Dexie's `Dexie` subclass, React's error boundary.
- An abstraction has to earn its place with a second real implementation or at least three call sites.
  An interface with one implementation, or a factory for one product, is a smell a reader should question.

## Consequences

- The ten simple editor extensions become declarations through one helper, in one file, and their tests become one table-driven test.
- The Dexie and memory stores will share their sync algorithms through decide-functions in `syncRows.ts`, which keeps the memory store atomic by being synchronous and keeps Dexie's work inside its transaction.
- A reader who knows the style of any one seam knows them all; there is no second dialect to learn.
- The folder rule changes: a folder is for an extension that has more than its declaration (a node view, a coordinator, its own behaviour test), and a one-line declaration lives beside its siblings.

## Alternatives considered

**TypeScript classes with inheritance** for the extensions (a base `MarkButtonExtension`), the Local Stores (an abstract `BaseLocalStore`) and the Draft.
Rejected: React hooks and TipTap's `.extend()` are function-shaped, so a class would wrap a function in every case; a base store class would couple a `Map` store to Dexie's transaction shape; and the result would split every area into two dialects.

**TypeScript decorators** for cross-cutting wrappers (retry on the Remote, toast on a remote action).
Rejected: they are not enabled in `tsconfig`, they are not idiomatic in this stack, and the two candidates already have a smaller answer (the loop's back-off is the retry; a remote-action helper is a function).
