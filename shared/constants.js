// Сервер болон хөтөч хоёулаа ашигладаг тогтмолууд.

// Зургийн самбарын дотоод нягтрал (дэлгэцэн дээр CSS-ээр томруулж/жижигрүүлж харуулна)
export const CANVAS_W = 800;
export const CANVAS_H = 600;

// Зурах өнгөнүүд: 2 мөр × 13
export const PALETTE = [
  '#ffffff', '#c1c1c1', '#ef130b', '#ff7100', '#ffe400', '#00cc00', '#00ff91',
  '#00b2ff', '#231fd3', '#a300ba', '#df69a7', '#ffac8e', '#a0522d',
  '#000000', '#505050', '#740b07', '#c23800', '#e8a200', '#004619', '#00785d',
  '#00569e', '#0e0865', '#550069', '#873554', '#cc774d', '#63300d',
];

// Бийрний диаметр (самбарын пикселээр)
export const BRUSH_SIZES = [4, 10, 18, 30, 44];

// Аватарын хэсгүүдийн сонголтын тоо: [өнгө, нүд, ам].
// public/js/avatar.js доторх жагсаалтын урттай таарах ёстой (тест шалгадаг).
export const AVATAR_PARTS = [18, 16, 15];

export const DRAW_TIMES = [15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 210, 240];

export const LIMITS = {
  nameMax: 20,
  chatMax: 100,
  players: [2, 20],
  rounds: [2, 10],
  wordCount: [1, 5],
  hints: [0, 5],
  customWordsMin: 10,
  customWordMaxLen: 32,
  customWordsMaxChars: 20000,
};

export const PUBLIC_MAX_PLAYERS = 16;

export const DEFAULT_SETTINGS = Object.freeze({
  maxPlayers: 16,
  drawTime: 80,
  rounds: 3,
  wordCount: 3,
  hints: 2,
  customWords: '',
  customOnly: false,
});

// Зурах командууд (сүлжээгээр массив хэлбэрээр дамжина):
//   [0, өнгө, хэмжээ, x, y]  — шинэ зураас эхлүүлж цэг тавина
//   [1, x, y]                — одоогийн зураасыг (x, y) хүртэл үргэлжлүүлнэ
//   [2, өнгө, x, y]          — (x, y) цэгээс эхлэн будна (дүүргэх)
export const CMD = { BEGIN: 0, LINE: 1, FILL: 2 };
