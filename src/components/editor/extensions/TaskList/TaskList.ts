import { TaskList as TiptapTaskList } from '@tiptap/extension-list';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { toggleWholeList } from '../list-toggle';
import { withButton } from '../withButton';

export const TaskList = withButton(TiptapTaskList, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => toggleWholeList(editor, (chain) => chain.toggleTaskList()),
    isActive: () => editor.isActive('taskList'),
    icon: 'ListTodo',
    shortcutKeys: ['Mod', 'Shift', '9'],
    tooltip: t('editor.taskList.tooltip'),
    toggle: true,
  },
}));
