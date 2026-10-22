import { TaskList as TiptapTaskList } from '@tiptap/extension-list';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { toggleWholeList } from '../list-toggle';
import { withButton } from '../withButton';
import { withoutKeys } from '../withoutKeys';

export const TaskList = withButton(
  withoutKeys(TiptapTaskList, ['Mod-Shift-9']),
  ({ editor, t }) => ({
    component: ActionButton,
    componentProps: {
      action: () => toggleWholeList(editor, (chain) => chain.toggleTaskList()),
      isActive: () => editor.isActive('taskList'),
      icon: 'ListTodo',
      tooltip: t('editor.taskList.tooltip'),
      toggle: true,
    },
  })
);
