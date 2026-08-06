// We'll cache the result of isMac() and isTouchDevice(), since they shouldn't
// change during a session. That way repeated calls don't require any logic and are rapid.
let isMacResult: boolean | undefined;
let isTouchDeviceResult: boolean | undefined;

export function isMac(): boolean {
  if (isMacResult === undefined) {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    if (nav.userAgentData && typeof nav.userAgentData.platform === 'string') {
      isMacResult = nav.userAgentData.platform.toLowerCase().includes('mac');
    } else {
      isMacResult = navigator.userAgent.toLowerCase().includes('mac');
    }
  }
  return !!isMacResult;
}

type ShortcutKeyResult = {
  symbol: string;
  readable: string;
};

const shortcutKeyMap: Record<string, ShortcutKeyResult> = {
  mod: isMac() ? { symbol: '⌘', readable: 'Command' } : { symbol: 'Ctrl', readable: 'Control' },
  alt: isMac() ? { symbol: '⌥', readable: 'Option' } : { symbol: 'Alt', readable: 'Alt' },
  shift: { symbol: '⇧', readable: 'Shift' },
};

export const getShortcutKey = (key: string): ShortcutKeyResult =>
  shortcutKeyMap[key.toLowerCase()] || { symbol: key, readable: key };

export const getShortcutKeys = (keys: string[]): ShortcutKeyResult[] => keys.map(getShortcutKey);

export function isTouchDevice(): boolean {
  if (isTouchDeviceResult === undefined) {
    // This technique is taken from
    // https://hacks.mozilla.org/2013/04/detecting-touch-its-the-why-not-the-how/
    // (and https://stackoverflow.com/a/4819886/4543977)
    isTouchDeviceResult =
      (window && 'ontouchstart' in window) ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error: msMaxTouchPoints is IE-specific, so needs to be ignored
      navigator.msMaxTouchPoints > 0;
  }

  return isTouchDeviceResult;
}
