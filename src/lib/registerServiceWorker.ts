import { registerSW } from 'virtual:pwa-register';

/** Isolates VitePWA's virtual module behind a normal application import. */
export function registerAppServiceWorker(options: Parameters<typeof registerSW>[0]) {
  return registerSW(options);
}
