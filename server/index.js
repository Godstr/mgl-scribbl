import { createApp, lanAddresses } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const { server, io } = createApp({ port: PORT });

server.listen(PORT, HOST, () => {
  console.log('\n  ЗУР ТАА тоглоом ажиллаж байна!\n');
  console.log(`  Энэ компьютерээс:   http://localhost:${PORT}`);
  for (const ip of lanAddresses()) console.log(`  Нэг Wi-Fi-аас:      http://${ip}:${PORT}`);
  console.log('');
});

function shutdown() {
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
