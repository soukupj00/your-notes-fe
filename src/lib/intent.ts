/**
 * The one-shot half of opening a Note (CONTEXT.md "Intent"): what the Editor does as it opens,
 * beyond showing the Note. A gesture carries at most one, in React state and never in the URL
 * (ADR 0014); `useOpenNote` spends it when the open ends.
 */
export type Intent =
  | { kind: 'checklist' }
  | { kind: 'record' }
  | { kind: 'draw' }
  | { kind: 'files'; files: File[] }
  | { kind: 'play' };
