import DOMPurify from 'dompurify';

/**
 * A Drawing's stored SVG preview, sanitized. Excalidraw draws a picture once as a `<symbol>` and
 * places it with `<use>`, which DOMPurify drops by default; a `<use>` is kept only in that shape,
 * so it can neither reach outside the preview nor grow a chain of clones.
 */
export function sanitizeDrawingPreview(svg: string): string {
  const host = document.createElement('div');
  host.append(sanitizeDrawingPreviewToNodes(svg));
  return host.innerHTML;
}

export function sanitizeDrawingPreviewToNodes(svg: string): DocumentFragment {
  const fragment = DOMPurify.sanitize(svg, { ADD_TAGS: ['use'], RETURN_DOM_FRAGMENT: true });
  for (const use of fragment.querySelectorAll('use')) {
    if (!placesAPicture(use)) use.remove();
  }
  return fragment;
}

/** Outside the definitions, naming a symbol of the same SVG that holds pictures and nothing else. */
function placesAPicture(use: Element): boolean {
  if (use.closest('defs, symbol')) return false;
  const refs = ['href', 'xlink:href'].flatMap((name) => use.getAttribute(name) ?? []);
  const id = refs[0]?.startsWith('#') ? refs[0].slice(1) : undefined;
  if (!id || refs.some((ref) => ref !== refs[0])) return false;
  const symbols = use.closest('svg')?.querySelectorAll('symbol') ?? [];
  const target = [...symbols].find((symbol) => symbol.id === id);
  const parts = [...(target?.querySelectorAll('*') ?? [])];
  return parts.length > 0 && parts.every((part) => part.localName === 'image');
}
