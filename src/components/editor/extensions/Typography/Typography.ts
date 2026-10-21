import { InputRule } from '@tiptap/core';
import { Typography as TiptapTypography } from '@tiptap/extension-typography';
import type { EditorState } from '@tiptap/pm/state';

/** Before the closing `$$` turns it into a math node, typed LaTeX is plain text in the paragraph. */
function insideOpenFormula(state: EditorState, at: number) {
  const $at = state.doc.resolve(at);
  const before = $at.parent.textBetween(0, $at.parentOffset, undefined, '￼');
  return (before.match(/\${2,3}/g)?.length ?? 0) % 2 === 1;
}

/** Upstream's rules, minus inside a formula still being typed: `x^2` and `->` there are LaTeX. */
export const Typography = TiptapTypography.extend({
  addInputRules() {
    return (this.parent?.() ?? []).map(
      (rule) =>
        new InputRule({
          find: rule.find,
          undoable: rule.undoable,
          handler: (props) =>
            insideOpenFormula(props.state, props.range.from) ? null : rule.handler(props),
        })
    );
  },
});
