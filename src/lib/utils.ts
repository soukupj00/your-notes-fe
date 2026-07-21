import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip HTML tags from a string, decode a few common entities, and collapse
 * whitespace. Used to turn the editor's rich-text `body` HTML into plain text
 * for search matching and card previews. Not a sanitizer - the input is our
 * own editor's output, so this only needs to be lossy-to-plaintext.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
