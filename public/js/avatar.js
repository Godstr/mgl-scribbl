// Тоглогчийн аватар (өнгө, нүд, ам) — SVG мөр үүсгэнэ. DOM ашигладаггүй.

const INK = '#1d1d2b';
const S = `fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"`;

export const AV_COLORS = [
  '#ef3b2d', '#ff8a1f', '#ffd93b', '#8ee03a', '#33cc5a', '#1fc7a5', '#38c9f5', '#3b7cf0',
  '#5b4ee8', '#a55bf0', '#e85ad8', '#ff74a8', '#c58a5c', '#f2c49b', '#8a5a36', '#9aa5ad',
  '#f4f4f4', '#4a4a5e',
];

const white = (x, y, r = 10) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
const pupil = (x, y, r = 5) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="#fff"/>`;
const heart = (x, y) =>
  `<path d="M${x} ${y + 8}C${x - 11} ${y + 1} ${x - 10} ${y - 9} ${x - 4.5} ${y - 9}C${x - 1.5} ${y - 9} ${x} ${y - 6.5} ${x} ${y - 5}C${x} ${y - 6.5} ${x + 1.5} ${y - 9} ${x + 4.5} ${y - 9}C${x + 10} ${y - 9} ${x + 11} ${y + 1} ${x} ${y + 8}Z" fill="#ff3d6e" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;

function star(x, y) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 4.6 : 11;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="#ffd93b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
}

function spiral(x, y) {
  let d = '';
  for (let t = 0; t <= Math.PI * 5; t += 0.3) {
    const r = 0.7 * t;
    d += `${d ? 'L' : 'M'}${(x + r * Math.cos(t)).toFixed(1)} ${(y + r * Math.sin(t)).toFixed(1)}`;
  }
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
}

// Нүд: [нэр, функц(толгойн өнгө)]
const EYES = [
  () => pupil(35, 44, 6) + pupil(65, 44, 6),
  () => white(35, 43) + white(65, 43) + pupil(37, 45) + pupil(67, 45),
  () => `<path d="M26 47Q35 36 44 47M56 47Q65 36 74 47" ${S}/>`,
  (c) => white(35, 45, 9.5) + white(65, 45, 9.5) + pupil(35, 49, 4.5) + pupil(65, 49, 4.5)
    + `<path d="M25.5 45A9.5 9.5 0 0 1 44.5 45ZM55.5 45A9.5 9.5 0 0 1 74.5 45Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  () => white(35, 46, 9) + white(65, 46, 9) + pupil(37, 48, 4.5) + pupil(63, 48, 4.5)
    + `<path d="M23 33L45 40M77 33L55 40" ${S} stroke-width="5"/>`,
  () => white(34, 43, 12.5) + white(66, 43, 12.5)
    + `<circle cx="35" cy="45" r="8" fill="${INK}"/><circle cx="67" cy="45" r="8" fill="${INK}"/><circle cx="38.5" cy="41" r="2.8" fill="#fff"/><circle cx="70.5" cy="41" r="2.8" fill="#fff"/><circle cx="32.5" cy="48.5" r="1.5" fill="#fff"/><circle cx="64.5" cy="48.5" r="1.5" fill="#fff"/>`,
  () => pupil(35, 44, 6) + `<path d="M56 46Q65 37 74 46" ${S}/>`,
  () => `<circle cx="34" cy="44" r="11.5" fill="#fff" fill-opacity=".5" stroke="${INK}" stroke-width="3.5"/><circle cx="66" cy="44" r="11.5" fill="#fff" fill-opacity=".5" stroke="${INK}" stroke-width="3.5"/><path d="M45.5 43Q50 39.5 54.5 43M22.5 42L12 38M77.5 42L88 38" ${S} stroke-width="3.5"/>`
    + pupil(35, 45, 4) + pupil(67, 45, 4),
  () => `<path d="M19 37H47V43C47 51 41 55 33.5 55C25.5 55 19 50 19 43ZM53 37H81V43C81 51 74.5 55 66.5 55C59 55 53 51 53 43Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M47 40Q50 38 53 40" ${S} stroke-width="3.5"/><path d="M24 42.5H31M58 42.5H65" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>`,
  () => `<path d="M29 38L41 50M41 38L29 50M59 38L71 50M71 38L59 50" ${S}/>`,
  () => heart(35, 45) + heart(65, 45),
  () => star(35, 44) + star(65, 44),
  () => spiral(35, 44) + spiral(65, 44),
  () => white(35, 44) + white(65, 44) + pupil(40.5, 44, 4.6) + pupil(70.5, 44, 4.6),
  () => `<path d="M27 42Q35 49 43 42M57 42Q65 49 73 42" ${S}/><path d="M30 49C26.5 54.5 27 59 30 59S33.5 54.5 30 49ZM70 49C66.5 54.5 67 59 70 59S73.5 54.5 70 49Z" fill="#5ec8ff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
  () => `<path d="M27 45H43M57 45H73" ${S}/>`,
];

const PINK = '#ff6b81';
const MOUTHS = [
  () => `<path d="M35 63Q50 78 65 63" ${S}/>`,
  () => `<path d="M32 61H68Q67 82 50 82Q33 82 32 61Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M35.5 63.5H64.5Q64 67.5 63 68.5Q50 70 37 68.5Q36 67.5 35.5 63.5Z" fill="#fff"/><path d="M41 78.5Q50 72 59 78.5Q50 82 41 78.5Z" fill="${PINK}"/>`,
  () => `<path d="M38 69H62" ${S}/>`,
  () => `<ellipse cx="50" cy="70" rx="7.5" ry="9" fill="${INK}"/><ellipse cx="50" cy="74" rx="4.2" ry="3" fill="${PINK}"/>`,
  () => `<path d="M45.5 69Q45.5 82 51 82Q56.5 82 56.5 69Z" fill="${PINK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M51 71V77" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".45"/><path d="M36 65Q50 75 64 65" ${S}/>`,
  () => `<path d="M36 75Q50 61 64 75" ${S}/>`,
  () => `<path d="M36 65Q43 74 50 66Q57 74 64 65" ${S}/>`,
  () => `<rect x="33" y="62" width="34" height="14" rx="5" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M34 69H66M41.5 62.5V75.5M50 62.5V75.5M58.5 62.5V75.5" stroke="${INK}" stroke-width="2.5"/>`,
  () => `<path d="M37 70Q53 74 64 62" ${S}/><path d="M61.5 60L66.5 64" ${S} stroke-width="3.5"/>`,
  () => `<path d="M50 62.5C45.5 57 35 57.5 29.5 64.5C34.5 63 38.5 66.5 42 66.5C45.5 66.5 48 64.5 50 63.5C52 64.5 54.5 66.5 58 66.5C61.5 66.5 65.5 63 70.5 64.5C65 57.5 54.5 57 50 62.5Z" fill="${INK}"/><path d="M42 73Q50 78 58 73" ${S} stroke-width="3.5"/>`,
  () => `<path d="M34 63Q50 81 66 63Q50 70 34 63Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M39.5 65.3L43 73L46 66.8ZM60.5 65.3L57 73L54 66.8Z" fill="#fff"/>`,
  () => `<path d="M33 69Q37.25 63 41.5 69T50 69T58.5 69T67 69" ${S}/>`,
  () => `<path d="M46 62Q56 64.5 48 68.5Q56 72.5 46 75.5" ${S} stroke-width="4"/><ellipse cx="29" cy="63" rx="5" ry="3.4" fill="${PINK}" opacity=".5"/><ellipse cx="71" cy="63" rx="5" ry="3.4" fill="${PINK}" opacity=".5"/>`,
  () => `<path d="M30 60Q50 63 70 60Q68 87 50 87Q32 87 30 60Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M38 81Q50 71 62 81Q50 88 38 81Z" fill="${PINK}"/>`,
  () => `<path d="M45 68.4H55V76.5Q50 77.6 45 76.5Z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 69V76.8" stroke="${INK}" stroke-width="2"/><path d="M35 64Q50 74 65 64" ${S}/>`,
];

export const AVATAR_COUNTS = [AV_COLORS.length, EYES.length, MOUTHS.length];

const mod = (v, n) => ((Math.trunc(Number(v) || 0) % n) + n) % n;

export function normalizeAvatar(av) {
  const a = Array.isArray(av) ? av : [];
  return AVATAR_COUNTS.map((n, i) => mod(a[i], n));
}

export function randomAvatar() {
  return AVATAR_COUNTS.map((n) => Math.floor(Math.random() * n));
}

const CROWN = `<g transform="translate(50 7) rotate(-14)"><path d="M-17 7L-20 -12L-9 -3L0 -17L9 -3L20 -12L17 7Z" fill="#ffd93b" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="0" cy="-17" r="3" fill="#ff5ba0" stroke="${INK}" stroke-width="2"/><circle cx="-20" cy="-12" r="2.5" fill="#38c9f5" stroke="${INK}" stroke-width="2"/><circle cx="20" cy="-12" r="2.5" fill="#38c9f5" stroke="${INK}" stroke-width="2"/></g>`;

export function avatarSVG(av, { crown = false, cls = '' } = {}) {
  const [c, e, m] = normalizeAvatar(av);
  const color = AV_COLORS[c];
  return `<svg class="avatar ${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false" overflow="visible">`
    + `<path d="M50 9C74 8 91 25 91 50C92 75 75 92 50 91C25 92 9 76 9 51C8 26 26 9 50 9Z" fill="${color}" stroke="${INK}" stroke-width="4.5"/>`
    + `<path d="M83 33C93 57 84 81 56 88C78 77 88 58 83 33Z" fill="#000" opacity=".13"/>`
    + `<ellipse cx="32" cy="26" rx="11" ry="6" transform="rotate(-32 32 26)" fill="#fff" opacity=".42"/>`
    + EYES[e](color)
    + MOUTHS[m](color)
    + (crown ? CROWN : '')
    + '</svg>';
}
