import { Component, type ErrorInfo, type ReactNode } from 'react';
import { type WithTranslation, withTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';

type Props = WithTranslation & { children: ReactNode };
type State = { error: Error | null };

/**
 * Top-level crash barrier.
 *
 * An installed PWA that white-screens has no address bar to retype and no
 * obvious way out, so an uncaught render error must still leave the user a
 * button. Reload rather than "try again": the error escaped React's render, so
 * the surviving in-memory state is not to be trusted - notes themselves are
 * safe in IndexedDB, which is what makes a reload cheap here.
 *
 * A class component because that is still the only way to catch render errors;
 * `withTranslation` supplies `t` since hooks are unavailable.
 */
class ErrorBoundaryBase extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry in a self-hosted app: the console is the only place a user
    // (or the person they report to) can find the stack.
    console.error('Unhandled error:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    const { t, children } = this.props;
    if (!error) return children;

    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
      >
        <h1 className="font-semibold text-xl">{t('errors.crash.title')}</h1>
        <p className="max-w-sm text-muted-foreground text-sm">{t('errors.crash.description')}</p>
        {/* The message is for a bug report, so it is shown rather than hidden -
            but only the message, never the stack. */}
        <p className="max-w-sm break-words font-mono text-muted-foreground text-xs">
          {error.message}
        </p>
        <Button onClick={() => window.location.reload()}>{t('errors.crash.reload')}</Button>
      </div>
    );
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryBase);
export default ErrorBoundary;
