/* Hotlinked photography — spec §3.4. Two rules carry this module:
   1. Every URL is PINNED. An unpinned URL returns a different photo each load, which
      silently breaks S05 (a caption written against a known image) and the IMAGE family.
   2. Every <img> degrades. These are free services with no uptime guarantee, so a dead CDN
      or an offline player must get a stylised placeholder, not a broken-image icon. */

const FLICKR = 'https://loremflickr.com';
const PICSUM = 'https://picsum.photos';

export function flickr({ w, h, kw, lock, grayscale = false, blur = 0 }) {
  if (lock === undefined || lock === null) {
    throw new Error('flickr(): lock is required — unpinned urls are a bug');
  }
  const path = grayscale ? `${FLICKR}/g/${w}/${h}/${kw}` : `${FLICKR}/${w}/${h}/${kw}`;
  const params = [`lock=${lock}`];
  if (blur > 0) params.push(`blur=${blur}`);
  return `${path}?${params.join('&')}`;
}

export function picsum({ w, h, id, grayscale = false, blur = 0 }) {
  if (id === undefined || id === null) {
    throw new Error('picsum(): id is required — unpinned urls are a bug');
  }
  const params = [];
  if (grayscale) params.push('grayscale');
  if (blur > 0) params.push(`blur=${blur}`);
  const q = params.length ? `?${params.join('&')}` : '';
  return `${PICSUM}/id/${id}/${w}/${h}${q}`;
}

/** A url is pinned if it names a specific photograph: a lock= param, or an /id/ segment. */
export function isPinned(url) {
  return /[?&]lock=\d+/.test(url) || /picsum\.photos\/id\/\d+\//.test(url);
}

/** A stylised stand-in built entirely from gradients and grain — no network, no assets. */
export function fallbackSvg({ w, h, tint, seed = 1 }) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<defs>` +
        `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0%" stop-color="${tint}" stop-opacity="0.85"/>` +
          `<stop offset="100%" stop-color="${tint}" stop-opacity="0.35"/>` +
        `</linearGradient>` +
        `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" ` +
          `numOctaves="2" seed="${seed}"/><feColorMatrix type="saturate" values="0"/></filter>` +
      `</defs>` +
      `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
      `<rect width="${w}" height="${h}" filter="url(#n)" opacity="0.18"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * The only <img> builder the sites use. Its onerror swaps in the fallback and then clears
 * itself, so a failing placeholder cannot loop.
 */
export function imgHtml({ src, alt, w, h, tint, cls = '' }) {
  if (!isPinned(src)) throw new Error(`imgHtml(): src must be pinned — got ${src}`);
  const fb = fallbackSvg({ w, h, tint, seed: (w + h) % 97 });
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<img class="${esc(cls)}" src="${esc(src)}" alt="${esc(alt)}" width="${w}" height="${h}" ` +
         `loading="lazy" onerror="this.onerror=null;this.src='${fb}'">`;
}
