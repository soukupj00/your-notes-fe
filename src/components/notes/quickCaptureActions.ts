import type { LucideIcon } from 'lucide-react';
import { Image, ListChecks, Mic, PencilRuler, SquarePen } from 'lucide-react';
import { EMPTY_CHECKLIST_BODY } from '@/components/notes/NoteEditorDialog.tsx';
import type { EditingState } from '@/components/notes/NotesView.tsx';

export type QuickCaptureActionKey = 'text' | 'checklist' | 'audio' | 'drawing' | 'picture';

export type QuickCaptureAction = {
  key: QuickCaptureActionKey;
  Icon: LucideIcon;
  /** i18n key for the action's accessible name and its speed-dial label. */
  labelKey: string;
  /** The editor state this action opens - a body seed, a capture, or neither. */
  editing: NonNullable<EditingState>;
};

/**
 * The five ways to start a note, defined once so the mobile speed-dial and the
 * desktop quick-action row cannot drift. Order is deliberate: plain text first
 * (the common case), media after.
 */
export const QUICK_CAPTURE_ACTIONS: QuickCaptureAction[] = [
  { key: 'text', Icon: SquarePen, labelKey: 'notes.capture.text', editing: { id: null } },
  {
    key: 'checklist',
    Icon: ListChecks,
    labelKey: 'notes.capture.checklist',
    editing: { id: null, initialBody: EMPTY_CHECKLIST_BODY },
  },
  {
    key: 'audio',
    Icon: Mic,
    labelKey: 'notes.capture.audio',
    editing: { id: null, capture: 'audio' },
  },
  {
    key: 'drawing',
    Icon: PencilRuler,
    labelKey: 'notes.capture.drawing',
    editing: { id: null, capture: 'drawing' },
  },
  {
    key: 'picture',
    Icon: Image,
    labelKey: 'notes.capture.picture',
    editing: { id: null, capture: 'picture' },
  },
];

/** Desktop: the "Take a note" bar already covers plain text. */
export const DESKTOP_QUICK_CAPTURE_ACTIONS = QUICK_CAPTURE_ACTIONS.filter(
  (action) => action.key !== 'text'
);
