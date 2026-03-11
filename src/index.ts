import { config } from './config';
import { initFirebase } from './firebase';
import { createServer } from './server';

initFirebase();
const app = createServer();

app.listen(config.port, () => {
  console.log(`Comparison logger listening on port ${config.port}`);
  console.log(`  VERCEL_URL=${config.vercelUrl}`);
  console.log(`  LOG_MODE=${config.logMode}`);
  console.log(`  LOG_PAYLOAD=${config.logPayload}`);
});
