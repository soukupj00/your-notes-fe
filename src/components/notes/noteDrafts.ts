import { taskListMarkup } from '@/lib/body.ts';

/** TipTap HTML for a checklist that opens with one empty item ready to type. */
export const EMPTY_CHECKLIST_BODY = taskListMarkup([['', false]]);
