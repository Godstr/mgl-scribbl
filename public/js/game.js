// Тоглоомын дэлгэц
import { BRUSH_SIZES, DRAW_TIMES, LIMITS, PALETTE } from '/shared/constants.js';
import { avatarSVG } from './avatar.js';
import { Board } from './board.js';
import { ICONS } from './icons.js';
import * as sound from './sound.js';

const $ = (s, root = document) => root.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const S = {
  code: null, me: null, isPrivate: false, ownerId: null, settings: {},
  players: new Map(), phase: null, round: 0, rounds: 0, drawerId: null,
  endsAt: 0, offset: 0, word: null, hint: '', choices: null, reason: null,
  points: null, ranking: null, rated: false, muted: new Set(), lastShown: -1,
  lanUrl: null,
};

let socket;
let board;
let onExit;

const isDrawer = () => S.me === S.drawerId;
const isOwner = () => S.isPrivate && S.ownerId === S.me;
const inGame = () => ['round', 'choose', 'draw', 'turnEnd'].includes(S.phase);

// ---------------------------------------------------------------- init

export function initGame(sock, opts) {
  socket = sock;
  onExit = opts.onExit;
  board = new Board($('#canvas'), {
    send: (cmds) => socket.emit('draw', cmds),
    onUndo: () => socket.emit('undo'),
    onClear: () => socket.emit('clear'),
  });

  $('#clock').insertAdjacentHTML('afterbegin', ICONS.alarm);
  $('#btn-settings').innerHTML = ICONS.gear;
  $('#btn-settings').addEventListener('click', openSettings);
  $('#logo-small').addEventListener('click', (e) => { e.preventDefault(); leave(); });
  document.querySelectorAll('.rate-btn').forEach((b) => {
    b.innerHTML = b.dataset.like === '1' ? ICONS.thumbUp : ICONS.thumbDown;
    b.addEventListener('click', () => {
      socket.emit('rate', b.dataset.like === '1');
      S.rated = true;
      renderRate();
    });
  });

  buildToolbar();
  buildLobby();
  bindChat();
  bindKeys();

  $('#players-list').addEventListener('click', (e) => {
    const row = e.target.closest('.player');
    if (row) openPlayer(row.dataset.id);
  });
  $('#overlay-content').addEventListener('click', (e) => {
    const b = e.target.closest('.choice');
    if (!b) return;
    socket.emit('choose', Number(b.dataset.i));
    $('#overlay-content').querySelectorAll('.choice').forEach((x) => { x.disabled = true; });
  });

  socket.on('players', setPlayers);
  socket.on('phase', (s) => onPhase(s, false));
  socket.on('draw', (cmds) => board.apply(cmds));
  socket.on('undo', () => board.undo());
  socket.on('clear', () => board.reset());
  socket.on('hint', (h) => { S.hint = h; renderWord(); });
  socket.on('reveal', ({ word }) => { S.word = word; renderWord(); sound.play('myGuess'); });
  socket.on('chat', onChat);
  socket.on('sys', onSys);
  socket.on('settings', (s) => { S.settings = s; renderLobby(); });
  socket.on('kicked', ({ k }) => {
    exitToHome();
    modal(`<h3>${k === 'ban' ? 'Таныг энэ өрөөнд хориглолоо!' : 'Таныг өрөөнөөс хаслаа!'}</h3>`, [{ text: 'Ойлголоо', cls: 'btn-blue' }]);
  });

  fetch('/api/info').then((r) => r.json()).then((info) => {
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname) && info.lan?.length) S.lanUrl = info.lan[0];
  }).catch(() => {});

  setInterval(tickTimer, 200);
}

export function enterGame(d) {
  Object.assign(S, {
    code: d.code, me: d.me, isPrivate: d.isPrivate, settings: d.settings,
    muted: new Set(), rated: false, lastShown: -1,
  });
  $('#chat-log').innerHTML = '';
  setPlayers(d.players);
  board.reset();
  if (d.drawing?.length) board.apply(d.drawing);
  onPhase(d.state, true);
  history.replaceState(null, '', d.isPrivate ? `/?${d.code}` : '/');
  if (d.isPrivate && d.state.phase === 'lobby') sysMsg('Найзуудаа урихын тулд «Урих» товчоор холбоосыг хуулж илгээгээрэй!', 'blue');
  sound.play('join');
}

export const isInGame = () => S.code !== null;

function leave() {
  socket.emit('leave');
  exitToHome();
}

function exitToHome() {
  S.code = null;
  board.setEnabled(false);
  closeModal();
  onExit();
}

export function gameError(k) {
  const msg = {
    notEnough: 'Тоглоом эхлүүлэхэд дор хаяж 2 тоглогч хэрэгтэй!',
    customWords: `Зөвхөн өөрийн үгсийг ашиглахын тулд дор хаяж ${LIMITS.customWordsMin} үг оруулна уу!`,
  }[k] || 'Алдаа гарлаа. Дахин оролдоно уу.';
  toast(msg);
}

export function connectionLost() {
  if (!S.code) return;
  exitToHome();
  modal('<h3>Сервертэй холболт тасарлаа!</h3><p>Интернэт холболтоо шалгаад дахин нэгдэнэ үү.</p>', [{ text: 'Ойлголоо', cls: 'btn-blue' }]);
}

// ---------------------------------------------------------------- state

function setPlayers({ ownerId, list }) {
  S.ownerId = ownerId;
  S.players = new Map(list.map((p) => [p.id, p]));
  renderPlayers();
  renderLobby();
  if (S.phase === 'choose' && !isDrawer()) renderOverlay();
}

function onPhase(s, initial) {
  const prev = S.phase;
  S.offset = s.now - Date.now();
  Object.assign(S, {
    phase: s.phase, round: s.round, rounds: s.rounds, drawerId: s.drawerId, endsAt: s.endsAt,
    choices: s.choices || null, hint: s.hint || '', word: s.word || null,
    reason: s.reason || null, points: s.points || null, ranking: s.ranking || null,
  });
  if (['choose', 'lobby', 'waiting', 'round'].includes(s.phase) && !initial) board.reset();
  if (s.phase === 'draw' && prev !== 'draw') S.rated = false;
  if (!initial && prev !== s.phase) {
    if (s.phase === 'round') sound.play('round');
    else if (s.phase === 'choose' && isDrawer()) sound.play('choose');
    else if (s.phase === 'turnEnd') sound.play('turnEnd');
    else if (s.phase === 'gameEnd') sound.play('gameEnd');
  }
  if (s.phase === 'draw' && isDrawer()) {
    board.setColor(13);
    board.setSize(1);
    setTool('brush');
  }
  board.setEnabled(s.phase === 'draw' && isDrawer());
  S.lastShown = -1;
  renderAll();
}

function renderAll() {
  renderBar();
  renderPlayers();
  renderOverlay();
  renderTools();
  renderRate();
  renderLobby();
}

// ---------------------------------------------------------------- top bar

function renderBar() {
  $('#round-text').textContent = inGame() || S.phase === 'gameEnd'
    ? `Үе ${Math.max(1, S.round)} / ${S.rounds}` : '';
  renderWord();
}

function renderWord() {
  const label = $('#word-label');
  const el = $('#word');
  el.className = 'word';
  if (S.phase === 'draw') {
    if (isDrawer()) {
      label.textContent = 'ЗУРАХ ҮГ';
      el.innerHTML = wordHTML(S.word, false);
    } else if (S.word) {
      label.textContent = 'ТААХ ҮГ';
      el.innerHTML = wordHTML(S.word, false);
      el.classList.add('guessed');
    } else {
      label.textContent = 'ТААХ ҮГ';
      el.innerHTML = wordHTML(S.hint, true);
    }
  } else if (S.phase === 'turnEnd' && S.word) {
    label.textContent = 'ҮГ НЬ';
    el.innerHTML = wordHTML(S.word, false);
  } else {
    label.textContent = 'ХҮЛЭЭЖ БАЙНА';
    el.innerHTML = '';
  }
}

function wordHTML(w, isHint) {
  if (!w) return '';
  const parts = w.split(' ');
  const html = parts.map((p) => `<span class="w">${Array.from(p, (ch) => (ch === '_' && isHint
    ? '<span class="ch blank"></span>'
    : `<span class="ch">${esc(ch)}</span>`)).join('')}</span>`).join('<span class="gap"></span>');
  const count = isHint ? `<sup class="count">${parts.map((p) => Array.from(p).length).join(' ')}</sup>` : '';
  return html + count;
}

function tickTimer() {
  if (!S.code) return;
  const timed = S.phase === 'draw' || S.phase === 'choose';
  const left = timed && S.endsAt ? Math.max(0, Math.ceil((S.endsAt - (Date.now() + S.offset)) / 1000)) : 0;
  if (left === S.lastShown) return;
  S.lastShown = left;
  $('#timer').textContent = left;
  const urgent = S.phase === 'draw' && left > 0 && left <= 10;
  $('#clock').classList.toggle('urgent', urgent);
  if (urgent) sound.play('tick');
}

// ---------------------------------------------------------------- players

function renderPlayers() {
  const list = [...S.players.values()];
  const scores = list.map((p) => p.score).sort((a, b) => b - a);
  const top = scores[0] > 0 ? scores[0] : null;
  $('#players-list').innerHTML = list.map((p) => {
    const rank = scores.indexOf(p.score) + 1;
    const me = p.id === S.me;
    return `<div class="player${p.guessed ? ' guessed' : ''}${me ? ' me' : ''}" data-id="${esc(p.id)}" title="${esc(p.name)}">
      <div class="rank">#${rank}</div>
      <div class="info">
        <div class="name">${esc(p.name)}${me ? ' (Та)' : ''}</div>
        <div class="score">${p.score} оноо</div>
      </div>
      <div class="badges">
        ${p.id === S.drawerId && (inGame()) ? `<span class="badge pen">${ICONS.pencil}</span>` : ''}
        ${S.isPrivate && p.id === S.ownerId ? `<span class="badge" title="Өрөөний эзэн">${ICONS.star}</span>` : ''}
        ${S.muted.has(p.id) ? `<span class="badge muted" title="Дуугүй болгосон">${ICONS.mute}</span>` : ''}
      </div>
      <div class="av">${avatarSVG(p.avatar, { crown: top !== null && p.score === top })}</div>
    </div>`;
  }).join('');
}

// ---------------------------------------------------------------- overlay

const REASONS = {
  time: 'Хугацаа дууслаа!',
  allGuessed: 'Бүгд үгийг таалаа!',
  drawerLeft: 'Зураач тоглоомоос гарлаа!',
};

function renderOverlay() {
  const ov = $('#overlay');
  const box = $('#overlay-content');
  let html = null;
  const drawer = S.players.get(S.drawerId);

  if (S.phase === 'waiting') {
    html = `<div class="ov-text">Тоглогчдыг хүлээж байна...</div>
      <div class="ov-sub">Өрөөнд 2 ба түүнээс дээш тоглогч орж ирэхэд тоглоом автоматаар эхэлнэ.</div>`;
  } else if (S.phase === 'round') {
    html = `<div class="ov-title">Үе ${S.round}</div><div class="ov-sub">Нийт ${S.rounds} үе</div>`;
  } else if (S.phase === 'choose') {
    if (isDrawer() && S.choices) {
      html = `<div class="ov-text">Үгээ сонгоно уу</div>
        <div class="choices">${S.choices.map((w, i) => `<button class="choice" data-i="${i}">${esc(w)}</button>`).join('')}</div>`;
    } else {
      html = `<div class="ov-avatar">${drawer ? avatarSVG(drawer.avatar) : ''}</div>
        <div class="ov-text"><b>${esc(drawer?.name ?? '')}</b> үг сонгож байна!</div>`;
    }
  } else if (S.phase === 'turnEnd') {
    const rows = [...S.players.values()]
      .map((p) => ({ p, pts: S.points?.[p.id] || 0 }))
      .sort((a, b) => b.pts - a.pts);
    html = `<div class="ov-text">Үг нь: <span class="ov-word">${esc(S.word || '')}</span></div>
      <div class="ov-sub">${REASONS[S.reason] || ''}</div>
      <div class="ov-points">${rows.map(({ p, pts }) => `<div class="pt-row">
        <span class="pt-name">${esc(p.name)}</span><span class="pt ${pts > 0 ? 'plus' : 'zero'}">${pts > 0 ? `+${pts}` : '0'}</span></div>`).join('')}</div>`;
  } else if (S.phase === 'gameEnd') {
    const r = S.ranking || [];
    const winners = r.filter((x) => x.place === 1);
    const podium = [1, 0, 2].map((i) => r[i] && `<div class="pod pod-${r[i].place}">
        <div class="pod-av">${avatarSVG(r[i].avatar, { crown: r[i].place === 1 })}</div>
        <div class="pod-place">#${r[i].place}</div>
        <div class="pod-name">${esc(r[i].name)}</div>
        <div class="pod-score">${r[i].score} оноо</div>
      </div>`).filter(Boolean).join('');
    html = `<div class="ov-text">${winners.length === 1 ? `<b>${esc(winners[0].name)}</b> ялагч боллоо!` : 'Тэнцлээ!'}</div>
      <div class="podium">${podium}</div>
      ${r.length > 3 ? `<div class="ov-rest">${r.slice(3).map((x) => `<span>#${x.place} ${esc(x.name)} — ${x.score}</span>`).join('')}</div>` : ''}
      <div class="ov-sub">${S.isPrivate ? 'Удахгүй өрөө рүү буцна...' : 'Дараагийн тоглоом удахгүй эхэлнэ...'}</div>`;
  }

  if (html === null) {
    ov.classList.remove('show');
    return;
  }
  box.innerHTML = `<div class="ov-inner">${html}</div>`;
  ov.classList.add('show');
}

// ---------------------------------------------------------------- toolbar

function buildToolbar() {
  const tb = $('#toolbar');
  tb.innerHTML = `
    <div class="color-current" id="color-current"></div>
    <div class="colors">${PALETTE.map((c, i) => `<button class="color" data-c="${i}" style="background:${c}" aria-label="Өнгө ${i + 1}"></button>`).join('')}</div>
    <div class="tool-group sizes">${BRUSH_SIZES.map((s, i) => `<button class="tool size" data-s="${i}" title="Хэмжээ ${i + 1} (${i + 1})"><span style="width:${Math.max(4, s * 0.6)}px;height:${Math.max(4, s * 0.6)}px"></span></button>`).join('')}</div>
    <div class="tool-group">
      <button class="tool" data-tool="brush" title="Бийр (B)">${ICONS.brush}</button>
      <button class="tool" data-tool="fill" title="Будах (F)">${ICONS.bucket}</button>
    </div>
    <div class="tool-group">
      <button class="tool" id="tool-undo" title="Буцаах (U)">${ICONS.undo}</button>
      <button class="tool" id="tool-clear" title="Арилгах (C)">${ICONS.trash}</button>
    </div>`;
  tb.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.c) setColor(Number(b.dataset.c));
    else if (b.dataset.s) setSize(Number(b.dataset.s));
    else if (b.dataset.tool) setTool(b.dataset.tool);
    else if (b.id === 'tool-undo') board.localUndo();
    else if (b.id === 'tool-clear') board.localClear();
  });
  setColor(13);
  setSize(1);
  setTool('brush');
}

function setColor(i) {
  board.setColor(i);
  $('#color-current').style.background = PALETTE[i];
  document.querySelectorAll('.color').forEach((b) => b.classList.toggle('sel', Number(b.dataset.c) === i));
  document.querySelectorAll('.size span').forEach((s) => { s.style.background = i === 0 ? '#bbb' : PALETTE[i]; });
}

function setSize(i) {
  board.setSize(i);
  document.querySelectorAll('.size').forEach((b) => b.classList.toggle('sel', Number(b.dataset.s) === i));
}

function setTool(t) {
  board.setTool(t);
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('sel', b.dataset.tool === t));
}

function renderTools() {
  $('#toolbar').classList.toggle('hidden', !(S.phase === 'draw' && isDrawer()));
}

function renderRate() {
  $('#rate-box').classList.toggle('hidden', !(S.phase === 'draw' && !isDrawer() && !S.rated));
}

// ---------------------------------------------------------------- lobby

const FIELDS = [
  { key: 'maxPlayers', label: 'Тоглогчид', icon: 'users', options: range(...LIMITS.players) },
  { key: 'drawTime', label: 'Зурах хугацаа', icon: 'clock', options: DRAW_TIMES, fmt: (v) => `${v} сек` },
  { key: 'rounds', label: 'Үе', icon: 'rounds', options: range(...LIMITS.rounds) },
  { key: 'wordCount', label: 'Үгийн тоо', icon: 'words', options: range(...LIMITS.wordCount) },
  { key: 'hints', label: 'Зөвлөмж', icon: 'bulb', options: range(...LIMITS.hints) },
];

function buildLobby() {
  const el = $('#lobby');
  el.innerHTML = `
    <div class="lobby-grid">
      ${FIELDS.map((f) => `<label class="lobby-row">
        <span class="lobby-label">${ICONS[f.icon]}${f.label}</span>
        <select class="input select" data-key="${f.key}">${f.options.map((v) => `<option value="${v}">${f.fmt ? f.fmt(v) : v}</option>`).join('')}</select>
      </label>`).join('')}
      <label class="lobby-row">
        <span class="lobby-label">${ICONS.news}Хэл</span>
        <select class="input select" disabled><option>Монгол</option></select>
      </label>
    </div>
    <div class="lobby-custom">
      <div class="lobby-custom-head">
        <span>Өөрийн үгс</span>
        <label class="check"><input type="checkbox" id="custom-only"> Зөвхөн өөрийн үгсийг ашиглах</label>
      </div>
      <textarea class="input" id="custom-words" maxlength="${LIMITS.customWordsMaxChars}" spellcheck="false"
        placeholder="Хамгийн багадаа ${LIMITS.customWordsMin} үг. Үг бүр 1-${LIMITS.customWordMaxLen} тэмдэгт. Таслалаар (,) тусгаарлана. Жишээ нь: тэмээ, морин хуур, гэр"></textarea>
    </div>
    <div class="lobby-actions">
      <button class="btn btn-play btn-start" id="btn-start">Эхлүүлэх!</button>
      <div class="lobby-wait hidden" id="lobby-wait">Өрөөний эзэн тоглоомыг эхлүүлэхийг хүлээж байна...</div>
      <button class="btn btn-private btn-invite" id="btn-invite">${ICONS.link}<span>Урих</span></button>
    </div>
    <div class="invite-hint" id="invite-hint"></div>`;

  el.querySelectorAll('select[data-key]').forEach((sel) => {
    sel.addEventListener('change', () => socket.emit('settings', { [sel.dataset.key]: Number(sel.value) }));
  });
  $('#custom-only').addEventListener('change', (e) => socket.emit('settings', { customOnly: e.target.checked }));
  let t = null;
  const words = $('#custom-words');
  const sendWords = () => { clearTimeout(t); socket.emit('settings', { customWords: words.value }); };
  words.addEventListener('input', () => { clearTimeout(t); t = setTimeout(sendWords, 600); });
  words.addEventListener('blur', sendWords);
  $('#btn-start').addEventListener('click', () => { sendWords(); socket.emit('start'); });
  $('#btn-invite').addEventListener('click', copyInvite);
}

function inviteUrl() {
  return `${S.lanUrl || location.origin}/?${S.code}`;
}

async function copyInvite() {
  const url = inviteUrl();
  let ok = false;
  try {
    await navigator.clipboard.writeText(url);
    ok = true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
  }
  const span = $('#btn-invite span');
  span.textContent = ok ? 'Хуулагдлаа!' : url;
  setTimeout(() => { span.textContent = 'Урих'; }, 2000);
  if (ok) sysMsg(`Урилгын холбоос хуулагдлаа: ${url}`, 'blue');
}

function renderLobby() {
  const show = S.phase === 'lobby';
  $('#lobby').classList.toggle('hidden', !show);
  if (!show) return;
  const owner = isOwner();
  const s = S.settings;
  $('#lobby').querySelectorAll('select[data-key]').forEach((sel) => {
    sel.value = String(s[sel.dataset.key]);
    sel.disabled = !owner;
  });
  const cb = $('#custom-only');
  cb.checked = !!s.customOnly;
  cb.disabled = !owner;
  const words = $('#custom-words');
  words.disabled = !owner;
  if (owner) {
    if (document.activeElement !== words) words.value = s.customWords || '';
  } else {
    words.value = '';
    words.placeholder = s.customCount ? `Өрөөний эзэн ${s.customCount} өөрийн үг нэмсэн байна.` : 'Өрөөний эзэн өөрийн үг нэмээгүй байна.';
  }
  $('#btn-start').classList.toggle('hidden', !owner);
  $('#lobby-wait').classList.toggle('hidden', owner);
  $('#invite-hint').textContent = S.lanUrl ? `Нэг Wi-Fi-д холбогдсон найзууд энэ холбоосоор нэгдэнэ: ${inviteUrl()}` : inviteUrl();
}

// ---------------------------------------------------------------- chat

function bindChat() {
  const form = $('#chat-form');
  const input = $('#chat-input');
  const count = $('#chat-count');
  const upd = () => { count.textContent = input.value.length ? `${input.value.length}/${LIMITS.chatMax}` : ''; };
  input.addEventListener('input', upd);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    socket.emit('chat', v);
    input.value = '';
    upd();
  });
}

function addMsg(html, cls = '') {
  const log = $('#chat-log');
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
  const p = document.createElement('p');
  p.className = `msg ${cls}`;
  p.innerHTML = html;
  log.appendChild(p);
  while (log.children.length > 200) log.firstChild.remove();
  if (stick) log.scrollTop = log.scrollHeight;
}

const sysMsg = (text, cls) => addMsg(`<b>${esc(text)}</b>`, cls);

function onChat({ id, name, text, g }) {
  if (S.muted.has(id)) return;
  addMsg(`<b>${esc(name)}:</b> ${esc(text)}`, g ? 'green-chat' : '');
}

function onSys(m) {
  const n = esc(m.name ?? '');
  const map = {
    join: [`${n} өрөөнд нэгдлээ!`, 'green', 'join'],
    leave: [`${n} өрөөнөөс гарлаа!`, 'red', 'leave'],
    drawing: [`${n} зурж байна!`, 'blue'],
    guessed: [m.id === S.me ? 'Та үгийг таалаа!' : `${n} үгийг таалаа!`, 'green', m.id === S.me ? null : 'guessed'],
    wordWas: [`Үг нь «${esc(m.word)}» байсан.`, 'green'],
    close: [`«${esc(m.text)}» ойрхон байна!`, 'yellow', 'close'],
    owner: [`${n} одоо өрөөний эзэн боллоо!`, 'yellow'],
    vote: [`${esc(m.voter)} нь ${esc(m.target)} тоглогчийг хасах санал өглөө (${m.n}/${m.req}).`, 'yellow'],
    kicked: [`${n} тоглогчийг өрөөнөөс хаслаа!`, 'red'],
    banned: [`${n} тоглогчийг өрөөнд хориглолоо!`, 'red'],
    like: [`${n} энэ зурагт дуртай байна!`, 'green', 'like'],
    dislike: [`${n} энэ зурагт дургүй байна!`, 'red', 'dislike'],
    noWord: ['Та таах үгийг бичиж болохгүй!', 'red'],
    spam: ['Хэт хурдан бичиж байна! Түр хүлээнэ үү.', 'red'],
    notEnough: ['Тоглогч хүрэлцэхгүй байгаа тул тоглоом зогслоо.', 'red'],
  }[m.k];
  if (!map) return;
  addMsg(`<b>${map[0]}</b>`, map[1]);
  if (map[2]) sound.play(map[2]);
}

// ---------------------------------------------------------------- keys

function bindKeys() {
  document.addEventListener('keydown', (e) => {
    if (!S.code || $('#modal-root').children.length) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (S.phase === 'draw' && isDrawer()) {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); board.localUndo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.code;
      if (k === 'KeyB') setTool('brush');
      else if (k === 'KeyF') setTool('fill');
      else if (k === 'KeyU') board.localUndo();
      else if (k === 'KeyC') board.localClear();
      else if (/^Digit[1-5]$/.test(k)) setSize(Number(k.slice(5)) - 1);
      return;
    }
    if (S.phase !== 'lobby' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) $('#chat-input').focus();
  });
}

// ---------------------------------------------------------------- modals

function modal(html, buttons) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog">${html}
    <div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.icon ? ICONS[b.icon] : ''}<span>${b.text}</span></button>`).join('')}</div>
  </div></div>`;
  const back = root.firstElementChild;
  back.addEventListener('click', (e) => {
    if (e.target === back) { closeModal(); return; }
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const def = buttons[Number(b.dataset.i)];
    if (!def.keep) closeModal();
    def.onClick?.();
  });
  return back;
}

function closeModal() {
  $('#modal-root').innerHTML = '';
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function openPlayer(id) {
  const p = S.players.get(id);
  if (!p) return;
  const me = id === S.me;
  const buttons = [];
  if (!me) {
    buttons.push({ text: 'Хасах санал өгөх', icon: 'vote', cls: 'btn-orange', onClick: () => socket.emit('votekick', id) });
    const muted = S.muted.has(id);
    buttons.push({
      text: muted ? 'Дууг нь нээх' : 'Дуугүй болгох', icon: 'mute', cls: 'btn-gray',
      onClick: () => { if (muted) S.muted.delete(id); else S.muted.add(id); renderPlayers(); },
    });
    if (isOwner()) {
      buttons.push({ text: 'Өрөөнөөс хасах', icon: 'kick', cls: 'btn-red', onClick: () => socket.emit('kick', id) });
      buttons.push({ text: 'Хориглох', icon: 'ban', cls: 'btn-red', onClick: () => socket.emit('ban', id) });
    }
  }
  buttons.push({ text: 'Хаах', cls: 'btn-blue' });
  modal(`<div class="player-card">${avatarSVG(p.avatar)}<h3>${esc(p.name)}${me ? ' (Та)' : ''}</h3><p>${p.score} оноо</p></div>`, buttons);
}

function openSettings() {
  const back = modal(`<h3>Тохиргоо</h3>
    <label class="set-row">${ICONS.volume}<span>Дууны хэмжээ</span>
      <input type="range" id="vol" min="0" max="100" value="${Math.round(sound.getVolume() * 100)}"></label>
    <div class="hotkeys">
      <b>Товчлол (зурах үед)</b>
      <div><kbd>B</kbd> Бийр</div><div><kbd>F</kbd> Будах</div>
      <div><kbd>U</kbd> / <kbd>Ctrl</kbd>+<kbd>Z</kbd> Буцаах</div><div><kbd>C</kbd> Арилгах</div>
      <div><kbd>1</kbd>–<kbd>5</kbd> Бийрний хэмжээ</div>
    </div>`, [
    { text: 'Тоглоомоос гарах', icon: 'door', cls: 'btn-red', onClick: leave },
    { text: 'Хаах', cls: 'btn-blue' },
  ]);
  $('#vol', back).addEventListener('input', (e) => {
    sound.setVolume(Number(e.target.value) / 100);
    sound.play('guessed');
  });
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}
