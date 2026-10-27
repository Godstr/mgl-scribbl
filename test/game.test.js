import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/app.js';

// Бүх хугацааг 20 дахин хурдасгана
const { server, game } = createApp({ timeScale: 0.05 });
let url;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  game.io.close();
  server.close();
});

function client() {
  const s = connect(url, { transports: ['websocket'], forceNew: true });
  s.events = [];
  s.onAny((ev, data) => s.events.push([ev, data]));
  return s;
}

const once = (s, ev, pred = () => true, ms = 8000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`"${ev}" ирсэнгүй`)), ms);
  const fn = (data) => {
    if (!pred(data)) return;
    clearTimeout(timer);
    s.off(ev, fn);
    resolve(data);
  };
  s.on(ev, fn);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('хувийн өрөө: бүтэн тоглоом эхнээс дуустал', async () => {
  const a = client();
  const b = client();
  a.emit('create', { name: 'Бат', avatar: [1, 2, 3], clientId: 'a' });
  const ja = await once(a, 'joined');
  assert.equal(ja.isPrivate, true);
  assert.equal(ja.state.phase, 'lobby');
  assert.equal(ja.players.ownerId, ja.me);

  b.emit('play', { name: 'Дорж', avatar: [0, 0, 0], clientId: 'b', code: ja.code });
  const jb = await once(b, 'joined');
  assert.equal(jb.code, ja.code);
  assert.equal(jb.players.list.length, 2);

  // Эзэн биш хүн тохиргоо өөрчилж чадахгүй
  b.emit('settings', { rounds: 9 });
  a.emit('settings', { rounds: 2, drawTime: 15, hints: 2 });
  const st = await once(b, 'settings', (s) => s.rounds === 2);
  assert.equal(st.drawTime, 15);

  // Хоёр тоглогчийг бот болгоно
  const words = {};
  const stats = { turns: 0, guessed: 0, draws: 0 };
  for (const s of [a, b]) {
    const me = s === a ? ja.me : jb.me;
    s.on('phase', (ph) => {
      if (ph.phase === 'choose' && ph.drawerId === me) {
        assert.ok(ph.choices.length >= 1);
        s.emit('choose', 0);
      }
      if (ph.phase === 'draw' && ph.drawerId === me) {
        words.current = ph.word;
        s.emit('draw', [[0, 13, 2, 100, 100], [1, 200, 150], [1, 300, 120]]);
      }
      if (ph.phase === 'draw' && ph.drawerId !== me) {
        // Таахаас өмнө үг харагдах ёсгүй
        assert.equal(ph.word, undefined);
        assert.match(ph.hint, /_/);
        setTimeout(() => {
          s.emit('chat', 'буруу таамаг');
          s.emit('chat', words.current);
        }, 60);
      }
      if (ph.phase === 'turnEnd') stats.turns += s === a ? 1 : 0;
    });
    s.on('reveal', () => { stats.guessed++; });
    s.on('draw', () => { stats.draws++; });
  }

  a.emit('start');
  const end = await once(a, 'phase', (ph) => ph.phase === 'gameEnd', 20000);
  assert.equal(end.ranking.length, 2);
  assert.ok(end.ranking[0].score > 0);
  assert.equal(stats.turns, 4, '2 тоглогч × 2 үе = 4 ээлж');
  assert.equal(stats.guessed, 4);
  assert.ok(stats.draws >= 4, 'зураг нөгөө тоглогч руу дамжсан');

  // Тоглоом дуусаад лобби руу буцна
  await once(a, 'phase', (ph) => ph.phase === 'lobby');
  a.close();
  b.close();
});

test('ойрхон таамаг, зураачийн нууц, тоглогч гарах', async () => {
  const a = client();
  const b = client();
  const c = client();
  a.emit('create', { name: 'А', clientId: 'a2' });
  const ja = await once(a, 'joined');
  b.emit('play', { name: 'Б', clientId: 'b2', code: ja.code });
  const jb = await once(b, 'joined');
  c.emit('play', { name: 'В', clientId: 'c2', code: ja.code });
  await once(c, 'joined');
  a.emit('settings', { drawTime: 240 });
  await once(a, 'settings', (s) => s.drawTime === 240);

  const ids = { [ja.me]: a, [jb.me]: b };
  a.emit('start');
  const choose = await once(a, 'phase', (ph) => ph.phase === 'choose');
  const drawer = ids[choose.drawerId] || c;
  const guesser = drawer === a ? b : a;
  drawer.emit('choose', 0);
  const ph = await once(drawer, 'phase', (p) => p.phase === 'draw');
  const word = ph.word;

  // Зураач үгээ бичиж болохгүй
  drawer.emit('chat', `үг нь ${word}`);
  const sys = await once(drawer, 'sys', (m) => m.k === 'noWord');
  assert.equal(sys.k, 'noWord');

  // Үсгийн нэг алдаатай таамаг → "ойрхон"
  if (Array.from(word.replace(/ /g, '')).length >= 4) {
    const close = word.slice(0, -1) + (word.endsWith('а') ? 'о' : 'а');
    guesser.emit('chat', close);
    const m = await once(guesser, 'sys', (x) => x.k === 'close');
    assert.equal(m.text, close);
  }

  // Зураач гарвал ээлж дуусна
  drawer.close();
  const te = await once(guesser, 'phase', (p) => p.phase === 'turnEnd');
  assert.equal(te.reason, 'drawerLeft');
  guesser.close();
  for (const s of [a, b, c]) s.close();
  await sleep(50);
});

test('нийтийн өрөө: 2 хүн ороход автоматаар эхэлнэ, 16 хүнээр дүүрнэ', async () => {
  const clients = Array.from({ length: 18 }, client);
  const joined = await Promise.all(clients.map((s, i) => {
    s.emit('play', { name: `Тоглогч ${i}`, clientId: `p${i}` });
    return once(s, 'joined');
  }));
  const rooms = new Map();
  for (const j of joined) rooms.set(j.code, (rooms.get(j.code) || 0) + 1);
  assert.deepEqual([...rooms.values()].sort((x, y) => y - x), [16, 2]);
  await sleep(300);
  const started = clients[0].events.some(([ev, d]) => ev === 'phase' && d.phase !== 'waiting')
    || joined[0].state.phase !== 'waiting';
  assert.ok(started, 'тоглоом эхэлсэн');
  for (const s of clients) s.close();
  await sleep(100);
  assert.equal(game.rooms.size, 0, 'хоосон өрөөнүүд устгагдсан');
});
