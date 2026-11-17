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

  return {
    /** Reloads once a newer worker controls this tab, so its old code does not run on. */
    reloadOnTakeover() {
      container?.addEventListener('controllerchange', reloadOnce);
    },
  };
}

export const appUpdate = createAppUpdate(navigator.serviceWorker, () => window.location.reload());
