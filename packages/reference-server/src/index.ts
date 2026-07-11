import { buildApp } from './app.js';
import { CLIENTS } from './fixtures.js';

const PORT = Number(process.env.PORT ?? 4100);
const { app } = buildApp();

app
  .listen({ port: PORT, host: '127.0.0.1' })
  .then(() => {
    console.log(`APX sandbox listening on http://127.0.0.1:${PORT}`);
    console.log('Bootstrap: /.well-known/apx-configuration');
    console.log('SANDBOX AUTH — NOT FOR PRODUCTION. Test clients:');
    for (const client of CLIENTS) {
      console.log(`  ${client.clientId} / ${client.clientSecret} (${client.scopes.length} scopes)`);
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
