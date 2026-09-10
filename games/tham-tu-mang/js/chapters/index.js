/* Thứ tự chương = đường cong độ khó. Stage 2 và 3 thêm chương vào đây. */

import { CH1 } from './ch1-lumiere.js';

export const CHAPTERS = [CH1];

export const chapterById = (id) => CHAPTERS.find((c) => c.id === id) ?? null;
