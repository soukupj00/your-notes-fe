/** First match wins, so the more specific browsers come before the engines they carry. */
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Android/, 'Android'],
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/CrOS/, 'ChromeOS'],
  [/Windows/, 'Windows'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Linux/, 'Linux'],
];

const first = (table: [RegExp, string][], ua: string) =>
  table.find(([pattern]) => pattern.test(ua))?.[1];

/**
 * The browser and system a Device name is made of ("Chrome" on "Android"), read
 * from the user agent. Only a suggestion: the person can type anything, so a
 * wrong guess (an iPad reporting itself as a Mac) costs one edit.
 */
export function platformOf(ua: string): { browser: string; system?: string } {
  const system = first(SYSTEMS, ua);
  return { browser: first(BROWSERS, ua) ?? 'Browser', ...(system ? { system } : {}) };
}
