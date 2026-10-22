// Таамаглалыг зөв үгтэй харьцуулна.
// Кирилл бичвэрээс гадна латин үсгээр (галигаар) бичсэнийг ч ойлгоно: "nohoi" = "нохой".

const SEPARATORS = /[\s\-‐‑‒–—_.,!?;:'"`«»()]+/g;

// Орос гарнаас бичихэд ө/ү байдаггүй тул о/у-тай адилтгана.
const LOOSE = { 'ё': 'е', 'ө': 'о', 'ү': 'у' };

export function normCyr(s) {
  return String(s).toLowerCase().replace(SEPARATORS, '').replace(/[ёөү]/g, (c) => LOOSE[c]);
}

function normLatin(s) {
  return String(s).toLowerCase().normalize('NFC').replace(SEPARATORS, '');
}

// Кирилл үсэг бүрийг латинаар бичих түгээмэл хувилбарууд
const LATIN = {
  'а': ['a'],
  'б': ['b'],
  'в': ['v', 'w'],
  'г': ['g'],
  'д': ['d'],
  'е': ['ye', 'e', 'yo', 'ie', 'je'],
  'ё': ['yo', 'e', 'io', 'jo', 'ye'],
  'ж': ['j', 'zh', 'dj', 'jh'],
  'з': ['z', 'dz'],
  'и': ['i', 'ii', 'y'],
  'й': ['', 'i', 'y', 'j'],
  'к': ['k', 'c'],
  'л': ['l'],
  'м': ['m'],
  'н': ['n'],
  'о': ['o'],
  'ө': ['o', 'u', 'q', 'ö', 'oe'],
  'п': ['p'],
  'р': ['r'],
  'с': ['s'],
  'т': ['t'],
  'у': ['u', 'ou'],
  'ү': ['u', 'v', 'y', 'ü', 'ue'],
  'ф': ['f', 'ph'],
  'х': ['h', 'kh', 'x'],
  'ц': ['ts', 'c', 'tz'],
  'ч': ['ch', 'c', 'tch'],
  'ш': ['sh', 'sch', 's', 'w'],
  'щ': ['sh', 'sch', 'shch'],
  'ъ': ['', 'i', 'y'],
  'ы': ['y', 'i', 'ii', 'ui'],
  'ь': ['', 'i', 'y'],
  'э': ['e'],
  'ю': ['yu', 'yo', 'iu', 'ju', 'u'],
  'я': ['ya', 'ia', 'ja'],
};

// "Ойрхон" эсэхийг шалгахад ашиглах нэг стандарт галиг
const CANON = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'ye', 'ё': 'yo', 'ж': 'j', 'з': 'z',
  'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'ө': 'o', 'п': 'p',
  'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ү': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
  'ш': 'sh', 'щ': 'sh', 'ъ': 'i', 'ы': 'y', 'ь': 'i', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

// Латин бичлэгийн ялгааг багасгаж, хоёр талыг ижил хэлбэрт оруулна
function simplifyLatin(s) {
  return s
    .replace(/kh|x/g, 'h')
    .replace(/sch|sh/g, 's')
    .replace(/tch|ch/g, 'c')
    .replace(/ts|tz/g, 'c')
    .replace(/zh/g, 'j')
    .replace(/w/g, 'v')
    .replace(/q|ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/y/g, 'i');
}

const hasCyrillic = (s) => /[Ѐ-ӿ]/.test(s);
const hasLatin = (s) => /[a-zöü]/i.test(s);

// Нэг ээлжийн туршид дахин дахин ашиглахаар үгийг урьдчилан бэлтгэнэ
export function prepareWord(word) {
  const base = String(word).toLowerCase().replace(SEPARATORS, '');
  const letters = [];
  let canon = '';
  for (const ch of base) {
    if (LATIN[ch]) {
      letters.push(LATIN[ch]);
      canon += CANON[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      letters.push([ch]);
      canon += ch;
    } else {
      // Галиглах боломжгүй тэмдэгт байвал латин таамаглалыг хүлээж авахгүй
      return { word, cyr: normCyr(word), letters: null, canon: '' };
    }
  }
  return { word, cyr: normCyr(word), letters, canon: simplifyLatin(canon) };
}

// Динамик программчлалаар шалгана (regex ашиглавал муу санаатай үгэнд гацах эрсдэлтэй)
function latinMatches(guess, letters) {
  let positions = new Set([0]);
  for (const alts of letters) {
    const next = new Set();
    for (const pos of positions) {
      for (const alt of alts) {
        if (guess.startsWith(alt, pos)) next.add(pos + alt.length);
      }
    }
    if (next.size === 0) return false;
    positions = next;
  }
  return positions.has(guess.length);
}

export function levenshtein(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const closeLimit = (len) => (len >= 8 ? 2 : 1);

// Үр дүн: 'correct' | 'close' | 'wrong'
export function checkGuess(guess, prep) {
  const g = normCyr(guess);
  if (!g) return 'wrong';
  if (g === prep.cyr) return 'correct';

  if (!hasCyrillic(guess) && hasLatin(guess)) {
    if (!prep.letters) return 'wrong';
    const latin = normLatin(guess);
    if (latinMatches(latin, prep.letters)) return 'correct';
    const simple = simplifyLatin(latin);
    const limit = closeLimit(prep.canon.length);
    if (prep.canon.length >= 4 && levenshtein(simple, prep.canon, limit) <= limit) return 'close';
    return 'wrong';
  }

  const limit = closeLimit(prep.cyr.length);
  if (prep.cyr.length >= 4 && levenshtein(g, prep.cyr, limit) <= limit) return 'close';
  return 'wrong';
}

// Зураач чатад үгийг задруулах гэж байгаа эсэх
export function containsWord(text, prep) {
  if (!prep) return false;
  if (normCyr(text).includes(prep.cyr)) return true;
  return checkGuess(text, prep) === 'correct';
}
