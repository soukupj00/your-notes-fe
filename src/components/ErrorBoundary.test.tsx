import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary.tsx';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function Boom(): never {
  throw new Error('kaboom');
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // React logs the caught error itself; keep the suite output readable.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  // A white screen in an installed PWA has no address bar to retype: the
  // fallback must be announced and must offer a way out.
  it('shows a recoverable alert instead of white-screening', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('errors.crash.title')).toBeInTheDocument();
    // The message helps a bug report; the stack is deliberately not shown.
    expect(screen.getByText('kaboom')).toBeInTheDocument();
  });

  it('reloads the app on confirm', async () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    await userEvent.click(screen.getByRole('button', { name: 'errors.crash.reload' }));

    expect(reload).toHaveBeenCalledOnce();
  });
});
