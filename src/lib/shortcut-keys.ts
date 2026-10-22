// The platform cannot change during a session, and a module body runs once, so these are the
// cache - no lazy branch needed.
const PLATFORM_NAME = (() => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform =
    typeof nav.userAgentData?.platform === 'string'
      ? nav.userAgentData.platform
      : navigator.userAgent;
  return platform.toLowerCase();
})();

export const IS_MAC = PLATFORM_NAME.includes('mac');
export const IS_WINDOWS = !IS_MAC && PLATFORM_NAME.includes('win');

type ShortcutKeyResult = {
  symbol: string;
  readable: string;
};

const shortcutKeyMap: Record<string, ShortcutKeyResult> = {
  mod: IS_MAC ? { symbol: '⌘', readable: 'Command' } : { symbol: 'Ctrl', readable: 'Control' },
  alt: IS_MAC ? { symbol: '⌥', readable: 'Option' } : { symbol: 'Alt', readable: 'Alt' },
  shift: IS_MAC ? { symbol: '⇧', readable: 'Shift' } : { symbol: 'Shift', readable: 'Shift' },
  // Only a recorded shortcut names these: on a Mac Ctrl is not `Mod`, elsewhere Meta is not.
  ctrl: IS_MAC ? { symbol: '⌃', readable: 'Control' } : { symbol: 'Ctrl', readable: 'Control' },
  meta: IS_MAC ? { symbol: '⌘', readable: 'Command' } : { symbol: 'Super', readable: 'Super' },
};

export const getShortcutKey = (key: string): ShortcutKeyResult =>
  shortcutKeyMap[key.toLowerCase()] || { symbol: key, readable: key };

export const getShortcutKeys = (keys: string[]): ShortcutKeyResult[] => keys.map(getShortcutKey);
