import type { LucideIcon } from 'lucide-react';
import { Camera, Image, ListChecks, Mic, PencilRuler, SquarePen } from 'lucide-react';
import type { NoteOpenRequest } from '@/components/notes/NotesView.tsx';
import { EMPTY_CHECKLIST_BODY } from '@/components/notes/noteDrafts.ts';

export type QuickCaptureActionKey =
  | 'text'
  | 'checklist'
  | 'audio'
  | 'drawing'
  | 'picture'
  | 'camera';

/** A Start that begins by choosing files: the OS picker opens inside the tap. */
export interface StartPicker {
  accept: string;
  /** Straight to the camera on a phone; ignored by a desktop browser. */
  capture?: 'environment';
}

export type QuickCaptureAction = {
  key: QuickCaptureActionKey;
  Icon: LucideIcon;
  labelKey: string;
  /** The editor state this action opens - a body seed, a capture, or neither.
   *  For a picker Start, the bar adds the chosen `files` to it. */
  editing: NoteOpenRequest;
  picker?: StartPicker;
};

/**
 * Plain text first, media after (CLAUDE.md, Nav shell). `picture` keeps its key although it is
 * labelled "Image": stored dial orders are written in keys.
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
    editing: { id: null },
    picker: { accept: 'image/*' },
  },
  {
    key: 'camera',
    Icon: Camera,
    labelKey: 'notes.capture.camera',
    editing: { id: null },
    picker: { accept: 'image/*', capture: 'environment' },
  },
];
