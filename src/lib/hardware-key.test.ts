import { describe, expect, it } from 'vitest';
import { isHardwareKey } from './hardware-key.ts';

function press(init: KeyboardEventInit & { keyCode?: number }, target: 'body' | 'input' = 'body') {
  const element = document.createElement(target === 'body' ? 'div' : 'input');
  const event = new KeyboardEvent('keydown', { bubbles: true, ...init });
  element.dispatchEvent(event);
  return event;
}

describe('isHardwareKey', () => {
  it.each([
    ['n on the page', press({ key: 'n' }), true],
    ['n in a field', press({ key: 'n' }, 'input'), false],
    ['Ctrl+K in a field', press({ key: 'k', ctrlKey: true }, 'input'), true],
    ['Shift alone', press({ key: 'Shift', shiftKey: true }), false],
    ['Control alone', press({ key: 'Control', ctrlKey: true }), false],
    ['Unidentified', press({ key: 'Unidentified' }), false],
    ['keyCode 229', press({ key: 'n', keyCode: 229 }), false],
    ['IME composition', press({ key: 'n', isComposing: true }), false],
    ['ArrowDown on the page', press({ key: 'ArrowDown' }), true],
    ['ArrowDown in a field', press({ key: 'ArrowDown' }, 'input'), false],
    ['Enter on the page', press({ key: 'Enter' }), false],
  ])('%s', (_, event, expected) => {
    expect(isHardwareKey(event, true)).toBe(expected);
  });

  it('never trusts a synthetic event', () => {
    const event = press({ key: 'n' });
    expect(event.isTrusted).toBe(false);
    expect(isHardwareKey(event)).toBe(false);
  });
});
