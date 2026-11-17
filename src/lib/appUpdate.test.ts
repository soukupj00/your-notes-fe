import { describe, expect, it, vi } from 'vitest';
import { createAppUpdate } from './appUpdate.ts';

function fakeContainer() {
  const events = new EventTarget();
  return Object.assign(events, {
    takeOver: () => events.dispatchEvent(new Event('controllerchange')),
  }) as unknown as ServiceWorkerContainer & { takeOver(): void };
}

describe('createAppUpdate', () => {
  it('reloads once a newer worker takes over the tab, whichever tab accepted it', () => {
    const container = fakeContainer();
    const reload = vi.fn();
    const update = createAppUpdate(container, reload);

    update.reloadOnTakeover();
    expect(reload).not.toHaveBeenCalled();

    container.takeOver();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads only once, however often it is armed or the controller changes', () => {
    const container = fakeContainer();
    const reload = vi.fn();
    const update = createAppUpdate(container, reload);

    update.reloadOnTakeover();
    update.reloadOnTakeover();
    container.takeOver();
    container.takeOver();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('never reloads on a takeover it was not armed for, such as the first install claiming the tab', () => {
    const container = fakeContainer();
    const reload = vi.fn();
    createAppUpdate(container, reload);

    container.takeOver();

    expect(reload).not.toHaveBeenCalled();
  });
});
