import 'dotenv/config';
import { loadConfig } from './config.js';
import { buildServer } from './server.js';

async function main() {
  const config = loadConfig();
  const app = await buildServer(config);
  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  console.error('Failed to start foundry server:', err);
  process.exit(1);
});
