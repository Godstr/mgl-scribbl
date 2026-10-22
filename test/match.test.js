import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGuess, containsWord, prepareWord } from '../server/match.js';
import { WORDS } from '../server/words.js';

const check = (guess, word) => checkGuess(guess, prepareWord(word));

test('кирилл таамаглал', () => {
  assert.equal(check('нохой', 'нохой'), 'correct');
  assert.equal(check('  НОХОЙ ', 'нохой'), 'correct');
  assert.equal(check('шаршувуу', 'шар шувуу'), 'correct');
  assert.equal(check('шар-шувуу!', 'шар шувуу'), 'correct');
  // Орос гарнаас ө/ү-гүй бичсэн
  assert.equal(check('ондог', 'өндөг'), 'correct');
  assert.equal(check('ухэр', 'үхэр'), 'correct');
  assert.equal(check('муур', 'нохой'), 'wrong');
});

test('ойрхон таамаглал', () => {
  assert.equal(check('нохоо', 'нохой'), 'close');
  assert.equal(check('тэмэ', 'тэмээ'), 'close');
  assert.equal(check('гүзээлзгэн', 'гүзээлзгэнэ'), 'close');
  assert.equal(check('нар', 'нам'), 'wrong'); // богино үгэнд "ойрхон" гэж хэлэхгүй
});

test('латин (галиг) таамаглал', () => {
  assert.equal(check('nohoi', 'нохой'), 'correct');
  assert.equal(check('nokhoi', 'нохой'), 'correct');
  assert.equal(check('noxoi', 'нохой'), 'correct');
  assert.equal(check('Mori', 'морь'), 'correct');
  assert.equal(check('mor', 'морь'), 'correct');
  assert.equal(check('ondog', 'өндөг'), 'correct');
  assert.equal(check('qndqg', 'өндөг'), 'correct');
  assert.equal(check('vher', 'үхэр'), 'correct');
  assert.equal(check('ukher', 'үхэр'), 'correct');
  assert.equal(check('tsai', 'цай'), 'correct');
  assert.equal(check('shar shuvuu', 'шар шувуу'), 'correct');
  assert.equal(check('gvzeelzgene', 'гүзээлзгэнэ'), 'correct');
  assert.equal(check('chono', 'чоно'), 'correct');
  assert.equal(check('jurj', 'жүрж'), 'correct');
  assert.equal(check('yamaa', 'ямаа'), 'correct');
  assert.equal(check('takhi', 'тахь'), 'correct');
  assert.equal(check('nohai', 'нохой'), 'close');
  assert.equal(check('muur', 'нохой'), 'wrong');
});

test('муу санаатай урт үг серверийг гацаахгүй', () => {
  const evil = 'ий'.repeat(16);
  const start = Date.now();
  assert.equal(check('i'.repeat(99) + 'x', evil), 'wrong');
  assert.ok(Date.now() - start < 200);
});

test('зураач үгийг задруулж чадахгүй', () => {
  const prep = prepareWord('морин хуур');
  assert.equal(containsWord('энэ бол морин хуур шүү', prep), true);
  assert.equal(containsWord('morin huur', prep), true);
  assert.equal(containsWord('сайн уу', prep), false);
});

test('үгийн сан', () => {
  assert.ok(WORDS.length >= 600, `үгийн тоо: ${WORDS.length}`);
  for (const w of WORDS) {
    assert.match(w, /^[А-ЯЁӨҮа-яёөү]+( [А-ЯЁӨҮа-яёөү]+)*$/, `буруу үг: "${w}"`);
    // Бүх үгийг латинаар бичиж таах боломжтой байх ёстой
    assert.ok(prepareWord(w).letters, `галиглах боломжгүй: "${w}"`);
  }
});
