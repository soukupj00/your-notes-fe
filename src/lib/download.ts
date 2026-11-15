/** Hands a Blob to the browser as a download. Fire-and-forget: the browser may
 *  still show its own "where to save?" dialog, and we never hear the outcome. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
