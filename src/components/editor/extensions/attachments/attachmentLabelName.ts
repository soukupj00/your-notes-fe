import { isGenericName } from '@/lib/attachments.ts';
import { formatDate } from '@/lib/format.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';
import type { AttachmentDeps } from './deps';

/** To the second, so two recordings made a moment apart still differ. */
const MADE_AT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'medium' };

/**
 * What an attachment's controls are named by, so two in one Note differ: the file name the user
 * gave, else its kind and its row's time (for a drawing, its last Save, which mints a new row).
 * `row` is absent while it loads or when it is lost.
 */
export function attachmentLabelName(
  kind: AttachmentKind,
  row: Attachment | null | undefined,
  { t, locale }: Pick<AttachmentDeps, 't' | 'locale'>
): string {
  const kindName = t(`editor.${kind}.label`).toLocaleLowerCase(locale);
  if (!row) return kindName;
  if (row.name && !isGenericName(kind, row.name)) return row.name;
  return t('editor.attachment.madeAt', {
    kind: kindName,
    time: formatDate(row.createdAt, locale, MADE_AT),
  });
}
