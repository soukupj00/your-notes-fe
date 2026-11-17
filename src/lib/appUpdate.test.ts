import { describe, expect, it, vi } from 'vitest';
import { createAppUpdate } from './appUpdate.ts';

type Fake<T> = { -readonly [K in keyof T]: T[K] };

function fakeWorker(state: ServiceWorkerState) {
  const worker = Object.assign(new EventTarget(), { state, postMessage: vi.fn() });
  const become = (next: ServiceWorkerState) => {
    worker.state = next;
    worker.dispatchEvent(new Event('statechange'));
  };
  return { worker: worker as unknown as ServiceWorker, become };
}

function fakeServiceWorkers({ registered = true } = {}) {
  const registration: Partial<Fake<ServiceWorkerRegistration>> = {
    waiting: null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
  };
  const container = Object.assign(new EventTarget(), {
    controller: null as ServiceWorker | null,
    getRegistration: vi.fn().mockResolvedValue(registered ? registration : undefined),
  });
  const takeOver = () => container.dispatchEvent(new Event('controllerchange'));
  const reload = vi.fn();
  const update = createAppUpdate(container as unknown as ServiceWorkerContainer, reload);
  return { registration, container, takeOver, reload, update };
}

const SKIP_WAITING = { type: 'SKIP_WAITING' };

describe('reloadOnTakeover', () => {
  it('reloads once a newer worker takes over the tab, whichever tab accepted it', () => {
    const { takeOver, reload, update } = fakeServiceWorkers();

    update.reloadOnTakeover();
    expect(reload).not.toHaveBeenCalled();

    takeOver();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads only once, however often it is armed or the controller changes', () => {
    const { takeOver, reload, update } = fakeServiceWorkers();

    update.reloadOnTakeover();
    update.reloadOnTakeover();
    takeOver();
    takeOver();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('never reloads on a takeover it was not armed for, such as the first install claiming the tab', () => {
    const { takeOver, reload } = fakeServiceWorkers();

    takeOver();

    expect(reload).not.toHaveBeenCalled();
  });
});

describe('reloadIntoLatest', () => {
  it('activates a waiting worker and reloads once it controls the tab', async () => {
    const { registration, takeOver, reload, update } = fakeServiceWorkers();
    const { worker } = fakeWorker('installed');
    registration.waiting = worker;

    await update.reloadIntoLatest();

    expect(registration.update).not.toHaveBeenCalled();
    expect(worker.postMessage).toHaveBeenCalledWith(SKIP_WAITING);
    expect(reload).not.toHaveBeenCalled();
    takeOver();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('asks the server for a newer worker, waits for it to install, then activates it', async () => {
    const { registration, takeOver, reload, update } = fakeServiceWorkers();
    const { worker, become } = fakeWorker('installing');
    vi.mocked(registration.update!).mockImplementation(async () => {
      registration.installing = worker;
      return registration as ServiceWorkerRegistration;
    });

    const reloading = update.reloadIntoLatest();
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled());
    expect(worker.postMessage).not.toHaveBeenCalled();
    become('installed');
    await reloading;

    expect(worker.postMessage).toHaveBeenCalledWith(SKIP_WAITING);
    takeOver();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads at once when the worker it waited for fails to install', async () => {
    const { registration, reload, update } = fakeServiceWorkers();
    const { worker, become } = fakeWorker('installing');
    registration.installing = worker;

    const reloading = update.reloadIntoLatest();
    become('redundant');
    await reloading;

    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads at once when the newer worker already controls the tab', async () => {
    const { registration, container, reload, update } = fakeServiceWorkers();
    const { worker } = fakeWorker('activated');
    registration.waiting = worker;
    container.controller = worker;

    await update.reloadIntoLatest();

    expect(reload).toHaveBeenCalledOnce();
  });

  it.each([
    {
      when: 'the server has nothing newer',
      arrange: () => fakeServiceWorkers(),
    },
    {
      when: 'the server cannot be reached',
      arrange: () => {
        const workers = fakeServiceWorkers();
        vi.mocked(workers.registration.update!).mockRejectedValue(new TypeError('offline'));
        return workers;
      },
    },
    {
      when: 'no worker is registered',
      arrange: () => fakeServiceWorkers({ registered: false }),
    },
  ])('reloads plainly when $when', async ({ arrange }) => {
    const { reload, update } = arrange();

    await update.reloadIntoLatest();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads plainly where the browser has no service worker', async () => {
    const reload = vi.fn();

    await createAppUpdate(undefined, reload).reloadIntoLatest();

    expect(reload).toHaveBeenCalledOnce();
  });
});
