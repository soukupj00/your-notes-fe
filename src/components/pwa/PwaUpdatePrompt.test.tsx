import { act, render } from '@testing-library/react';
import { type Action, toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaUpdatePrompt } from './PwaUpdatePrompt.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({ toast: vi.fn() }));

const serviceWorker = vi.hoisted(() => ({
  register: vi.fn(),
  update: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/registerServiceWorker.ts', () => ({
  registerAppServiceWorker: serviceWorker.register,
}));

beforeEach(() => {
  vi.clearAllMocks();
  serviceWorker.register.mockReturnValue(serviceWorker.update);
});

describe('PwaUpdatePrompt', () => {
  it('offers to reload when an update is waiting and activates it on confirmation', async () => {
    render(<PwaUpdatePrompt />);

    expect(serviceWorker.register).toHaveBeenCalledTimes(1);
    const { onNeedRefresh } = serviceWorker.register.mock.calls[0][0];

    await act(async () => {
      await onNeedRefresh();
    });

    expect(toast).toHaveBeenCalledWith(
      'pwa.update.available',
      expect.objectContaining({
        duration: Number.POSITIVE_INFINITY,
        action: expect.objectContaining({ label: 'pwa.update.reload' }),
        cancel: expect.objectContaining({ label: 'pwa.update.later' }),
      })
    );

    const options = vi.mocked(toast).mock.calls[0][1];
    const action = options?.action as Action;
    action.onClick({} as Parameters<Action['onClick']>[0]);

    expect(serviceWorker.update).toHaveBeenCalledWith(true);
  });
});
