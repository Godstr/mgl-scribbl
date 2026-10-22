import { randomBytes, randomInt } from 'node:crypto';
import { WORDS } from './words.js';
import { checkGuess, containsWord, prepareWord } from './match.js';
import { randomName } from './names.js';
import {
  AVATAR_PARTS, BRUSH_SIZES, CANVAS_H, CANVAS_W, CMD, DEFAULT_SETTINGS, DRAW_TIMES, LIMITS,
  PALETTE, PUBLIC_MAX_PLAYERS,
} from '../shared/constants.js';

// Үе шат бүрийн үргэлжлэх хугацаа (секунд)
const DURATION = { round: 3, choose: 15, turnEnd: 6, gameEnd: 12 };
const MAX_BATCH = 600; // нэг мессеж дэх зурах командын дээд тоо
const MAX_TURN_CMDS = 80000; // нэг ээлж дэх нийт командын дээд тоо
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const IN_GAME = new Set(['round', 'choose', 'draw', 'turnEnd']);

const pick = (arr) => arr[randomInt(arr.length)];
const isLetter = (c) => /\p{L}/u.test(c);
const toInt = (v, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
const clampInt = (v, min, max, fallback) => {
  const n = toInt(v, NaN);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};
const coordX = (v) => clampInt(v, 0, CANVAS_W - 1, 0);
const coordY = (v) => clampInt(v, 0, CANVAS_H - 1, 0);

export function cleanText(s, max) {
  if (typeof s !== 'string') return '';
  const t = s
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(t).slice(0, max).join('').trim();
}

export function parseCustomWords(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text || '').slice(0, LIMITS.customWordsMaxChars).split(',')) {
    const w = cleanText(raw, 64);
    if (!w || Array.from(w).length > LIMITS.customWordMaxLen || !/\p{L}/u.test(w)) continue;
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

function sanitizeProfile(info) {
  const name = cleanText(info?.name, LIMITS.nameMax) || randomName();
  const av = Array.isArray(info?.avatar) ? info.avatar : [];
  const avatar = AVATAR_PARTS.map((n, i) => {
    const v = Math.trunc(Number(av[i]));
    return Number.isFinite(v) ? ((v % n) + n) % n : randomInt(n);
  });
  const clientId = typeof info?.clientId === 'string' && info.clientId
    ? info.clientId.slice(0, 64)
    : randomBytes(8).toString('hex');
  return { name, avatar, clientId };
}

class Player {
  constructor(socket, { name, avatar, clientId }) {
    this.socket = socket;
    this.id = socket.id;
    this.name = name;
    this.avatar = avatar;
    this.clientId = clientId;
    this.score = 0;
    this.guessed = false;
    this.rated = false;
    this.tokens = 5;
    this.refillAt = Date.now();
  }

  // Хэт олон мессеж илгээхээс хамгаална
  allowMessage() {
    const now = Date.now();
    this.tokens = Math.min(5, this.tokens + (now - this.refillAt) / 700);
    this.refillAt = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  toJSON() {
    return { id: this.id, name: this.name, avatar: this.avatar, score: this.score, guessed: this.guessed };
  }
}

class Room {
  constructor(game, isPrivate) {
    this.game = game;
    this.io = game.io;
    this.code = game.newCode();
    this.isPrivate = isPrivate;
    this.settings = {
      ...DEFAULT_SETTINGS,
      maxPlayers: isPrivate ? DEFAULT_SETTINGS.maxPlayers : PUBLIC_MAX_PLAYERS,
    };
    this.customWords = [];
    this.players = new Map();
    this.ownerId = null;
    this.phase = isPrivate ? 'lobby' : 'waiting';
    this.round = 0;
    this.queue = [];
    this.drawerId = null;
    this.choices = [];
    this.word = null;
    this.prep = null;
    this.revealed = new Set();
    this.endsAt = 0;
    this.strokes = [];
    this.cmdCount = 0;
    this.penDown = false;
    this.turnPoints = {};
    this.guessCount = 0;
    this.reason = null;
    this.ranking = null;
    this.usedWords = new Set();
    this.banned = new Set();
    this.kickVotes = new Map();
    this.timer = null;
    this.hintTimers = [];
    this.destroyed = false;
  }

  // ---------- илгээх туслахууд ----------

  emit(event, data) {
    this.io.to(this.code).emit(event, data);
  }

  sys(k, params = {}) {
    this.emit('sys', { k, ...params });
  }

  playersPayload() {
    return { ownerId: this.ownerId, list: [...this.players.values()].map((p) => p.toJSON()) };
  }

  broadcastPlayers() {
    this.emit('players', this.playersPayload());
  }

  // Өөрийн үгсийг зөвхөн өрөөний эзэн харна
  settingsFor(p) {
    if (p && p.id === this.ownerId) return { ...this.settings };
    return { ...this.settings, customWords: '', customCount: parseCustomWords(this.settings.customWords).length };
  }

  broadcastSettings() {
    for (const p of this.players.values()) p.socket.emit('settings', this.settingsFor(p));
  }

  hintString() {
    return Array.from(this.word, (c, i) => (!isLetter(c) || this.revealed.has(i) ? c : '_')).join('');
  }

  phasePayload(p) {
    const s = {
      phase: this.phase,
      round: this.round,
      rounds: this.settings.rounds,
      drawerId: this.drawerId,
      endsAt: this.endsAt,
      now: Date.now(),
    };
    if (this.phase === 'choose') {
      if (p && p.id === this.drawerId) s.choices = this.choices;
    } else if (this.phase === 'draw') {
      s.hint = this.hintString();
      if (p && (p.id === this.drawerId || p.guessed)) s.word = this.word;
    } else if (this.phase === 'turnEnd') {
      s.word = this.word;
      s.reason = this.reason;
      s.points = this.turnPoints;
    } else if (this.phase === 'gameEnd') {
      s.ranking = this.ranking;
    }
    return s;
  }

  broadcastPhase() {
    for (const p of this.players.values()) p.socket.emit('phase', this.phasePayload(p));
  }

  // ---------- цаг хэмжигч ----------

  safe(fn) {
    if (this.destroyed) return;
    try {
      fn();
    } catch (err) {
      console.error(`[${this.code}]`, err);
    }
  }

  clearTimers() {
    clearTimeout(this.timer);
    this.timer = null;
    for (const t of this.hintTimers) clearTimeout(t);
    this.hintTimers = [];
  }

  setPhase(phase, seconds = 0, onEnd = null) {
    this.clearTimers();
    this.phase = phase;
    const ms = seconds ? this.game.sec(seconds) : 0;
    this.endsAt = ms ? Date.now() + ms : 0;
    if (ms && onEnd) this.timer = setTimeout(() => this.safe(onEnd), ms);
    this.broadcastPhase();
  }

  inGame() {
    return IN_GAME.has(this.phase);
  }

  // ---------- тоглогч нэгдэх / гарах ----------

  canJoin(clientId) {
    if (this.banned.has(clientId)) return 'banned';
    if (this.players.size >= this.settings.maxPlayers) return 'full';
    return null;
  }

  addPlayer(socket, profile) {
    const p = new Player(socket, profile);
    this.players.set(p.id, p);
    socket.join(this.code);
    socket.data.room = this;
    if (this.isPrivate && !this.ownerId) this.ownerId = p.id;
    if (this.inGame()) this.queue.push(p.id);

    socket.emit('joined', {
      me: p.id,
      code: this.code,
      isPrivate: this.isPrivate,
      settings: this.settingsFor(p),
      players: this.playersPayload(),
      state: this.phasePayload(p),
      drawing: this.phase === 'draw' || this.phase === 'turnEnd' ? this.strokes.flat() : [],
    });
    socket.to(this.code).emit('sys', { k: 'join', name: p.name });
    this.broadcastPlayers();

    if (this.phase === 'waiting' && this.players.size >= 2) this.startGame();
  }

  removePlayer(id, how = 'leave') {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    p.socket.leave(this.code);
    if (p.socket.data.room === this) p.socket.data.room = null;
    this.kickVotes.delete(id);
    for (const votes of this.kickVotes.values()) votes.delete(id);

    if (this.players.size === 0) {
      this.destroy();
      return;
    }
    if (how === 'leave') this.sys('leave', { name: p.name });
    if (this.isPrivate && this.ownerId === id) {
      const next = this.players.values().next().value;
      this.ownerId = next.id;
      this.sys('owner', { name: next.name });
      next.socket.emit('settings', this.settingsFor(next));
    }
    this.broadcastPlayers();

    if (!this.inGame()) return;
    if (this.players.size < 2) {
      this.stopGame();
      return;
    }
    if (id === this.drawerId) {
      if (this.phase === 'choose') this.nextTurn();
      else if (this.phase === 'draw') this.endTurn('drawerLeft');
      return;
    }
    if (this.phase === 'draw') this.checkAllGuessed();
  }

  destroy() {
    this.destroyed = true;
    this.clearTimers();
    this.game.removeRoom(this);
  }

  // ---------- тоглоомын явц ----------

  startGame() {
    this.clearTimers();
    for (const p of this.players.values()) {
      p.score = 0;
      p.guessed = false;
    }
    this.round = 0;
    this.ranking = null;
    this.broadcastPlayers();
    this.nextRound();
  }

  nextRound() {
    if (this.round >= this.settings.rounds) {
      this.endGame();
      return;
    }
    this.round++;
    this.queue = [...this.players.keys()];
    this.drawerId = null;
    this.setPhase('round', DURATION.round, () => this.nextTurn());
  }

  nextTurn() {
    if (this.players.size < 2) {
      this.stopGame();
      return;
    }
    let id = null;
    while (this.queue.length && !id) {
      const candidate = this.queue.shift();
      if (this.players.has(candidate)) id = candidate;
    }
    if (!id) {
      this.nextRound();
      return;
    }
    this.drawerId = id;
    this.word = null;
    this.prep = null;
    this.strokes = [];
    this.cmdCount = 0;
    this.penDown = false;
    this.turnPoints = {};
    this.guessCount = 0;
    for (const p of this.players.values()) {
      p.guessed = false;
      p.rated = false;
    }
    this.choices = this.pickWords(this.settings.wordCount);
    this.broadcastPlayers();
    this.setPhase('choose', DURATION.choose, () => this.chooseWord(randomInt(this.choices.length)));
  }

  pickWords(n) {
    const custom = this.isPrivate ? this.customWords : [];
    const customOnly = this.isPrivate && this.settings.customOnly && custom.length > 0;
    if (this.usedWords.size > WORDS.length * 0.7) this.usedWords.clear();
    const out = [];
    for (let guard = 0; out.length < n && guard < 2000; guard++) {
      const pool = customOnly || (custom.length > 0 && randomInt(2) === 0) ? custom : WORDS;
      const w = pick(pool);
      if (out.includes(w)) continue;
      if (this.usedWords.has(w) && guard < 1000) continue;
      out.push(w);
    }
    return out.length ? out : [pick(WORDS)];
  }

  chooseWord(i) {
    if (this.phase !== 'choose') return;
    this.word = this.choices[i] ?? this.choices[0];
    this.prep = prepareWord(this.word);
    this.usedWords.add(this.word);
    this.revealed = new Set();
    this.setPhase('draw', this.settings.drawTime, () => this.endTurn('time'));
    this.scheduleHints();
    this.sys('drawing', { name: this.players.get(this.drawerId)?.name ?? '' });
  }

  scheduleHints() {
    const letters = Array.from(this.word).filter(isLetter).length;
    const count = Math.min(this.settings.hints, Math.floor((letters - 1) / 2));
    if (count <= 0) return;
    const total = this.game.sec(this.settings.drawTime);
    for (let k = 1; k <= count; k++) {
      const at = Math.round((total * k) / (count + 1));
      this.hintTimers.push(setTimeout(() => this.safe(() => this.revealHint()), at));
    }
  }

  revealHint() {
    if (this.phase !== 'draw') return;
    const hidden = [];
    Array.from(this.word).forEach((c, i) => {
      if (isLetter(c) && !this.revealed.has(i)) hidden.push(i);
    });
    if (hidden.length <= 1) return;
    this.revealed.add(pick(hidden));
    this.emit('hint', this.hintString());
  }

  playerGuessed(p) {
    const total = this.game.sec(this.settings.drawTime);
    const left = Math.max(0, Math.min(1, (this.endsAt - Date.now()) / total));
    const points = Math.round(50 + 350 * left) + Math.max(0, 100 - this.guessCount * 25);
    this.guessCount++;
    p.guessed = true;
    this.turnPoints[p.id] = points;
    p.socket.emit('reveal', { word: this.word });
    this.sys('guessed', { id: p.id, name: p.name });
    this.broadcastPlayers();
    this.checkAllGuessed();
  }

  checkAllGuessed() {
    if (this.phase !== 'draw') return;
    for (const p of this.players.values()) {
      if (p.id !== this.drawerId && !p.guessed) return;
    }
    this.endTurn('allGuessed');
  }

  endTurn(reason) {
    if (this.phase !== 'draw') return;
    const guessers = [...this.players.values()].filter((p) => p.id !== this.drawerId);
    const sum = guessers.reduce((acc, p) => acc + (this.turnPoints[p.id] || 0), 0);
    if (this.players.has(this.drawerId)) {
      this.turnPoints[this.drawerId] = guessers.length ? Math.round(sum / guessers.length) : 0;
    }
    for (const p of this.players.values()) p.score += this.turnPoints[p.id] || 0;
    this.reason = reason;
    this.broadcastPlayers();
    this.setPhase('turnEnd', DURATION.turnEnd, () => this.nextTurn());
    this.sys('wordWas', { word: this.word });
  }

  endGame() {
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score);
    let place = 0;
    let prevScore = null;
    this.ranking = sorted.map((p, i) => {
      if (p.score !== prevScore) {
        place = i + 1;
        prevScore = p.score;
      }
      return { id: p.id, name: p.name, avatar: p.avatar, score: p.score, place };
    });
    this.drawerId = null;
    this.setPhase('gameEnd', DURATION.gameEnd, () => this.afterGame());
  }

  afterGame() {
    for (const p of this.players.values()) p.guessed = false;
    this.round = 0;
    if (this.isPrivate) this.setPhase('lobby');
    else if (this.players.size >= 2) this.startGame();
    else this.setPhase('waiting');
    this.broadcastPlayers();
  }

  // Тоглогч хүрэлцэхгүй болоход тоглоомыг зогсооно
  stopGame() {
    this.clearTimers();
    this.drawerId = null;
    this.word = null;
    this.prep = null;
    this.strokes = [];
    this.round = 0;
    this.queue = [];
    for (const p of this.players.values()) p.guessed = false;
    this.sys('notEnough');
    this.setPhase(this.isPrivate ? 'lobby' : 'waiting');
    this.broadcastPlayers();
  }

  // ---------- тоглогчийн үйлдлүүд ----------

  chat(p, raw) {
    const text = cleanText(raw, LIMITS.chatMax);
    if (!text) return;
    if (!p.allowMessage()) {
      p.socket.emit('sys', { k: 'spam' });
      return;
    }
    if (this.phase === 'draw') {
      const isDrawer = p.id === this.drawerId;
      if (isDrawer || p.guessed) {
        // Таасан тоглогчид болон зураачийн мессежийг зөвхөн тэд л харна
        if (isDrawer && containsWord(text, this.prep)) {
          p.socket.emit('sys', { k: 'noWord' });
          return;
        }
        const msg = { id: p.id, name: p.name, text, g: 1 };
        for (const q of this.players.values()) {
          if (q.id === this.drawerId || q.guessed) q.socket.emit('chat', msg);
        }
        return;
      }
      const result = checkGuess(text, this.prep);
      if (result === 'correct') {
        this.playerGuessed(p);
        return;
      }
      this.emit('chat', { id: p.id, name: p.name, text });
      if (result === 'close') p.socket.emit('sys', { k: 'close', text });
      return;
    }
    this.emit('chat', { id: p.id, name: p.name, text });
  }

  draw(p, cmds) {
    if (this.phase !== 'draw' || p.id !== this.drawerId || !Array.isArray(cmds)) return;
    const out = [];
    for (let i = 0; i < cmds.length && i < MAX_BATCH && this.cmdCount < MAX_TURN_CMDS; i++) {
      const c = cmds[i];
      if (!Array.isArray(c)) continue;
      let cmd = null;
      if (c[0] === CMD.BEGIN && c.length === 5) {
        const color = toInt(c[1], -1);
        const size = toInt(c[2], -1);
        if (color < 0 || color >= PALETTE.length || size < 0 || size >= BRUSH_SIZES.length) continue;
        cmd = [CMD.BEGIN, color, size, coordX(c[3]), coordY(c[4])];
        this.strokes.push([cmd]);
        this.penDown = true;
      } else if (c[0] === CMD.LINE && c.length === 3) {
        if (!this.penDown) continue;
        cmd = [CMD.LINE, coordX(c[1]), coordY(c[2])];
        this.strokes[this.strokes.length - 1].push(cmd);
      } else if (c[0] === CMD.FILL && c.length === 4) {
        const color = toInt(c[1], -1);
        if (color < 0 || color >= PALETTE.length) continue;
        cmd = [CMD.FILL, color, coordX(c[2]), coordY(c[3])];
        this.strokes.push([cmd]);
        this.penDown = false;
      } else {
        continue;
      }
      this.cmdCount++;
      out.push(cmd);
    }
    if (out.length) p.socket.to(this.code).emit('draw', out);
  }

  undo(p) {
    if (this.phase !== 'draw' || p.id !== this.drawerId || !this.strokes.length) return;
    this.strokes.pop();
    this.penDown = false;
    p.socket.to(this.code).emit('undo');
  }

  clear(p) {
    if (this.phase !== 'draw' || p.id !== this.drawerId) return;
    this.strokes = [];
    this.penDown = false;
    p.socket.to(this.code).emit('clear');
  }

  choose(p, i) {
    if (this.phase !== 'choose' || p.id !== this.drawerId) return;
    const idx = toInt(i, -1);
    if (idx < 0 || idx >= this.choices.length) return;
    this.chooseWord(idx);
  }

  updateSettings(p, patch) {
    if (!this.isPrivate || p.id !== this.ownerId || this.phase !== 'lobby') return;
    if (!patch || typeof patch !== 'object') return;
    const s = this.settings;
    if ('maxPlayers' in patch) s.maxPlayers = clampInt(patch.maxPlayers, ...LIMITS.players, s.maxPlayers);
    if ('drawTime' in patch) {
      const v = toInt(patch.drawTime, 0);
      if (DRAW_TIMES.includes(v)) s.drawTime = v;
    }
    if ('rounds' in patch) s.rounds = clampInt(patch.rounds, ...LIMITS.rounds, s.rounds);
    if ('wordCount' in patch) s.wordCount = clampInt(patch.wordCount, ...LIMITS.wordCount, s.wordCount);
    if ('hints' in patch) s.hints = clampInt(patch.hints, ...LIMITS.hints, s.hints);
    if (typeof patch.customWords === 'string') {
      s.customWords = patch.customWords.slice(0, LIMITS.customWordsMaxChars);
    }
    if ('customOnly' in patch) s.customOnly = Boolean(patch.customOnly);
    this.broadcastSettings();
  }

  start(p) {
    if (!this.isPrivate || p.id !== this.ownerId || this.phase !== 'lobby') return;
    if (this.players.size < 2) {
      p.socket.emit('err', { k: 'notEnough' });
      return;
    }
    this.customWords = parseCustomWords(this.settings.customWords);
    if (this.settings.customOnly && this.customWords.length < LIMITS.customWordsMin) {
      p.socket.emit('err', { k: 'customWords' });
      return;
    }
    this.startGame();
  }

  voteKick(p, targetId) {
    const target = this.players.get(targetId);
    if (!target || target.id === p.id) return;
    let votes = this.kickVotes.get(target.id);
    if (!votes) this.kickVotes.set(target.id, (votes = new Set()));
    if (votes.has(p.id)) return;
    votes.add(p.id);
    const required = Math.max(2, Math.ceil((this.players.size - 1) / 2));
    this.sys('vote', { voter: p.name, target: target.name, n: votes.size, req: required });
    if (votes.size >= required) this.kick(target, 'kick');
  }

  ownerKick(p, targetId, ban) {
    if (!this.isPrivate || p.id !== this.ownerId) return;
    const target = this.players.get(targetId);
    if (!target || target.id === p.id) return;
    this.kick(target, ban ? 'ban' : 'kick');
  }

  kick(target, how) {
    if (how === 'ban') this.banned.add(target.clientId);
    this.sys(how === 'ban' ? 'banned' : 'kicked', { name: target.name });
    target.socket.emit('kicked', { k: how });
    this.removePlayer(target.id, how);
  }

  rate(p, like) {
    if (this.phase !== 'draw' || p.id === this.drawerId || p.rated) return;
    p.rated = true;
    this.sys(like ? 'like' : 'dislike', { name: p.name });
  }
}

export class GameServer {
  constructor(io, { timeScale = 1 } = {}) {
    this.io = io;
    this.timeScale = timeScale > 0 ? timeScale : 1;
    this.rooms = new Map();
    io.on('connection', (socket) => this.onConnection(socket));
  }

  sec(seconds) {
    return Math.max(1, Math.round(seconds * 1000 * this.timeScale));
  }

  newCode() {
    let code;
    do {
      code = Array.from({ length: 8 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(isPrivate) {
    const room = new Room(this, isPrivate);
    this.rooms.set(room.code, room);
    return room;
  }

  removeRoom(room) {
    if (this.rooms.get(room.code) === room) this.rooms.delete(room.code);
  }

  // Хамгийн олон хүнтэй, дүүрээгүй нийтийн өрөөг сонгоно
  findPublicRoom() {
    let best = null;
    for (const room of this.rooms.values()) {
      if (room.isPrivate || room.players.size >= room.settings.maxPlayers) continue;
      if (!best || room.players.size > best.players.size) best = room;
    }
    return best || this.createRoom(false);
  }

  stats() {
    let players = 0;
    for (const room of this.rooms.values()) players += room.players.size;
    return { rooms: this.rooms.size, players };
  }

  onConnection(socket) {
    socket.data.room = null;
    socket.data.lastJoin = 0;

    socket.on('play', (info) => this.join(socket, info, false));
    socket.on('create', (info) => this.join(socket, info, true));
    socket.on('leave', () => socket.data.room?.removePlayer(socket.id));
    socket.on('disconnect', () => socket.data.room?.removePlayer(socket.id));

    const on = (event, handler) => {
      socket.on(event, (...args) => {
        const room = socket.data.room;
        const player = room?.players.get(socket.id);
        if (!player) return;
        try {
          handler(room, player, ...args);
        } catch (err) {
          console.error(`[${room.code}] ${event}:`, err);
        }
      });
    };
    on('chat', (r, p, text) => r.chat(p, text));
    on('draw', (r, p, cmds) => r.draw(p, cmds));
    on('undo', (r, p) => r.undo(p));
    on('clear', (r, p) => r.clear(p));
    on('choose', (r, p, i) => r.choose(p, i));
    on('settings', (r, p, patch) => r.updateSettings(p, patch));
    on('start', (r, p) => r.start(p));
    on('votekick', (r, p, id) => r.voteKick(p, id));
    on('kick', (r, p, id) => r.ownerKick(p, id, false));
    on('ban', (r, p, id) => r.ownerKick(p, id, true));
    on('rate', (r, p, like) => r.rate(p, like));
  }

  join(socket, info, createPrivate) {
    const now = Date.now();
    if (now - socket.data.lastJoin < 800) {
      socket.emit('err', { k: 'tooFast' });
      return;
    }
    socket.data.lastJoin = now;
    try {
      socket.data.room?.removePlayer(socket.id);
      const profile = sanitizeProfile(info);
      let room;
      if (createPrivate) {
        room = this.createRoom(true);
      } else if (typeof info?.code === 'string' && info.code) {
        room = this.rooms.get(info.code.toLowerCase());
        if (!room || !room.isPrivate) {
          socket.emit('err', { k: 'notFound' });
          return;
        }
        const reason = room.canJoin(profile.clientId);
        if (reason) {
          socket.emit('err', { k: reason });
          return;
        }
      } else {
        room = this.findPublicRoom();
      }
      room.addPlayer(socket, profile);
    } catch (err) {
      console.error('join:', err);
      socket.emit('err', { k: 'server' });
    }
  }
}
