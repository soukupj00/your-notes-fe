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
import { noteColorAttrs } from '@/lib/note-colors.ts';

// A landscape phone brings a Coarse pointer's 44px floor to the desktop rail (ADR 0016).
// Collapsed, `px-2` leaves a 48px slot, where 44px hit boxes at the default pitch would overlap.
const GROUP_PADDING = 'px-4 group-data-[collapsible=icon]:px-2';

/** Closes the drawer itself on selection, so callers need not know a drawer exists. */
export function SideNav() {
  const { t } = useTranslation();
  const tags = useTags();
  const { setOpenMobile } = useSidebar();
  const closeDrawer = () => setOpenMobile(false);

  const activeProps = {
    className: 'bg-sidebar-primary font-medium text-sidebar-primary-foreground',
  };

  return (
    <nav aria-label={t('nav.primary')}>
      <SidebarGroup className={GROUP_PADDING}>
        <SidebarGroupContent>
          <SidebarMenu>
            {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
              <SidebarMenuItem key={to}>
                {/* The collapsed rail is unusable without these tooltips. */}
                <SidebarMenuButton asChild tooltip={t(labelKey)}>
                  <Link
                    to={to}
                    onClick={closeDrawer}
                    // `exact` so "/" is not highlighted on every nested route.
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

      {tags.length > 0 && (
        <SidebarGroup className={GROUP_PADDING}>
          <SidebarGroupLabel>{t('nav.labels')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tags.map((tag) => (
                <SidebarMenuItem key={tag.id}>
                  {/* Collapsed, the dot is all that shows, so the name rides in the rail's tooltip. */}
                  <SidebarMenuButton asChild tooltip={tag.name}>
                    <Link
                      to="/tag/$id"
                      params={{ id: tag.id }}
                      onClick={closeDrawer}
                      activeProps={activeProps}
                    >
                      {/* The dot is a label's only identity in the rail, so it takes the identity's
                          strongest value over a 3:1 boundary rather than the pale card tint. */}
                      <span
                        {...noteColorAttrs(tag.color)}
                        className="size-3 shrink-0 rounded-full border border-input bg-note-swatch-ring"
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
