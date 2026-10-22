// Зургийн самбар: пикселийн буфер дээр зурна (бүх тоглогч дээр яг ижил үр дүн гарна)
import { BRUSH_SIZES, CANVAS_H as H, CANVAS_W as W, CMD, PALETTE } from '/shared/constants.js';

const COLORS = PALETTE.map((hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
});
const WHITE = COLORS[0];

export class Board {
  constructor(canvas, { send, onUndo, onClear }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.img = this.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.strokes = [];
    this.pen = null;
    this.dirty = null;
    this.raf = 0;
    this.send = send;
    this.onUndo = onUndo;
    this.onClear = onClear;
    this.enabled = false;
    this.drawing = false;
    this.color = 13; // хар
    this.size = 1;
    this.tool = 'brush';
    this.outbox = [];
    this.reset();
    this.bindInput();
    setInterval(() => this.flush(), 40);
    new ResizeObserver(() => this.updateCursor()).observe(canvas);
  }

  // ---------- зурах ----------

  reset() {
    this.strokes = [];
    this.pen = null;
    this.buf.fill(WHITE);
    this.markAll();
  }

  apply(cmds) {
    for (const c of cmds) this.exec(c, true);
  }

  exec(c, record) {
    if (c[0] === CMD.BEGIN) {
      if (record) this.strokes.push([c]);
      this.pen = { color: COLORS[c[1]], r: BRUSH_SIZES[c[2]] / 2, x: c[3], y: c[4] };
      this.stamp(c[3], c[4], this.pen.r, this.pen.color);
    } else if (c[0] === CMD.LINE) {
      if (!this.pen) return;
      if (record) this.strokes[this.strokes.length - 1]?.push(c);
      this.line(this.pen.x, this.pen.y, c[1], c[2], this.pen.r, this.pen.color);
      this.pen.x = c[1];
      this.pen.y = c[2];
    } else if (c[0] === CMD.FILL) {
      if (record) this.strokes.push([c]);
      this.pen = null;
      this.fill(c[2], c[3], COLORS[c[1]]);
    }
  }

  undo() {
    this.strokes.pop();
    this.redraw();
  }

  redraw() {
    const strokes = this.strokes;
    this.buf.fill(WHITE);
    for (const s of strokes) for (const c of s) this.exec(c, false);
    this.pen = null;
    this.markAll();
  }

  stamp(cx, cy, r, color) {
    const rr = (r + 0.5) * (r + 0.5);
    const ri = Math.ceil(r);
    const y0 = Math.max(0, cy - ri);
    const y1 = Math.min(H - 1, cy + ri);
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      const dx = Math.floor(Math.sqrt(Math.max(0, rr - dy * dy)));
      const xa = Math.max(0, cx - dx);
      const xb = Math.min(W - 1, cx + dx);
      if (xa <= xb) this.buf.fill(color, y * W + xa, y * W + xb + 1);
    }
    this.markDirty(cx - ri, cy - ri, cx + ri, cy + ri);
  }

  line(x0, y0, x1, y1, r, color) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const n = Math.max(1, Math.ceil(dist / Math.max(1, r / 2)));
    for (let i = 1; i <= n; i++) {
      this.stamp(Math.round(x0 + (dx * i) / n), Math.round(y0 + (dy * i) / n), r, color);
    }
  }

  fill(x, y, color) {
    const buf = this.buf;
    const target = buf[y * W + x];
    if (target === color) return;
    const stack = [x, y];
    while (stack.length) {
      const cy = stack.pop();
      let cx = stack.pop();
      let i = cy * W + cx;
      if (buf[i] !== target) continue;
      while (cx > 0 && buf[i - 1] === target) { cx--; i--; }
      let up = false;
      let down = false;
      while (cx < W && buf[i] === target) {
        buf[i] = color;
        if (cy > 0) {
          const t = buf[i - W] === target;
          if (t && !up) stack.push(cx, cy - 1);
          up = t;
        }
        if (cy < H - 1) {
          const t = buf[i + W] === target;
          if (t && !down) stack.push(cx, cy + 1);
          down = t;
        }
        cx++;
        i++;
      }
    }
    this.markAll();
  }

  markDirty(x0, y0, x1, y1) {
    const d = this.dirty;
    if (!d) this.dirty = [x0, y0, x1, y1];
    else {
      d[0] = Math.min(d[0], x0); d[1] = Math.min(d[1], y0);
      d[2] = Math.max(d[2], x1); d[3] = Math.max(d[3], y1);
    }
    if (!this.raf) this.raf = requestAnimationFrame(() => this.blit());
  }

  markAll() {
    this.markDirty(0, 0, W - 1, H - 1);
  }

  blit() {
    this.raf = 0;
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    const x = Math.max(0, d[0]);
    const y = Math.max(0, d[1]);
    const w = Math.min(W - 1, d[2]) - x + 1;
    const h = Math.min(H - 1, d[3]) - y + 1;
    if (w > 0 && h > 0) this.ctx.putImageData(this.img, 0, 0, x, y, w, h);
  }

  // ---------- оролт (зөвхөн зураач) ----------

  setEnabled(on) {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) {
      this.drawing = false;
      this.flush();
    }
    this.canvas.classList.toggle('can-draw', on);
    this.updateCursor();
  }

  setColor(i) { this.color = i; this.updateCursor(); }
  setSize(i) { this.size = i; this.updateCursor(); }
  setTool(t) { this.tool = t; this.updateCursor(); }

  local(cmd) {
    this.exec(cmd, true);
    this.outbox.push(cmd);
    if (this.outbox.length > 200) this.flush();
  }

  flush() {
    if (this.outbox.length) this.send(this.outbox.splice(0));
  }

  localUndo() {
    if (!this.enabled || !this.strokes.length) return;
    this.drawing = false;
    this.flush();
    this.undo();
    this.onUndo();
  }

  localClear() {
    if (!this.enabled) return;
    this.drawing = false;
    this.outbox = [];
    this.reset();
    this.onClear();
  }

  toCanvas(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) * W) / r.width);
    const y = Math.round(((e.clientY - r.top) * H) / r.height);
    return [Math.min(W - 1, Math.max(0, x)), Math.min(H - 1, Math.max(0, y))];
  }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      c.setPointerCapture?.(e.pointerId);
      const [x, y] = this.toCanvas(e);
      if (this.tool === 'fill') {
        this.local([CMD.FILL, this.color, x, y]);
        this.flush();
        return;
      }
      this.drawing = true;
      this.last = [x, y];
      this.local([CMD.BEGIN, this.color, this.size, x, y]);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.drawing || !this.enabled) return;
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) {
        const [x, y] = this.toCanvas(ev);
        if (x === this.last[0] && y === this.last[1]) continue;
        this.last = [x, y];
        this.local([CMD.LINE, x, y]);
      }
    });
    const end = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.flush();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  updateCursor() {
    const c = this.canvas;
    if (!this.enabled) {
      c.style.cursor = 'default';
      return;
    }
    if (this.tool === 'fill') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><path d="M3.5 12.4 11.6 4.3l7.6 7.6-6.4 6.4a2 2 0 0 1-2.8 0l-6.5-6.5a1 1 0 0 1 0-1.4z" fill="${PALETTE[this.color]}" stroke="#000" stroke-width="1.6"/><path d="M8 2l5.5 5.5" stroke="#000" stroke-width="1.6"/><path d="M21.5 20a1.8 1.8 0 1 1-3.6 0c0-1.4 1.5-2.2 1.8-3.8.3 1.6 1.8 2.4 1.8 3.8z" fill="${PALETTE[this.color]}" stroke="#000" stroke-width="1.2"/></svg>`;
      c.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 20 22, crosshair`;
      return;
    }
    const scale = c.getBoundingClientRect().width / W || 1;
    const d = Math.max(6, Math.min(120, Math.round(BRUSH_SIZES[this.size] * scale) + 2));
    const h = d / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${h}" cy="${h}" r="${h - 1}" fill="${PALETTE[this.color]}" fill-opacity=".6" stroke="#000" stroke-width="1"/><circle cx="${h}" cy="${h}" r="${Math.max(0, h - 2)}" fill="none" stroke="#fff" stroke-width="1"/></svg>`;
    c.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round(h)} ${Math.round(h)}, crosshair`;
  }
}
