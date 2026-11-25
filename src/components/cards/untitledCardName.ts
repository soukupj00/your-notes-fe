import { extractBodyAttachments, stripAttachmentNodes } from '@/lib/body.ts';
import { stripHtml } from '@/lib/utils.ts';
import type { AttachmentKind } from '@/models.ts';

const NAME_LENGTH = 40;
const LINE_END = /<\/(?:p|li|h[1-6]|blockquote|pre)>|<br\s*\/?>/i;

const KIND_NAME: Record<AttachmentKind, string> = {
  image: 'notes.attachmentImage',
  video: 'notes.attachmentVideo',
  audio: 'notes.attachmentAudio',
  file: 'notes.attachmentFile',
  excalidraw: 'notes.attachmentDrawing',
};

/** An untitled Card is named by its first line of prose, else its first attachment's kind. */
export function untitledCardName(body: string | undefined, t: (key: string) => string): string {
  const line = stripAttachmentNodes(body).split(LINE_END).map(stripHtml).find(Boolean);
  if (line) return shorten(line);
  const [first] = extractBodyAttachments(body);
  return t(first ? KIND_NAME[first.kind] : 'notes.untitled');
}

/** Cuts at a word, since a name is heard, not seen. */
function shorten(line: string): string {
  if (line.length <= NAME_LENGTH) return line;
  const words = line.slice(0, NAME_LENGTH + 1).split(/\s+/);
  words.pop();
  // By code point, so an emoji is never cut in half.
  return `${words.join(' ') || Array.from(line).slice(0, NAME_LENGTH).join('')}…`;
}
