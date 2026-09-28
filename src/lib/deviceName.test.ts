import { describe, expect, it } from 'vitest';
import { platformOf } from './deviceName.ts';

describe('platformOf', () => {
  it.each([
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
      { browser: 'Chrome', system: 'Android' },
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
      { browser: 'Safari', system: 'iPhone' },
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
      { browser: 'Edge', system: 'Windows' },
    ],
    [
      'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
      { browser: 'Firefox', system: 'Linux' },
    ],
    ['curl/8.0', { browser: 'Browser' }],
  ])('%s', (ua, expected) => {
    expect(platformOf(ua)).toEqual(expected);
  });
});
