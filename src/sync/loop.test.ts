import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalRemote } from '@/data/http/HalRemote.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import type { Note } from '@/models.ts';
import { createFakeServer, type FakeServer } from '@/test/fakeServer.ts';
import { createSyncEngine, type SyncReport } from './engine.ts';
import { type SyncLoop, type SyncStatus, startSyncLoop } from './loop.ts';

const T0 = '2026-01-01T00:00:00.000Z';
const note = (header: string): Note => ({
  id: crypto.randomUUID(),
  header,
  state: 'active',
  createdAt: T0,
  updatedAt: T0,
});

async function until(check: () => boolean, label = 'condition') {
  const deadline = Date.now() + 2000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const loops: SyncLoop[] = [];
afterEach(() => {
  for (const loop of loops.splice(0)) void loop.stop();
  vi.restoreAllMocks();
});

async function device(server: FakeServer, accountId: string, pollMs = 60_000) {
  const client = server.client();
  const hal = createHalClient(client.fetch);
  await createHalAccountService(hal).signIn('ada', 'correct horse', 'Phone');
  const store = createMemoryLocalStore();
  const remote = { ...createHalRemote(hal), hints: client.hints };
  const engine = createSyncEngine({ store, remote, deviceName: () => 'Phone' });
  await engine.adopt(accountId);
  let runs = 0;
  const sync = engine.sync;
  engine.sync = () => {
    runs += 1;
    return sync();
  };
  const statuses: SyncStatus[] = [];
  const reports: SyncReport[] = [];
  const loop = startSyncLoop({
    engine,
    remote,
    store,
    pollMs,
    editDelayMs: 10,
    onStatus: (s) => statuses.push(s),
    onReport: (r) => reports.push(r),
  });
  loops.push(loop);
  await until(() => statuses.at(-1) === 'idle', 'the first run');
  return { store, loop, statuses, reports, runs: () => runs };
}

describe('sync loop', () => {
  it('syncs once at start, then when a hint says another Device pushed', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    const a = await device(server, owner.id);
    const b = await device(server, owner.id);
    expect(a.runs()).toBe(1);

    const n = note('From A');
    await a.store.notes.add(n);
    await until(() => server.sync.row(owner.id, 'note', n.id) !== undefined, 'the push');
    await until(() => b.runs() >= 2, 'the hint');
    await until(() => b.statuses.at(-1) === 'idle', 'B idle');
    expect(await b.store.notes.get(n.id)).toEqual(n);
  });

  it('pushes a local edit shortly after it, without waiting for the poll', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    const a = await device(server, owner.id);
    const n = note('Typed');
    await a.store.notes.add(n);
    await until(() => server.sync.row(owner.id, 'note', n.id) !== undefined, 'the push');
    expect(a.runs()).toBe(2);
  });

  it('catches up when the browser comes online and when the page becomes visible', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    const a = await device(server, owner.id);

    window.dispatchEvent(new Event('online'));
    await until(() => a.runs() === 2, 'online');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await until(() => a.runs() === 3, 'visible');
  });

  it('polls while no hint comes', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    const a = await device(server, owner.id, 30);
    await until(() => a.runs() >= 3, 'two polls');
  });

  it('says offline without asking the server while the browser is offline', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    const a = await device(server, owner.id);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await a.loop.syncNow();
    expect(a.statuses.at(-1)).toBe('offline');
    expect(a.runs()).toBe(1);
  });

  it('an unreachable server is offline, a broken answer is an error', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    const a = await device(server, owner.id);

    server.state.offline = true;
    await a.loop.syncNow();
    expect(a.statuses.at(-1)).toBe('offline');
    server.state.offline = false;
    server.state.staticHost = true;
    await a.loop.syncNow();
    expect(a.statuses.at(-1)).toBe('error');
  });

  it('hands each run its report, and stops for good', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    const a = await device(server, owner.id, 30);
    expect(a.reports[0]).toEqual({ conflicts: 0, keptNewer: 0 });

    await a.loop.stop();
    const after = a.runs();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(a.runs()).toBe(after);
  });
});
