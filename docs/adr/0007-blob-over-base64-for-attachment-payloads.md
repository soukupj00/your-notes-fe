# 0007 - Blob over base64 for attachment payloads

- Status: Accepted
- Date: 2026-07-21

## Context

M3 introduces attachments (starting with inline images - see [PLAN.md](../../PLAN.md) M3 Slice 1).
Attachment bytes must be stored in the local IndexedDB store ([ADR 0001](./0001-local-first-storage-with-dexie.md)).
[ADR 0004](./0004-canonical-editor-toolbar-pattern.md) keeps the editor at the center of the product, and M3 renders images **inline in the Note body**: the body HTML holds only a lightweight attachment **id**, not the bytes, and a TipTap node resolves that id to the payload at render time.

That leaves one open question deferred from ADR 0001: in what physical form do we store the payload itself - a native `Blob`, or a base64-encoded string?

The decision touches the schema and every attachment read and write, so it is expensive to reverse and worth recording.

## Decision

Store attachment payloads as native **`Blob`s** in IndexedDB, not base64 strings.

- The picker/paste/drop hands us a `File` (a `Blob`); we persist it directly, with no encoding step.
- Rendering uses `URL.createObjectURL(blob)` to produce a short-lived `blob:` URL for an `<img>` (revoked when the node unmounts).
- If and when M5 sync needs a JSON/wire-friendly form, we encode to base64 (or use multipart) **at the sync boundary only** - the local store stays Blob-native.

## Consequences

- **Smaller + faster locally.** No ~33% base64 size tax, and no `FileReader` encode on every write. IndexedDB stores Blobs natively via structured clone, and `createObjectURL` wants a Blob anyway.
- **Object-URL lifecycle to manage.** Each `createObjectURL` must be paired with `revokeObjectURL` (on node/component unmount) to avoid per-session memory leaks. This discipline lives in the image NodeView / render components.
- **Sync serialization is deferred, not free.** M5 must convert Blob → base64/multipart at the wire boundary. Accepted: that is a boundary concern for a milestone two steps away, and should not tax local storage now.
- **Body stays light.** Because the body references an id (never a `data:` URI), autosave keeps serializing small strings even for image-heavy notes.

## Alternatives considered

- **base64 strings in the payload field.** Rejected: pays a 33% storage tax and an encode-per-write cost now, to simplify an M5 sync format we can just as easily produce at the boundary later.
- **base64 `data:` URI inline in the body HTML (TipTap's default Image behavior).** Rejected outright: bloats `Note.body`, and re-parses/re-serializes multi-megabyte strings on every editor load and every debounced autosave. This is the anti-pattern the id-reference scheme exists to avoid.
