import { Ellipsis } from 'lucide-react';
import { type KeyboardEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { useShortcuts } from '@/hooks/useShortcuts.ts';
import { comboFromEvent, comboLabel, MODIFIER_KEYS, typesAltGrCharacter } from '@/lib/key-combo.ts';
import {
  findConflict,
  type Refusal,
  refusalOf,
  SHORTCUTS,
  type ShortcutDef,
} from '@/lib/shortcuts.ts';
import { readableCombo, ShortcutKeys } from './ShortcutKeys.tsx';

const REFUSALS: Record<Refusal | 'altgr', string> = {
  'needs-modifier': 'settings.shortcuts.refused.needsModifier',
  'bare-key': 'settings.shortcuts.refused.bareKey',
  browser: 'settings.shortcuts.refused.browser',
  editor: 'settings.shortcuts.refused.editor',
  altgr: 'settings.shortcuts.refused.altgr',
};

type Recording =
  | { kind: 'idle' }
  | { kind: 'listening'; refused?: { reason: keyof typeof REFUSALS; combo: string } }
  /** Nothing is saved until Replace or Cancel (ADR 0026). */
  | { kind: 'conflict'; combo: string; owner: ShortcutDef };

const IDLE: Recording = { kind: 'idle' };

/**
 * The keys are the button that records, as the F3 recorder was: focus stays on it, and leaving it
 * cancels. Every way out of the menu hands focus back to the keys.
 */
export function ShortcutRow({ def }: { def: ShortcutDef }) {
  const { t } = useTranslation();
  const { bindings, assign, reset } = useShortcuts();
  const [recording, setRecording] = useState<Recording>(IDLE);
  const keysRef = useRef<HTMLButtonElement>(null);
  const focusKeysOnClose = useRef(false);
  const name = t(def.labelKey);
  const combo = bindings[def.id] ?? null;
  const changed = combo !== def.defaultCombo;
  const listening = recording.kind === 'listening';

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!listening || MODIFIER_KEYS.has(event.key)) return;
    // Tab is how a keyboard leaves; the blur cancels.
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') return setRecording(IDLE);

    const pressed = comboFromEvent(event.nativeEvent);
    if (!pressed) return;
    const reason = typesAltGrCharacter(event.nativeEvent) ? 'altgr' : refusalOf(pressed, def.scope);
    if (reason) return setRecording({ kind: 'listening', refused: { reason, combo: pressed } });
    const ownerId = findConflict(def.id, pressed, bindings);
    const owner = SHORTCUTS.find((other) => other.id === ownerId);
    if (owner) return setRecording({ kind: 'conflict', combo: pressed, owner });
    setRecording(IDLE);
    assign(def.id, pressed);
  };

  const settle = (save?: () => void) => {
    save?.();
    setRecording(IDLE);
    keysRef.current?.focus();
  };

  const status =
    recording.kind === 'conflict'
      ? t('settings.shortcuts.conflict', {
          keys: comboLabel(recording.combo),
          name: t(recording.owner.labelKey),
        })
      : recording.kind === 'listening'
        ? recording.refused
          ? t(REFUSALS[recording.refused.reason], { keys: comboLabel(recording.refused.combo) })
          : t('settings.shortcuts.recording')
        : '';

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm">
          {name}
          {changed && (
            <>
              <span aria-hidden className="size-2 rounded-full bg-warning" />
              <span className="sr-only">{t('settings.shortcuts.changed')}</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-1">
          <Button
            ref={keysRef}
            type="button"
            variant="ghost"
            size="sm"
            className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            aria-label={
              combo
                ? t('settings.shortcuts.keysButton', { name, keys: readableCombo(combo) })
                : t('settings.shortcuts.keysButtonNone', { name })
            }
            aria-pressed={listening}
            // Focused by hand, as Safari and Firefox on macOS do not focus a clicked button.
            onClick={(event) => {
              if (listening) return;
              event.currentTarget.focus();
              setRecording({ kind: 'listening' });
            }}
            onKeyDown={onKeyDown}
            onBlur={() => listening && setRecording(IDLE)}
          >
            {combo ? (
              <ShortcutKeys combo={combo} />
            ) : (
              <span className="text-muted-foreground">{t('settings.shortcuts.none')}</span>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('settings.shortcuts.menu.trigger', { name })}
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(event) => {
                if (!focusKeysOnClose.current) return;
                focusKeysOnClose.current = false;
                event.preventDefault();
                keysRef.current?.focus();
              }}
            >
              <DropdownMenuItem
                onSelect={() => {
                  focusKeysOnClose.current = true;
                  setRecording({ kind: 'listening' });
                }}
              >
                {t('settings.shortcuts.menu.edit')}
              </DropdownMenuItem>
              {combo !== null && (
                <DropdownMenuItem
                  onSelect={() => {
                    focusKeysOnClose.current = true;
                    assign(def.id, null);
                  }}
                >
                  {t('settings.shortcuts.menu.clear')}
                </DropdownMenuItem>
              )}
              {changed && (
                <DropdownMenuItem
                  onSelect={() => {
                    focusKeysOnClose.current = true;
                    reset(def.id);
                  }}
                >
                  {t('settings.shortcuts.menu.reset', { keys: comboLabel(def.defaultCombo) })}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      <p role="status" className="mt-2 text-muted-foreground text-xs empty:hidden">
        {status}
      </p>
      {recording.kind === 'conflict' && (
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => settle(() => assign(def.id, recording.combo, recording.owner.id))}
          >
            {t('settings.shortcuts.replace')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => settle()}>
            {t('settings.shortcuts.cancel')}
          </Button>
        </div>
      )}
    </li>
  );
}
