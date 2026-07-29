import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS } from '@/components/nav/navItems.ts';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar.tsx';
import { useTags } from '@/hooks/data/useTags.ts';

/**
 * The nav link list, rendered by both the desktop sidebar and the mobile
 * drawer. It closes the drawer itself on selection, so callers do not have to
 * know the drawer exists.
 */
export function SideNav() {
  const { t } = useTranslation();
  const tags = useTags();
  const { setOpenMobile, isMobile, state } = useSidebar();
  const closeDrawer = () => setOpenMobile(false);
  // Collapse is a "give me my screen back" gesture, not a lossless compaction:
  // the rail carries the four destinations only (ADR 0010). `state` tracks the
  // desktop rail, so the drawer must not inherit a collapse chosen on a laptop.
  const showLabels = tags.length > 0 && (isMobile || state === 'expanded');

  const activeProps = { className: 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' };

  return (
    <nav aria-label={t('nav.primary')}>
      <SidebarGroup className="px-4">
        <SidebarGroupContent>
          <SidebarMenu>
            {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
              <SidebarMenuItem key={to}>
                {/* The collapsed rail is unusable without these tooltips. */}
                <SidebarMenuButton asChild tooltip={t(labelKey)}>
                  <Link
                    to={to}
                    onClick={closeDrawer}
                    // The router marks the matching link for us; `exact` keeps
                    // "/" from staying highlighted on every nested route.
                    activeProps={activeProps}
                    activeOptions={{ exact: to === '/' }}
                  >
                    <Icon aria-hidden />
                    <span>{t(labelKey)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {showLabels && (
        <SidebarGroup className="px-4">
          <SidebarGroupLabel>{t('nav.labels')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tags.map((tag) => (
                <SidebarMenuItem key={tag.id}>
                  <SidebarMenuButton asChild>
                    <Link
                      to="/tag/$id"
                      params={{ id: tag.id }}
                      onClick={closeDrawer}
                      activeProps={activeProps}
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
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </nav>
  );
}
