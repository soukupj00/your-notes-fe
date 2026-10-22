import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet.tsx';
import { ToolbarLayoutEditor } from './ToolbarLayoutEditor';
import { useWidthClass } from './useWidthClass';

/**
 * Opens a sheet and must not navigate (ADR 0011, decision 10): the editor may hold an
 * unsaved draft. Switched off, it leaves Settings as the way back in.
 */
export function ToolbarCustomizeButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const widthClass = useWidthClass();
  const compact = widthClass === 'compact';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <ActionButton
        toggle
        icon="Settings2"
        tooltip={t('editor.toolbar.customize')}
        isActive={() => open}
        action={() => setOpen(true)}
        data-testid="toolbar-customize"
      />
      <SheetContent
        side={compact ? 'bottom' : 'right'}
        className="flex max-h-[85dvh] w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>{t('settings.toolbar.title')}</SheetTitle>
        </SheetHeader>
        {/* The preview only earns its space where the sheet covers the live bar; a
            wide window's side sheet leaves the real bar visible. */}
        <ToolbarLayoutEditor showPreview={compact} />
      </SheetContent>
    </Sheet>
  );
}

export default ToolbarCustomizeButton;
