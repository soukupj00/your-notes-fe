/**
 * Names a control by its own `aria-label` followed by another element's text, "Archive Groceries":
 * listed in its own `aria-labelledby`, a control contributes its `aria-label`.
 */
export function labelledWith(ownId: string, nameId: string | undefined) {
  return nameId ? { id: ownId, 'aria-labelledby': `${ownId} ${nameId}` } : {};
}
