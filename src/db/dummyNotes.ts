import { v4 as uuid } from 'uuid';
import type { Note } from '@/models.ts';

const now = new Date(Date.now()).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

/**
 * The dead `Note.checklist` array was removed in the M4 Slice 1 schema bump
 * (ADR 0009); a checklist is now ordinary Body content, so the sample notes
 * that used to carry one carry a TipTap task list instead.
 */
const taskList = (items: string[]) =>
  `<ul data-type="taskList">${items
    .map((item) => `<li data-type="taskItem" data-checked="false"><p>${item}</p></li>`)
    .join('')}</ul>`;

const paragraph = (text: string) => `<p>${text}</p>`;

export const dummyNotes: Note[] = [
  // Only header
  {
    id: uuid(),
    header: 'Quick Note',
    state: 'active',
    createdAt: now,
    updatedAt: now,
  },
  // Header + description, pinned
  {
    id: uuid(),
    header: 'Meeting Agenda',
    description: 'Topics to discuss during the Monday meeting.',
    body: paragraph('Roadmap review, hiring, and the Q3 retro.'),
    state: 'active',
    pinnedAt: daysAgo(1),
    color: 'blue',
    createdAt: now,
    updatedAt: now,
  },
  // Checklist body only
  {
    id: uuid(),
    body: taskList(['Buy groceries', 'Pick up laundry', 'Call mom']),
    state: 'active',
    createdAt: now,
    updatedAt: now,
  },
  // Header + checklist body, pinned + coloured
  {
    id: uuid(),
    header: 'Workout Routine',
    body: taskList(['Push-ups', 'Squats', 'Plank']),
    state: 'active',
    pinnedAt: daysAgo(3),
    color: 'green',
    createdAt: now,
    updatedAt: now,
  },
  // Full note
  {
    id: uuid(),
    header: 'Vacation Plan',
    description: 'Organize summer trip details',
    body: taskList(['Book flight', 'Reserve hotel', 'Pack clothes']),
    state: 'active',
    color: 'yellow',
    createdAt: now,
    updatedAt: now,
  },
  // Header only
  {
    id: uuid(),
    header: 'Ideas for blog',
    state: 'active',
    createdAt: now,
    updatedAt: now,
  },
  // Archived: kept, but out of the feed
  {
    id: uuid(),
    header: 'Recipe: Pancakes',
    description: 'Fluffy pancakes with syrup and butter',
    body: paragraph('Whisk, rest the batter 10 minutes, then fry on medium heat.'),
    state: 'archived',
    createdAt: now,
    updatedAt: now,
  },
  // Archived + coloured
  {
    id: uuid(),
    body: taskList(['Read chapter 4', 'Complete exercises', 'Review notes']),
    state: 'archived',
    color: 'purple',
    createdAt: now,
    updatedAt: now,
  },
  // Trashed recently: restorable, well inside the 30-day grace period
  {
    id: uuid(),
    header: 'Language Practice',
    description: 'New German words for today',
    body: taskList(['Apfel', 'Brot', 'Milch']),
    state: 'trashed',
    trashedAt: daysAgo(2),
    createdAt: now,
    updatedAt: now,
  },
  // Trashed long ago: the startup purge sweep should reclaim this one
  {
    id: uuid(),
    header: 'Gift Ideas',
    state: 'trashed',
    trashedAt: daysAgo(45),
    createdAt: now,
    updatedAt: now,
  },
];
