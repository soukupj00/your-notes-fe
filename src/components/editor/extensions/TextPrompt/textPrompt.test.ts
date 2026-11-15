import { describe, expect, it, vi } from 'vitest';
import { createTextPromptCoordinator, type TextPromptRequest } from './textPrompt';

const request: TextPromptRequest = { kind: 'url', title: 'Link', confirmLabel: 'Apply' };

describe('createTextPromptCoordinator', () => {
  it('answers null at once when no host is mounted', async () => {
    await expect(createTextPromptCoordinator().ask(request)).resolves.toBeNull();
  });

  it('hands the question to the host and resolves with its answer', async () => {
    const prompt = createTextPromptCoordinator();
    const show = vi.fn((_request, answer) => answer('https://example.com'));
    prompt.registerHost(show);

    await expect(prompt.ask(request)).resolves.toBe('https://example.com');
    expect(show).toHaveBeenCalledWith(request, expect.any(Function));
  });

  it('cancels the question still open when a newer one is asked', async () => {
    const prompt = createTextPromptCoordinator();
    const answers: ((value: string | null) => void)[] = [];
    prompt.registerHost((_request, answer) => answers.push(answer));

    const first = prompt.ask(request);
    const second = prompt.ask(request);
    answers[1]('second');

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBe('second');
  });

  it('stops asking a host that unregistered', async () => {
    const prompt = createTextPromptCoordinator();
    const show = vi.fn();
    prompt.registerHost(show)();

    await expect(prompt.ask(request)).resolves.toBeNull();
    expect(show).not.toHaveBeenCalled();
  });
});
