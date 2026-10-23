# 0027 - Label order is a synced fractional position

- Status: Accepted
- Date: 2026-10-22

## Context

Labels had no order.
Every read listed them in primary-key order, and ids are random, so the sidebar, the filter pills, the label picker and the pills on a card looked shuffled.
The first user test asked for an order of their own by drag and drop, plus sorting by name and by date.
Apps that fix labels to A to Z push people into prefixing names with "1-" or an emoji to get the order they want, so a fixed sort alone is not enough.

## Decision

**A Tag carries an optional synced `position`, a fractional-index key, and one comparator orders labels everywhere.**

- `lib/label-order.ts` is the order: labels with a position first, by key in code-unit order and then by id; the rest A to Z by the app language's collation (`Intl.Collator`, numeric).
  `useTags` and `TagPills` sort through it, so every list of labels agrees.
- While no label has a position the list is A to Z, and a new or renamed label simply lands in its alphabetical place.
- The first drag gives every label a position in the order on screen, in one write; a later drag writes only the moved label, with a key between its new neighbours (`fractional-indexing`).
- A new label in a custom order gets a key before the first label whose name sorts after it, so an order that is still alphabetical stays alphabetical.
- Arrange (A to Z, Z to A, newest first, oldest first) rewrites every position once and offers Undo, which puts back the previous positions, none included.
- There is no sort preference and no sort mode: there is one order, and it is the one on screen.
- On the wire an absent `position` keeps the server's and `null` clears it, so a client from before this change never erases an order when it renames a label.
  Locally a cleared position is kept as `null` until it is pushed, and every reader treats `null` like no position.

## Considered options

- **A to Z only.**
  Rejected: it is the order that drives people to prefix names.
- **A sort preference (name, date, custom).**
  Rejected: a preference is one more thing to explain, and the order would differ between the sidebar and the Labels page whenever it was not "custom".
- **An integer index per label.**
  Rejected: a drag would rewrite every label after the moved one, and two devices dragging at once would collide on every row.
- **A Device preference instead of a synced field.**
  Rejected: the order is the user's data, and it should be the same on every device.

## Consequences

- A drag writes one row; the first drag and an Arrange write every label in one transaction.
- The server contract gains the field, so the backend ships first; a frontend deployed against an older server would see the field silently dropped.
- Concurrent drags resolve per row like every Tag edit; two labels that end up with the same key keep a stable order by id, and the next drag between them re-keys the list.
- There is no rebalancing: a key outgrows the server's 1024-character limit only after about a thousand drops into the same gap.
- A to Z follows each device's app language, so two devices in different languages can show a never-dragged list differently; after the first drag or an Arrange every device shows the same order.
