// Нүүр хуудас: нэр, аватар, тоглох товчнууд, "Хэрхэн тоглох"
import { AVATAR_COUNTS, avatarSVG, normalizeAvatar, randomAvatar } from './avatar.js';
import { ICONS } from './icons.js';

const $ = (s) => document.querySelector(s);

const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let avatar = normalizeAvatar(store.get('skribbl.avatar', randomAvatar()));
let clientId = store.get('skribbl.cid', null);
if (!clientId) {
  clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  store.set('skribbl.cid', clientId);
}

export let inviteCode = null;

const SLIDES = [
  ['Ээлж ирэхэд гурван үгээс нэгийг сонгоод, тэр үгээ зураарай!',
    '<path d="M40 128V76l52-38 52 38v52M26 86l66-50 66 50M80 128v-28h24v28M112 88h20v18h-20z"/><g transform="translate(188 46) rotate(35)"><path d="M-9-38h18v58H-9zM-9-26H9M-9 20 0 38 9 20"/></g>'],
  ['Бусад тоглогчид чатаар таамаглалаа бичиж, үгийг таахыг оролдоно.',
    '<path d="M28 26h120a12 12 0 0 1 12 12v32a12 12 0 0 1-12 12H66l-20 18V82H28a12 12 0 0 1-12-12V38a12 12 0 0 1 12-12z"/><path d="M150 96h56a12 12 0 0 1 12 12v18a12 12 0 0 1-12 12h-8v14l-16-14h-32a12 12 0 0 1-12-12v-18"/><text x="88" y="64" text-anchor="middle" font-size="26" fill="#fff" stroke="none" font-weight="900">нохой?</text><text x="186" y="128" text-anchor="middle" font-size="24" fill="#fff" stroke="none" font-weight="900">???</text>'],
  ['Хэдий чинээ хурдан таана, төдий чинээ их оноо авна!',
    '<circle cx="86" cy="80" r="50"/><path d="M86 48v32l22 14M60 20l-18 12M112 20l18 12"/><text x="196" y="76" text-anchor="middle" font-size="34" fill="#fff" stroke="none" font-weight="900">+400</text><path d="M168 104h56"/>'],
  ['Бусад тоглогчид таах тусам зураач ч мөн оноо авна.',
    '<circle cx="76" cy="84" r="46"/><circle cx="60" cy="74" r="5" fill="#fff"/><circle cx="92" cy="74" r="5" fill="#fff"/><path d="M58 98q18 16 36 0"/><g transform="translate(150 70) rotate(35)"><path d="M-9-38h18v58H-9zM-9-26H9M-9 20 0 38 9 20"/></g><text x="200" y="52" text-anchor="middle" font-size="30" fill="#fff" stroke="none" font-weight="900">+</text>'],
  ['Тоглоомын төгсгөлд хамгийн их оноотой тоглогч ялна!',
    '<path d="M88 26h64v34a32 32 0 0 1-64 0zM88 36H66a18 18 0 0 0 22 26M152 36h22a18 18 0 0 1-22 26M120 92v22M96 136h48l-6-22h-36z"/><path d="m120 36 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="#fff"/>'],
];

export function initHome({ onPlay, onCreate }) {
  // Лого доорх аватарууд
  const row = $('#logo-avatars');
  const colors = [0, 1, 2, 4, 6, 7, 9, 11];
  row.innerHTML = colors.map((c, i) => `<span class="logo-av" style="animation-delay:${i * -0.4}s"></span>`).join('');
  [...row.children].forEach((el, i) => {
    const draw = () => { el.innerHTML = avatarSVG([colors[i], rnd(AVATAR_COUNTS[1]), rnd(AVATAR_COUNTS[2])]); };
    draw();
    el.addEventListener('click', draw);
  });

  // Нэр
  const name = $('#name-input');
  name.value = store.get('skribbl.name', '');
  name.addEventListener('input', () => store.set('skribbl.name', name.value));
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-play').click(); });

  // Аватар
  document.querySelectorAll('.av-arrow').forEach((b) => {
    b.innerHTML = ICONS.chevron;
    b.addEventListener('click', () => {
      const part = Number(b.dataset.part);
      avatar[part] = (avatar[part] + Number(b.dataset.dir) + AVATAR_COUNTS[part]) % AVATAR_COUNTS[part];
      drawAvatar();
    });
  });
  $('#av-random').innerHTML = ICONS.dice;
  $('#av-random').addEventListener('click', () => { avatar = randomAvatar(); drawAvatar(); });
  drawAvatar();

  // Урилгын холбоос: /?кодноос
  const code = [...new URLSearchParams(location.search).keys()][0];
  if (code && /^[a-z0-9]{6,12}$/i.test(code)) {
    inviteCode = code.toLowerCase();
    $('#invite-note').classList.remove('hidden');
  }

  $('#btn-play').addEventListener('click', () => onPlay(profile(inviteCode)));
  $('#btn-create').addEventListener('click', () => onCreate(profile(null)));

  document.querySelectorAll('.info-icon').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
  initSlides();
}

function rnd(n) { return Math.floor(Math.random() * n); }

function drawAvatar() {
  $('#av-preview').innerHTML = avatarSVG(avatar);
  store.set('skribbl.avatar', avatar);
}

function profile(code) {
  return { name: $('#name-input').value.trim(), avatar, clientId, code: code || undefined };
}

export function clearInvite() {
  inviteCode = null;
  $('#invite-note').classList.add('hidden');
}

export function setHomeBusy(busy) {
  for (const id of ['#btn-play', '#btn-create']) $(id).disabled = busy;
  $('#btn-play').textContent = busy ? 'Холбогдож байна...' : 'Тоглох!';
  if (busy) showHomeError(null);
}

export function showHomeError(msg) {
  const el = $('#home-error');
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

function initSlides() {
  const box = $('#slides');
  const dots = $('#slide-dots');
  box.innerHTML = SLIDES.map(([text, art], i) => `
    <div class="slide${i ? '' : ' active'}">
      <svg viewBox="0 0 240 160" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" font-family="Nunito, sans-serif">${art}</g></svg>
      <p>${text}</p>
    </div>`).join('');
  dots.innerHTML = SLIDES.map((_, i) => `<button class="dot${i ? '' : ' active'}" aria-label="${i + 1}-р алхам"></button>`).join('');
  let cur = 0;
  const show = (i) => {
    cur = (i + SLIDES.length) % SLIDES.length;
    box.querySelectorAll('.slide').forEach((s, j) => s.classList.toggle('active', j === cur));
    dots.querySelectorAll('.dot').forEach((d, j) => d.classList.toggle('active', j === cur));
  };
  let timer = setInterval(() => show(cur + 1), 5000);
  dots.querySelectorAll('.dot').forEach((d, i) => d.addEventListener('click', () => {
    clearInterval(timer);
    show(i);
    timer = setInterval(() => show(cur + 1), 5000);
  }));
}
