import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS } from '@/components/nav/navItems.ts';
import { useTags } from '@/hooks/data/useTags.ts';

/**
 * The nav link list itself, rendered by both the desktop sidebar and the mobile
 * drawer. `onNavigate` lets the drawer close itself on selection; the sidebar
 * leaves it out.
 */
export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const tags = useTags();

  const linkClass =
    'flex items-center gap-3 rounded-full px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <nav aria-label={t('nav.primary')} className="flex flex-col gap-1 py-2">
      {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className={linkClass}
          // The router marks the matching link for us; `exact` keeps "/" from
          // staying highlighted on every nested route.
          activeProps={{ className: 'bg-accent font-medium text-accent-foreground' }}
          activeOptions={{ exact: to === '/' }}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {t(labelKey)}
        </Link>
      ))}

      {tags.length > 0 && (
        <>
          <p className="mt-4 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {t('nav.labels')}
          </p>
          {tags.map((tag) => (
            <Link
              key={tag.id}
              to="/tag/$id"
              params={{ id: tag.id }}
              onClick={onNavigate}
              className={linkClass}
              activeProps={{ className: 'bg-accent font-medium text-accent-foreground' }}
            >
              <span
                className="size-3 shrink-0 rounded-full border"
                style={
                  tag.color
                    ? {
                        backgroundColor: `var(--note-${tag.color})`,
                        borderColor: `var(--note-${tag.color}-border)`,
                      }
                    : undefined
                }
                aria-hidden
              />
              <span className="truncate">{tag.name}</span>
            </Link>
          ))}
        </>
      )}
    </nav>
  );
}
