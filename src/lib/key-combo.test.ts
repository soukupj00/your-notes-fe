import { describe, expect, it } from 'vitest';
import {
  ariaKeyShortcuts,
  comboFromEvent,
  comboLabel,
  comboParts,
  hasCommandModifier,
  type KeyEventLike,
  typesAltGrCharacter,
} from './key-combo.ts';

const pc = { mac: false, windows: false };
const win = { mac: false, windows: true };
const mac = { mac: true, windows: false };

function press(init: Partial<KeyEventLike> & Pick<KeyEventLike, 'key' | 'keyCode'>): KeyEventLike {
  return { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init };
}

describe('comboFromEvent names a press the way every matcher will', () => {
  it.each([
    ['Ctrl+B', press({ key: 'b', keyCode: 66, ctrlKey: true }), pc, 'Mod-b'],
    [
      'Ctrl+Shift+8 on US',
      press({ key: '*', keyCode: 56, ctrlKey: true, shiftKey: true }),
      pc,
      'Mod-Shift-8',
    ],
    [
      'Ctrl+Shift+8 on Czech',
      press({ key: '8', keyCode: 56, ctrlKey: true, shiftKey: true }),
      pc,
      'Mod-Shift-8',
    ],
    ['Ctrl+ě on Czech', press({ key: 'ě', keyCode: 50, ctrlKey: true }), pc, 'Mod-2'],
    ['Ctrl+Z on Czech QWERTZ', press({ key: 'z', keyCode: 90, ctrlKey: true }), pc, 'Mod-z'],
    ['Ctrl+Alt+1', press({ key: '1', keyCode: 49, ctrlKey: true, altKey: true }), pc, 'Mod-Alt-1'],
    [
      'Ctrl+Shift+/',
      press({ key: '?', keyCode: 191, ctrlKey: true, shiftKey: true }),
      pc,
      'Mod-Shift-/',
    ],
    [
      'Ctrl+Shift+S, Caps Lock on',
      press({ key: 'S', keyCode: 83, ctrlKey: true, shiftKey: true }),
      pc,
      'Mod-Shift-s',
    ],
    ['Cmd+B on a Mac', press({ key: 'b', keyCode: 66, metaKey: true }), mac, 'Mod-b'],
    ['Ctrl+B on a Mac', press({ key: 'b', keyCode: 66, ctrlKey: true }), mac, 'Ctrl-b'],
    ['Option+S on a Mac', press({ key: 'ß', keyCode: 83, altKey: true }), mac, 'Alt-s'],
    ['Win+B on Linux', press({ key: 'b', keyCode: 66, metaKey: true }), pc, 'Meta-b'],
    ['bare n', press({ key: 'n', keyCode: 78 }), pc, 'n'],
    ['bare Shift+N', press({ key: 'N', keyCode: 78, shiftKey: true }), pc, 'n'],
    ['bare /', press({ key: '/', keyCode: 191 }), pc, '/'],
    ['bare / on Czech (Shift+ú)', press({ key: '/', keyCode: 219, shiftKey: true }), pc, '/'],
    ['bare ě', press({ key: 'ě', keyCode: 50 }), pc, 'ě'],
    ['Shift alone', press({ key: 'Shift', keyCode: 16, shiftKey: true }), pc, null],
    ['Ctrl+Tab', press({ key: 'Tab', keyCode: 9, ctrlKey: true }), pc, 'Mod-Tab'],
  ])('%s', (_label, event, platform, expected) => {
    expect(comboFromEvent(event, platform)).toBe(expected);
  });
});

describe('typesAltGrCharacter', () => {
  it('is a character typed with AltGr on Windows', () => {
    expect(
      typesAltGrCharacter(press({ key: '~', keyCode: 49, ctrlKey: true, altKey: true }), win)
    ).toBe(true);
  });

  // A Czech AltGr+3 starts ^ on the next key, and names itself `Dead` rather than the character.
  it('is a dead key pressed with AltGr on Windows', () => {
    expect(
      typesAltGrCharacter(press({ key: 'Dead', keyCode: 51, ctrlKey: true, altKey: true }), win)
    ).toBe(true);
  });

  it('is not the same press elsewhere, or a plain Ctrl+Alt+1', () => {
    expect(
      typesAltGrCharacter(press({ key: '~', keyCode: 49, ctrlKey: true, altKey: true }), pc)
    ).toBe(false);
    expect(
      typesAltGrCharacter(press({ key: '1', keyCode: 49, ctrlKey: true, altKey: true }), win)
    ).toBe(false);
  });
});

describe('comboParts', () => {
  it.each([
    ['Mod-Shift-8', ['Mod', 'Shift', '8']],
    ['Mod-b', ['Mod', 'B']],
    ['Mod--', ['Mod', '-']],
    ['/', ['/']],
    ['Mod-\\', ['Mod', '\\']],
  ])('%s', (combo, parts) => {
    expect(comboParts(combo)).toEqual(parts);
  });
});

describe('hasCommandModifier', () => {
  it.each([
    ['Alt-s', true],
    ['Meta-b', true],
    ['Mod-b', true],
    ['n', false],
    ['Shift-n', false],
  ])('%s', (combo, expected) => {
    expect(hasCommandModifier(combo)).toBe(expected);
  });
});

describe('ariaKeyShortcuts', () => {
  it('writes the ARIA names of the platform', () => {
    expect(ariaKeyShortcuts('Mod-Alt-n', pc)).toBe('Control+Alt+N');
    expect(ariaKeyShortcuts('Mod-Alt-n', mac)).toBe('Meta+Alt+N');
    expect(ariaKeyShortcuts('n', pc)).toBe('N');
    expect(ariaKeyShortcuts('Mod- ', pc)).toBe('Control+Space');
  });
});

describe('comboLabel', () => {
  it('draws a combination with its printed symbols', () => {
    expect(comboLabel('Mod-Alt-n')).toBe('Ctrl + Alt + N');
    expect(comboLabel('/')).toBe('/');
    expect(comboLabel('Mod- ')).toBe('Ctrl + Space');
  });
});
