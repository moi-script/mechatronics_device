// Exports the web app as static files for the APK, with the on-device
// circuit store switched on in place of the API.
//
// The /api proxy and the /view share page need a server, which a static
// export refuses, so they are moved out of the app directory for the build
// and always put back afterwards.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../../web', import.meta.url));
const appDir = path.join(web, 'src', 'app');
const parked = path.join(web, '.offline-parked');
const serverOnly = ['api', 'view'];

// A previous build that was killed midway may have left routes parked.
const restore = () => {
  for (const name of serverOnly) {
    const from = path.join(parked, name);
    if (existsSync(from) && !existsSync(path.join(appDir, name))) renameSync(from, path.join(appDir, name));
  }
  rmSync(parked, { recursive: true, force: true });
};

restore();
mkdirSync(parked, { recursive: true });
for (const name of serverOnly) renameSync(path.join(appDir, name), path.join(parked, name));

try {
  execSync('npx next build', {
    cwd: web,
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_OFFLINE: '1' },
  });
} finally {
  restore();
}
