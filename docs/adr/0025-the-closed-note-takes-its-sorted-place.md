# 0025 - The closed Note takes its sorted place

- Status: Accepted (amends [ADR 0012](./0012-feed-rank-is-held-membership-is-live.md))
- Date: 2026-10-21

## Context

ADR 0012 holds every card's place until the user looks away, so on "last edited" an edited Note stayed where it was until a reload.
In the first user test this read as a bug: the tester expected the Note just edited to move up, and saw a label change reorder the wall at once (a search-param change) while an edit did not.
Closing the editor is the moment the user has finished with that Note, and the motion lands on the card they were just working on.

## Decision

**When the editor closes, the Note that was open, and only it, leaves the held rank and takes the place the sort gives it.**

- Every other card keeps its held place, so the wall does not re-order behind cards the user did not touch.
- The Note is released until the feed's first update after the close, because the close's last write can land after the URL already says the editor is shut.
- Opening a Note and closing it without an edit writes nothing, so a Note only read stays where it was.

Everything else in ADR 0012 stands.

## Considered options

- **Re-take the whole order on close.**
  Rejected: cards recoloured or ticked earlier would jump too, which is the spatial surprise ADR 0012 exists to prevent.
- **Move the Note after a short delay.**
  Rejected: the existing spring already shows the move, and a delay only makes the wall shift when the user has moved on.

## Consequences

- The edited Note's card moves on close; on a sort other than "last edited" it moves only if the edit changed its sort key.
- A read no longer bumps `updatedAt`, which also stops it syncing as a change.
