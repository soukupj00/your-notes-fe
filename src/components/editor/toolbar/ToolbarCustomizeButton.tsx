import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet.tsx';
import { ToolbarLayoutEditor } from './ToolbarLayoutEditor';
import { useWidthClass } from './useWidthClass';

/**
 * The `⚙` at the end of the bar, and the sheet it opens.
 *
 * The in-editor path **must not navigate** (ADR 0011, decision 10): the editor
 * may be holding an unsaved draft, and routing to Settings would either destroy
 * it or force the `ensureNoteId` race Task 4 refused for archive and trash. A
 * sheet layered over the dialog changes nothing about the note.
 *
 * It is a Toolbar Item like any other, so a user who does not want it can switch
 * it off - Settings remains the way back in.
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
        // On a phone the sheet comes up over the bar it is editing; on a wide
        // window it takes the side, leaving the real bar visible behind it.
        side={compact ? 'bottom' : 'right'}
        className="flex max-h-[85dvh] w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>{t('settings.toolbar.title')}</SheetTitle>
        </SheetHeader>
        {/* The Width Class in effect is the one being looked at, so that is the
            one the sheet opens on. The preview strip is only worth its space
            where the sheet is covering the live bar. */}
        <ToolbarLayoutEditor initialWidthClass={widthClass} showPreview={compact} />
      </SheetContent>
    </Sheet>
  );
}

export default ToolbarCustomizeButton;
