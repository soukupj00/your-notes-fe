import { ChangesPage, PushResponse, SessionResponse } from '@/contract/index.ts';

import type { Remote } from '../Remote.ts';
import { type HalClient, ProblemError } from './hal.ts';

/** `Remote` over the Self-hosted Server's HAL API: replication only, `SyncProvider` runs the loop. */
export function createHalRemote(hal: HalClient): Remote {
  return {
    async identity() {
      const body = await hal.json(SessionResponse, await hal.link('session'));
      return body.account.id;
    },
    async push(batch) {
      const body = await hal.json(PushResponse, await hal.link('changes'), {
        method: 'POST',
        body: batch,
      });
      return body.outcomes;
    },
    async pull(cursor) {
      try {
        // The cursor is the `next` URL the server handed out; the first page is the bare link.
        const page = await hal.json(ChangesPage, cursor ?? (await hal.link('changes')));
        const { notes, tags, noteTags, tombstones } = page;
        return {
          status: 'ok',
          notes,
          tags,
          noteTags,
          tombstones,
          next: page._links.next?.href ?? null,
          self: page._links.self.href,
          resume: page._links.resume.href,
          seq: page.seq,
        };
      } catch (error) {
        // Older than the tombstone window, or ahead of a restored server: resync from 0.
        if (error instanceof ProblemError && error.status === 410) {
          return { status: 'cursor-too-old' };
        }
        throw error;
      }
    },
    hints(onHint) {
      // The browser keeps the stream open, reconnects after a drop and sends
      // `Last-Event-ID` itself; the poll in `src/sync/loop.ts` covers a stream
      // that stays down.
      let source: EventSource | null = null;
      let stopped = false;
      hal
        .link('stream')
        .then((url) => {
          if (stopped || typeof EventSource === 'undefined') return;
          source = new EventSource(url);
          source.addEventListener('change', (event) => {
            const seq = Number((event as MessageEvent).lastEventId);
            if (Number.isInteger(seq)) onHint(seq);
          });
        })
        .catch(() => {});
      return () => {
        stopped = true;
        source?.close();
      };
    },
    async putBlob(id, blob) {
      // 201 stored, 204 already there: bytes are write-once by id, so both are success.
      try {
        await hal.send(await hal.link('blobs', { id }), {
          method: 'PUT',
          headers: { 'content-type': blob.type || 'application/octet-stream' },
          body: blob,
        });
        return 'stored';
      } catch (error) {
        if (error instanceof ProblemError && error.status === 413) return 'too-large';
        throw error;
      }
    },
    async getBlob(id) {
      try {
        return await (await hal.send(await hal.link('blobs', { id }))).blob();
      } catch (error) {
        if (error instanceof ProblemError && error.status === 404) return undefined;
        throw error;
      }
    },
  };
}
