import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CrashScreen } from '@/components/CrashScreen.tsx';

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
 * A class component because that is still the only way to catch render errors.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
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
    if (!error) return this.props.children;
    return <CrashScreen error={error} />;
  }
}

export default ErrorBoundary;
