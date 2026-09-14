// Exports the web app as static files for the APK, with the on-device
// circuit store switched on in place of the API.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../../web', import.meta.url));

execSync('npx next build', {
  cwd: web,
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_OFFLINE: '1' },
});
