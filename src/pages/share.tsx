import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sharedBodyMarkup } from '@/components/share/sharedBody.ts';
import { Spinner } from '@/components/ui/Spinner.tsx';
import type { SharedNote } from '@/contract/index.ts';
import { fetchSharedNote } from '@/data/http/publicShare.ts';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';

type State =
  | { status: 'loading' }
  | { status: 'shown'; shared: SharedNote }
  | { status: 'gone' }
  | { status: 'failed' };

/**
 * One Note, read-only, for a stranger holding the link (CONTEXT.md "Share Link"). It offers no
 * way in: signing in would show them nothing more. Why it renders bare: CLAUDE.md, "Routing".
 */
export default function SharePage({ token }: { token: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'loading' });

  useAsyncEffect(
    async (alive) => {
      try {
        const found = await fetchSharedNote(token);
        if (alive()) {
          setState(found === 'gone' ? { status: 'gone' } : { status: 'shown', shared: found });
        }
      } catch {
        if (alive()) setState({ status: 'failed' });
      }
    },
    [token]
  );

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col px-4 pt-[calc(2rem+var(--safe-top))] pb-[calc(2rem+var(--safe-bottom))]">
      <div className="flex-1">
        {state.status === 'loading' && (
          <p role="status" className="flex items-center gap-2 text-muted-foreground text-sm">
            <Spinner />
            {t('share.page.loading')}
          </p>
        )}
        {state.status === 'gone' && (
          <h1 className="font-display font-semibold text-2xl text-foreground">
            {t('share.page.gone')}
          </h1>
        )}
        {state.status === 'failed' && (
          <p role="alert" className="text-muted-foreground text-sm">
            {t('share.page.failed')}
          </p>
        )}
        {state.status === 'shown' && <SharedNoteView shared={state.shared} />}
      </div>
      <footer className="mt-12 text-muted-foreground text-xs">{t('share.page.footer')}</footer>
    </main>
  );
}

function SharedNoteView({ shared }: { shared: SharedNote }) {
  const { t } = useTranslation();
  const fileFallback = t('editor.file.fallbackName');
  const markup = useMemo(() => sharedBodyMarkup(shared, fileFallback), [shared, fileFallback]);
  const header = shared.note.header?.trim();

  return (
    <article>
      {/* Visually absent for a Note without a title, but still the page's heading. */}
      <h1
        dir="auto"
        className={
          header
            ? 'wrap-break-word mb-4 text-pretty font-display font-semibold text-2xl text-foreground'
            : 'sr-only'
        }
      >
        {header || t('share.page.untitled')}
      </h1>
      <div
        className="prose max-w-none text-foreground"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by `sharedBodyMarkup` with the app's Body configuration.
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </article>
  );
}
