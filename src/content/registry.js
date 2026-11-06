// Реестр контента: все задачи, уроки и записки игры собираются здесь (движок и тесты берут данные отсюда)
import { PROBLEMS as P0 } from './prologue/problems.js';
import { NOTES as N0 } from './prologue/story.js';
import { LESSON_L0 } from './prologue/lesson.js';

export const ALL_PROBLEMS = { ...P0 };
export const ALL_LESSONS = { L0: LESSON_L0 };
export const ALL_NOTES = { ...N0 };
