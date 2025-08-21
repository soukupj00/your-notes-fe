import { v4 as uuid } from 'uuid';

const now = Date.now();

export const dummyNotes = [
  // Only header
  {
    id: uuid(),
    header: 'Quick Note',
    description: undefined,
    checklist: [],
    createdAt: now,
    updatedAt: now,
  },
  // Header + description
  {
    id: uuid(),
    header: 'Meeting Agenda',
    description: 'Topics to discuss during the Monday meeting.',
    checklist: [],
    createdAt: now,
    updatedAt: now,
  },
  // Only checklist
  {
    id: uuid(),
    header: undefined,
    description: undefined,
    checklist: ['Buy groceries', 'Pick up laundry', 'Call mom'],
    createdAt: now,
    updatedAt: now,
  },
  // Header + checklist
  {
    id: uuid(),
    header: 'Workout Routine',
    description: undefined,
    checklist: ['Push-ups', 'Squats', 'Plank'],
    createdAt: now,
    updatedAt: now,
  },
  // Full note
  {
    id: uuid(),
    header: 'Vacation Plan',
    description: 'Organize summer trip details',
    checklist: ['Book flight', 'Reserve hotel', 'Pack clothes'],
    createdAt: now,
    updatedAt: now,
  },
  // Header only
  {
    id: uuid(),
    header: 'Ideas for blog',
    description: undefined,
    checklist: [],
    createdAt: now,
    updatedAt: now,
  },
  // Header + description
  {
    id: uuid(),
    header: 'Recipe: Pancakes',
    description: 'Fluffy pancakes with syrup and butter',
    checklist: [],
    createdAt: now,
    updatedAt: now,
  },
  // Checklist only
  {
    id: uuid(),
    header: undefined,
    description: undefined,
    checklist: ['Read chapter 4', 'Complete exercises', 'Review notes'],
    createdAt: now,
    updatedAt: now,
  },
  // Header + description + checklist
  {
    id: uuid(),
    header: 'Language Practice',
    description: 'New German words for today',
    checklist: ['Apfel', 'Brot', 'Milch'],
    createdAt: now,
    updatedAt: now,
  },
  // Header only
  {
    id: uuid(),
    header: 'Gift Ideas',
    description: undefined,
    checklist: [],
    createdAt: now,
    updatedAt: now,
  },
];
