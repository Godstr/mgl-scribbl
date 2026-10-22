import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { GameServer } from './game.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Нэг сүлжээн (Wi-Fi) дэх бусад төхөөрөмжөөс хандах IPv4 хаягууд
export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/^(docker|br-|veth|virbr|vmnet|tun|tap|lo)/.test(name)) continue;
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

export function createApp({ timeScale = Number(process.env.TIME_SCALE) || 1, port = 3000 } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use('/shared', express.static(path.join(ROOT, 'shared')));
  app.use('/fonts/nunito', express.static(path.join(ROOT, 'node_modules/@fontsource/nunito'), { maxAge: '30d' }));
  app.use(express.static(path.join(ROOT, 'public')));

  const server = createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 1e6, pingInterval: 10000, pingTimeout: 20000 });
  const game = new GameServer(io, { timeScale });

  app.get('/api/info', (req, res) => {
    const actualPort = server.address()?.port ?? port;
    res.json({ lan: lanAddresses().map((ip) => `http://${ip}:${actualPort}`), ...game.stats() });
  });

  return { app, server, io, game };
}
