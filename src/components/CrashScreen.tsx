import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';
import { cn } from '@/lib/utils.ts';

/**
 * What a crash leaves on screen. An installed PWA has no address bar to retype,
 * so it always offers a reload; Notes are safe in the Local Store, which is what
 * makes the reload cheap.
 */
export function CrashScreen({ error, className }: { error: Error; className?: string }) {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center',
        className
      )}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-semibold text-xl focus-visible:outline-none"
      >
        {t('errors.crash.title')}
      </h1>
      <p className="max-w-sm text-muted-foreground text-sm">{t('errors.crash.description')}</p>
      {/* The message helps a bug report, so it is shown; the stack never is. */}
      <p className="max-w-sm break-words font-mono text-muted-foreground text-xs">
        {error.message}
      </p>
      <Button onClick={() => window.location.reload()}>{t('errors.crash.reload')}</Button>
    </div>
  );
}

/** The router's fallback, so a route that throws (a chunk that failed to load) is not TanStack's unstyled default. */
export function RouteError({ error }: ErrorComponentProps) {
  // Most routes render it inside the shell, below the navbar, where a full viewport height would scroll the page.
  return <CrashScreen error={error} className="min-h-[60dvh]" />;
}
