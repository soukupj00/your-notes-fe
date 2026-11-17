/**
 * Moves this tab onto a new service worker's code. `container` is absent where the browser has
 * no service worker (an insecure origin, some private modes).
 */
export function createAppUpdate(container: ServiceWorkerContainer | undefined, reload: () => void) {
  let reloading = false;
  const reloadOnce = () => {
    if (reloading) return;
    reloading = true;
    reload();
  };

  /** Reloads once a newer worker controls this tab, so its old code does not run on. */
  function reloadOnTakeover() {
    container?.addEventListener('controllerchange', reloadOnce);
  }

  /**
   * Reloads into the newest code the server has. A waiting worker, or one this tab has not found
   * yet, is activated first, because a plain reload would come back under the old worker.
   */
  async function reloadIntoLatest() {
    const registration = await container?.getRegistration().catch(() => undefined);
    if (registration && !registration.waiting && !registration.installing) {
      await registration.update().catch(() => undefined);
    }
    const next = registration?.waiting ?? registration?.installing;
    if (!next || !(await installed(next))) return reloadOnce();

    reloadOnTakeover();
    if (container?.controller === next) return reloadOnce();
    next.postMessage({ type: 'SKIP_WAITING' });
  }

  return { reloadOnTakeover, reloadIntoLatest };
}

/** False when the worker failed to install. */
function installed(worker: ServiceWorker) {
  return new Promise<boolean>((resolve) => {
    const settle = () => {
      if (worker.state === 'parsed' || worker.state === 'installing') return;
      worker.removeEventListener('statechange', settle);
      resolve(worker.state !== 'redundant');
    };
    worker.addEventListener('statechange', settle);
    settle();
  });
}

export const appUpdate = createAppUpdate(navigator.serviceWorker, () => window.location.reload());
