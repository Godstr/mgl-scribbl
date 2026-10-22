// Интерфэйсийн SVG дүрсүүд
const st = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  brush: svg(`<path d="M19.2 2.8a2.3 2.3 0 0 1 3.2 3.2L13 15.4 9.8 12.2z" fill="currentColor" opacity=".25"/><path d="M19.2 2.8a2.3 2.3 0 0 1 3.2 3.2L13 15.4 9.8 12.2z" ${st}/><path d="M9.6 12.6c-2.7-.3-4.6 1.4-4.8 3.7-.2 1.7-1 2.8-2.6 3.4 1.7 1.8 4.6 2.3 7 1.3 2.2-.9 3.4-3.1 2.9-5.7" ${st}/>`),
  bucket: svg(`<path d="M3.5 12.4 11.6 4.3l7.6 7.6-6.4 6.4a2 2 0 0 1-2.8 0l-6.5-6.5a1 1 0 0 1 0-1.4z" fill="currentColor" opacity=".25"/><path d="M3.5 12.4 11.6 4.3l7.6 7.6-6.4 6.4a2 2 0 0 1-2.8 0l-6.5-6.5a1 1 0 0 1 0-1.4zM8 2l5.5 5.5M3 12h16" ${st}/><path d="M21.5 20a1.8 1.8 0 1 1-3.6 0c0-1.4 1.5-2.2 1.8-3.8.3 1.6 1.8 2.4 1.8 3.8z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`),
  undo: svg(`<path d="M9 14 4 9l5-5" ${st}/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H10" ${st}/>`),
  trash: svg(`<path d="M3.5 6h17M9 6V4.2A1.2 1.2 0 0 1 10.2 3h3.6A1.2 1.2 0 0 1 15 4.2V6M18.5 6l-.9 13.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5.5 6M10 10.5v6M14 10.5v6" ${st}/>`),
  gear: svg(`<path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" ${st}/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.7 7.7 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.7 7.7 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.7 7.7 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.7 7.7 0 0 0 2.6-1.5l2.4.9 2-3.4z" ${st}/>`),
  pencil: svg(`<path d="M15.6 3.6a2.4 2.4 0 0 1 3.4 0l1.4 1.4a2.4 2.4 0 0 1 0 3.4L8.7 20.1 3 21l.9-5.7z" fill="#ffd34d" stroke="#1d1d2b" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.4 5.8 4.8 4.8" stroke="#1d1d2b" stroke-width="1.8"/><path d="M3.9 15.3 3 21l5.7-.9" fill="#f6d7a7" stroke="#1d1d2b" stroke-width="1.8" stroke-linejoin="round"/>`),
  thumbUp: svg(`<path d="M7 10.5v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM7 10.5l4-7.5a2.6 2.6 0 0 1 2.6 2.6V9h5.3a2 2 0 0 1 2 2.3l-1.2 7.4a2 2 0 0 1-2 1.8H7" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`),
  thumbDown: svg(`<path d="M17 13.5v-10h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1zM17 13.5l-4 7.5a2.6 2.6 0 0 1-2.6-2.6V15H5.1a2 2 0 0 1-2-2.3l1.2-7.4a2 2 0 0 1 2-1.8H17" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`),
  dice: svg(`<rect x="3" y="3" width="18" height="18" rx="4" fill="#fff" stroke="#1d1d2b" stroke-width="2"/><circle cx="8" cy="8" r="1.7" fill="#1d1d2b"/><circle cx="16" cy="8" r="1.7" fill="#1d1d2b"/><circle cx="12" cy="12" r="1.7" fill="#1d1d2b"/><circle cx="8" cy="16" r="1.7" fill="#1d1d2b"/><circle cx="16" cy="16" r="1.7" fill="#1d1d2b"/>`),
  star: svg(`<path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.6-4.4 6.3-.9z" fill="#ffd34d" stroke="#1d1d2b" stroke-width="1.8" stroke-linejoin="round"/>`),
  users: svg(`<circle cx="9" cy="8" r="3.6" ${st}/><path d="M2.5 20.5c.4-3.7 3.1-6 6.5-6s6.1 2.3 6.5 6" ${st}/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.2 14.6c1.9.8 3.1 2.8 3.3 5.9" ${st}/>`),
  clock: svg(`<circle cx="12" cy="12" r="9" ${st}/><path d="M12 7v5l3.2 2" ${st}/>`),
  rounds: svg(`<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" ${st}/>`),
  words: svg(`<path d="M4 6h16M4 12h10M4 18h13" ${st}/>`),
  bulb: svg(`<path d="M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.2.9 2V17h6v-.8c0-.8.3-1.5.9-2A6.5 6.5 0 0 0 12 2.5z" ${st}/>`),
  link: svg(`<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1 1" ${st}/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1-1" ${st}/>`),
  volume: svg(`<path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" ${st}/>`),
  door: svg(`<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h8M10 12h11M17.5 8.5 21 12l-3.5 3.5" ${st}/>`),
  kick: svg(`<circle cx="9" cy="8" r="3.6" ${st}/><path d="M2.5 20.5c.4-3.7 3.1-6 6.5-6 1.6 0 3 .5 4.1 1.4M16 13l5 5M21 13l-5 5" ${st}/>`),
  ban: svg(`<circle cx="12" cy="12" r="9" ${st}/><path d="M5.6 5.6l12.8 12.8" ${st}/>`),
  mute: svg(`<path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 9.5l5 5M21 9.5l-5 5" ${st}/>`),
  vote: svg(`<path d="M5 11V6.5a1.5 1.5 0 0 1 3 0V11M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V5.5a1.5 1.5 0 0 1 3 0V11M14 11V8a1.5 1.5 0 0 1 3 0v6.5a7 7 0 0 1-7 7h-.6a6 6 0 0 1-4.6-2.2L2.6 16a1.6 1.6 0 0 1 2.4-2.1L6.5 15V11" ${st}/>`),
  help: svg(`<circle cx="12" cy="12" r="9.5" ${st}/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 4.3M12 17.6v.1" ${st}/>`),
  news: svg(`<path d="M4 4.5h12.5v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z" ${st}/><path d="M16.5 8.5H20v10a2 2 0 0 1-4 0M7.5 8.5h5.5M7.5 12h5.5M7.5 15.5h3.5" ${st}/>`),
  copy: svg(`<rect x="8.5" y="8.5" width="12" height="12" rx="2" ${st}/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5" ${st}/>`),
  chevron: svg(`<path d="M9 4l8 8-8 8" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  alarm: svg(`<circle cx="24" cy="27" r="17" fill="#fff" stroke="#1d1d2b" stroke-width="3.5"/><path d="M7 12.5a7 7 0 0 1 10-6M41 12.5a7 7 0 0 0-10-6" fill="none" stroke="#1d1d2b" stroke-width="4" stroke-linecap="round"/><path d="M14 43l-3 3M34 43l3 3" stroke="#1d1d2b" stroke-width="4" stroke-linecap="round"/>`, '0 0 48 48'),
};
