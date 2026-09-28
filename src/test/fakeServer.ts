import type { z } from 'zod';
import {
  AccountsResponse,
  ChangesPage,
  CodeResponse,
  DevicesResponse,
  PushResponse,
  RootResponse,
  SessionResponse,
  SetupStatus,
} from '@/contract/index.ts';
import type { PushBatch } from '@/data/Remote.ts';
import { createFakeSync } from './fakeSync.ts';

type Role = 'owner' | 'member';
type Account = { id: string; username: string; password: string; role: Role };
type Code = { kind: 'setup' | 'device' | 'invite'; accountId: string | null; used: boolean };
type Device = { id: string; accountId: string; name: string; at: string };
type Jar = { cookie: string | null };

const AT = '2026-09-28T10:00:00.000Z';
const link = (href: string) => ({ href });

/**
 * A Self-hosted Server in memory, behind a `fetch`, for tests of the HAL
 * adapters and the screens on top of them. Every body it answers is parsed by
 * the vendored contract first, so it drifts from the backend no more than the
 * contract does. `fetch` is one browser; `client()` opens another, with its own
 * cookie, so two Devices can sync against one server in a test.
 */
export function createFakeServer({ setupCode = 'setup-code' } = {}) {
  const accounts: Account[] = [];
  const codes = new Map<string, Code>([
    [setupCode, { kind: 'setup', accountId: null, used: false }],
  ]);
  const devices: Device[] = [];
  const blobs = new Map<string, Uint8Array<ArrayBuffer>>();
  const sync = createFakeSync();
  let minted = 0;

  const state = {
    pushed: [] as PushBatch[],
    /** Every request answers this network failure (an unreachable server). */
    offline: false,
    /** Every request answers the SPA's `index.html` (a static host with no server). */
    staticHost: false,
    /** The backend's `BLOB_LIMIT_BYTES`: a larger PUT answers 413. */
    blobLimit: 50 * 1024 * 1024,
    /** Every blob request, as `PUT <id>`, `GET <id>` or `HEAD <id>`. */
    blobRequests: [] as string[],
  };

  const reply = <S extends z.ZodType>(schema: S, body: z.input<S>, status = 200) =>
    new Response(JSON.stringify(schema.parse(body)), {
      status,
      headers: { 'content-type': 'application/hal+json' },
    });
  const problem = (status: number, title: string) =>
    new Response(JSON.stringify({ type: 'about:blank', title, status }), {
      status,
      headers: { 'content-type': 'application/problem+json' },
    });
  const empty = (status = 204) => new Response(null, { status });

  const ownerExists = () => accounts.some((a) => a.role === 'owner');
  const signedIn = (cookie: string | null) => {
    const device = devices.find((d) => d.id === cookie);
    const account = device && accounts.find((a) => a.id === device.accountId);
    return device && account ? { device, account } : null;
  };
  function spend(code: string, kind: Code['kind']) {
    const found = codes.get(code);
    if (!found || found.used || found.kind !== kind) return null;
    found.used = true;
    return found;
  }
  function open(jar: Jar, account: Account, name: string) {
    const device = { id: crypto.randomUUID(), accountId: account.id, name, at: AT };
    devices.push(device);
    jar.cookie = device.id;
    return sessionBody(account, device, 201);
  }
  function sessionBody(account: Account, device: Device, status = 200) {
    return reply(
      SessionResponse,
      {
        account: { id: account.id, username: account.username, role: account.role },
        device: { id: device.id, name: device.name },
        _links: {
          self: link('/api/session'),
          devices: link('/api/devices'),
          codes: link('/api/codes'),
          changes: link('/api/changes'),
          blobs: { href: '/api/blobs/{id}', templated: true },
          shares: link('/api/shares'),
        },
      },
      status
    );
  }
  function createAccount(username: string, password: string, role: Role) {
    const account = { id: crypto.randomUUID(), username, password, role };
    accounts.push(account);
    return account;
  }

  async function handle(
    jar: Jar,
    method: string,
    path: string,
    query: URLSearchParams,
    init?: RequestInit
  ) {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const me = signedIn(jar.cookie);

    if (method === 'GET' && path === '/api') {
      return reply(RootResponse, {
        _links: {
          self: link('/api'),
          health: link('/health'),
          docs: link('/api/docs'),
          openapi: link('/api/docs/json'),
          ...(ownerExists() ? {} : { setup: link('/api/setup') }),
          session: link('/api/session'),
          devices: link('/api/devices'),
          codes: link('/api/codes'),
          accounts: link('/api/accounts'),
          changes: link('/api/changes'),
          stream: link('/api/changes/stream'),
          blobs: { href: '/api/blobs/{id}', templated: true },
          shares: link('/api/shares'),
        },
      });
    }
    if (path === '/api/setup') {
      if (ownerExists()) return problem(404, 'This server already has an Owner');
      if (method === 'GET') {
        return reply(SetupStatus, { needsSetup: true, _links: { self: link('/api/setup') } });
      }
      if (!spend(body.code, 'setup')) return problem(401, 'Wrong username, password or code');
      return open(jar, createAccount(body.username, body.password, 'owner'), body.deviceName);
    }
    if (path === '/api/session' && method === 'POST') {
      let account: Account | undefined;
      if ('password' in body) {
        account = accounts.find(
          (a) => a.username === body.username && a.password === body.password
        );
      } else {
        const spent = spend(body.code, 'device');
        account = spent ? accounts.find((a) => a.id === spent.accountId) : undefined;
      }
      if (!account) return problem(401, 'Wrong username, password or code');
      return open(jar, account, body.deviceName);
    }
    if (path === '/api/accounts' && method === 'POST') {
      if (codes.get(body.code)?.kind !== 'invite') {
        return problem(401, 'Wrong username, password or code');
      }
      if (accounts.some((a) => a.username === body.username)) {
        return problem(409, 'That username is taken');
      }
      spend(body.code, 'invite');
      return open(jar, createAccount(body.username, body.password, 'member'), body.deviceName);
    }

    if (!me) return problem(401, 'Sign in first');

    if (path === '/api/session') {
      if (method === 'GET') return sessionBody(me.account, me.device);
      jar.cookie = null;
      devices.splice(devices.indexOf(me.device), 1);
      return empty();
    }
    if (path === '/api/devices' && method === 'GET') {
      return reply(DevicesResponse, {
        _links: { self: link('/api/devices') },
        _embedded: {
          devices: devices
            .filter((d) => d.accountId === me.account.id)
            .map((d) => ({
              id: d.id,
              name: d.name,
              createdAt: d.at,
              lastSeenAt: d.at,
              current: d.id === me.device.id,
              _links: { self: link(`/api/devices/${d.id}`) },
            })),
        },
      });
    }
    const deviceMatch = path.match(/^\/api\/devices\/(.+)$/);
    if (deviceMatch && method === 'DELETE') {
      const i = devices.findIndex((d) => d.id === deviceMatch[1] && d.accountId === me.account.id);
      if (i < 0) return problem(404, 'No such Device');
      devices.splice(i, 1);
      return empty();
    }
    if (path === '/api/codes' && method === 'POST') {
      if (body.kind === 'invite' && me.account.role !== 'owner') {
        return problem(403, 'Only the Owner can invite');
      }
      const code = `${body.kind}-code-${++minted}`;
      codes.set(code, { kind: body.kind, accountId: me.account.id, used: false });
      return reply(CodeResponse, { code, kind: body.kind, expiresAt: AT }, 201);
    }
    if (path === '/api/accounts' && method === 'GET') {
      if (me.account.role !== 'owner') return problem(403, 'Only the Owner can do that');
      return reply(AccountsResponse, {
        _links: { self: link('/api/accounts') },
        _embedded: {
          accounts: accounts.map((a) => ({
            id: a.id,
            username: a.username,
            role: a.role,
            createdAt: AT,
            _links: {
              self: link(`/api/accounts/${a.id}`),
              password: link(`/api/accounts/${a.id}/password`),
            },
          })),
        },
      });
    }
    const passwordMatch = path.match(/^\/api\/accounts\/(.+)\/password$/);
    if (passwordMatch && method === 'PUT') {
      if (me.account.role !== 'owner') return problem(403, 'Only the Owner can do that');
      const account = accounts.find((a) => a.id === passwordMatch[1]);
      if (!account) return problem(404, 'No such Account');
      account.password = body.password;
      return empty();
    }
    if (path === '/api/changes' && method === 'POST') {
      const batch = body as PushBatch;
      state.pushed.push(batch);
      return reply(PushResponse, sync.push(me.account.id, me.device.id, batch));
    }
    if (path === '/api/changes' && method === 'GET') {
      const from = query.get('from');
      const page = sync.pull(
        me.account.id,
        Number(query.get('since') ?? 0),
        from === null ? undefined : Number(from)
      );
      if (!page) return problem(410, 'Resync from the start');
      return reply(ChangesPage, page);
    }
    const blobMatch = path.match(/^\/api\/blobs\/(.+)$/);
    if (blobMatch) {
      const id = decodeURIComponent(blobMatch[1]!);
      state.blobRequests.push(`${method} ${id}`);
      // The backend's order (`routes/blobs.ts`): size, then type, then a repeat is 204 unread.
      if (method === 'PUT') {
        const sent = init?.body as Blob;
        if (sent.size > state.blobLimit) return problem(413, 'Too large');
        if (!new Headers(init?.headers).get('content-type')) {
          return problem(400, 'Send the Content-Type of the bytes');
        }
        if (blobs.has(id)) return empty(204);
        // Bytes, not the Blob: jsdom's Blob does not survive being a Response body.
        blobs.set(id, new Uint8Array(await sent.arrayBuffer()));
        return empty(201);
      }
      const bytes = blobs.get(id);
      if (!bytes) return problem(404, 'No such blob');
      return new Response(method === 'HEAD' ? null : bytes, { status: 200 });
    }
    return problem(404, `No route for ${method} ${path}`);
  }

  /** One browser: its own cookie, its `fetch`, and its Live Update stream. */
  function client() {
    const jar: Jar = { cookie: null };
    const fetch: typeof globalThis.fetch = async (input, init) => {
      if (state.offline) throw new TypeError('Failed to fetch');
      if (state.staticHost) {
        return new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
      }
      const url = new URL(String(input), 'http://localhost');
      return handle(jar, init?.method ?? 'GET', url.pathname, url.searchParams, init);
    };
    /** What `EventSource` on the stream link would deliver to this signed-in browser. */
    const hints = (onHint: (seq: number) => void) => {
      const me = signedIn(jar.cookie);
      return me ? sync.subscribe(me.account.id, me.device.id, onHint) : () => false;
    };
    return { fetch, hints };
  }

  return {
    fetch: client().fetch,
    client,
    sync,
    state,
    accounts,
    devices,
    blobs,
    /** Mints a code as if a signed-in Device (or the Owner, for an Invite) had shown one. */
    mintCode(kind: 'device' | 'invite', accountId: string) {
      const code = `${kind}-code-${++minted}`;
      codes.set(code, { kind, accountId, used: false });
      return code;
    },
    /** An Owner with one other Device signed in, as the server looks after setup elsewhere. */
    seedOwner(username = 'ada', password = 'correct horse') {
      codes.get(setupCode)!.used = true;
      const owner = createAccount(username, password, 'owner');
      devices.push({ id: crypto.randomUUID(), accountId: owner.id, name: 'Laptop', at: AT });
      return owner;
    },
    seedMember(username = 'bob', password = 'battery staple') {
      return createAccount(username, password, 'member');
    },
  };
}

export type FakeServer = ReturnType<typeof createFakeServer>;
