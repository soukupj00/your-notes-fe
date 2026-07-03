import { type TaskListOptions, TaskList as TiptapTaskList } from '@tiptap/extension-list';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface TaskListExtensionOptions extends TaskListOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const TaskList = TiptapTaskList.extend<TaskListExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleTaskList(),
          isActive: () => editor.isActive('taskList'),
          icon: 'ListTodo',
          tooltip: t('editor.taskList.tooltip'),
          toggle: true,
        },
      }),
    } as unknown as TaskListExtensionOptions;
  },
});
