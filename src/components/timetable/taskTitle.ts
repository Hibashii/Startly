import type { Task } from '@/types'
import { nameOf } from '@/i18n'
import type { useT } from '@/i18n/useT'

/** A task's name on screen: the rest of a split task shows as "X (cont.)" in the app's language. */
export const taskTitle = (task: Task, t: ReturnType<typeof useT>) => t.taskName(nameOf(task))
