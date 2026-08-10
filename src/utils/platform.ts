// Whether this is a Mac cannot change during a session, and a module body runs
// once, so this is the cache - no lazy branch needed.
const IS_MAC = (() => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform =
    typeof nav.userAgentData?.platform === 'string'
      ? nav.userAgentData.platform
      : navigator.userAgent;
  return platform.toLowerCase().includes('mac');
})();

export function isMac(): boolean {
  return IS_MAC;
}

type ShortcutKeyResult = {
  symbol: string;
  readable: string;
};

const shortcutKeyMap: Record<string, ShortcutKeyResult> = {
  mod: IS_MAC ? { symbol: '⌘', readable: 'Command' } : { symbol: 'Ctrl', readable: 'Control' },
  alt: IS_MAC ? { symbol: '⌥', readable: 'Option' } : { symbol: 'Alt', readable: 'Alt' },
  shift: { symbol: '⇧', readable: 'Shift' },
};

export const getShortcutKey = (key: string): ShortcutKeyResult =>
  shortcutKeyMap[key.toLowerCase()] || { symbol: key, readable: key };

export const getShortcutKeys = (keys: string[]): ShortcutKeyResult[] => keys.map(getShortcutKey);
