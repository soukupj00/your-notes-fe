import type { LucideIcon } from 'lucide-react';
import { Camera, Image, ListChecks, Mic, PencilRuler, SquarePen } from 'lucide-react';
import { ATTACHMENT_SPECS } from '@/lib/attachments.ts';
import type { Intent } from '@/lib/intent.ts';

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
  /** What the Editor does as the draft opens; a picker Start's Intent is the files it chose. */
  intent?: Intent;
  picker?: StartPicker;
};

/**
 * Plain text first, media after (CLAUDE.md, Nav shell). `picture` keeps its key although it is
 * labelled "Image": stored dial orders are written in keys.
 */
export const QUICK_CAPTURE_ACTIONS: QuickCaptureAction[] = [
  { key: 'text', Icon: SquarePen, labelKey: 'notes.capture.text' },
  {
    key: 'checklist',
    Icon: ListChecks,
    labelKey: 'notes.capture.checklist',
    intent: { kind: 'checklist' },
  },
  { key: 'audio', Icon: Mic, labelKey: 'notes.capture.audio', intent: { kind: 'record' } },
  {
    key: 'drawing',
    Icon: PencilRuler,
    labelKey: 'notes.capture.drawing',
    intent: { kind: 'draw' },
  },
  {
    key: 'picture',
    Icon: Image,
    labelKey: 'notes.capture.picture',
    picker: { accept: ATTACHMENT_SPECS.image.accept ?? '' },
  },
  {
    key: 'camera',
    Icon: Camera,
    labelKey: 'notes.capture.camera',
    picker: { accept: ATTACHMENT_SPECS.image.accept ?? '', capture: 'environment' },
  },
];
