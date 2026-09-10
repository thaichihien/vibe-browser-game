/* Họ STYLE. */

import { pick } from '../engine/rng.js';

export const S01 = {
  id: 'S01', family: 'STYLE', label: 'Một chữ sai phông chữ',
  slots: ['paragraph', 'hero-title', 'notice'], weight: 3,
  apply(ctx) {
    /* The word is taken FROM THE ELEMENT'S OWN TEXT, never from a fixed list.
       An earlier version carried its own words ('mong', 'luôn', 'nhớ') and bailed out when
       the paragraph did not contain one — which, on this chapter, was always. The anomaly
       then marked nothing at all, so it could never be captured and the run could never be
       won. An anomaly that can silently decline to exist is worse than one that is too easy. */
    const entry = pick(ctx.rng, ctx.flavour);
    const text = ctx.slot.textContent.replace(/\s+/g, ' ').trim();

    // Skip the shortest words: a reskinned "và" is invisible, and the point is that the
    // word is unremarkable, not that it is unreadable.
    const words = [...new Set(text.split(' ').filter((w) => w.replace(/[.,:;!?()"'“”]/g, '').length >= 4))];
    if (!words.length) return;

    const raw = pick(ctx.rng, words);
    const word = raw.replace(/[.,:;!?()"'“”]/g, '');
    if (!word) return;

    const span = document.createElement('span');
    span.textContent = word;
    span.style.fontFamily = entry.family;
    span.style.letterSpacing = '0.06em';

    const at = text.indexOf(word);
    ctx.slot.textContent = '';
    ctx.slot.append(text.slice(0, at), span, text.slice(at + word.length));
    ctx.mark(span);
  }
};

export const S05 = {
  id: 'S05', family: 'STYLE', label: 'Chú thích không khớp với tấm ảnh', slots: ['gallery-caption', 'avatar', 'photo'], weight: 3,
  apply(ctx) {
    // Ảnh đã được ghim (pinned) nên chú thích được viết đối chọi với một bức ảnh ĐÃ BIẾT.
    ctx.slot.textContent = pick(ctx.rng, ctx.flavour);
    ctx.mark(ctx.slot);
  }
};

export const S07 = {
  id: 'S07', family: 'STYLE', label: 'Emoji lạc loài giữa các biểu tượng', slots: ['feature-icon', 'tile', 'nav'], weight: 4,
  apply(ctx) {
    ctx.slot.textContent = pick(ctx.rng, ctx.flavour);
    ctx.mark(ctx.slot);
  }
};

export const STYLE_ANOMALIES = [S01, S05, S07];
