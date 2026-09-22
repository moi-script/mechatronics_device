// Exports the web app as static files for the APK, with the on-device
// circuit store switched on in place of the API.
//
// Two edits are made to the app directory for the build and always undone
// afterwards:
//   - The /api proxy and the /view share page need a server, which a static
//     export refuses, so they are moved out.
//   - The web root is the landing page, which has no business inside the app.
//     It is moved out too, and the board takes its place so that the APK's
//     index.html is the trainer.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The live site the app signs in to, overridable with MECH_SITE_URL. */
const SITE = 'https://mechatronicdevice.vercel.app';

const web = fileURLToPath(new URL('../../web', import.meta.url));
const appDir = path.join(web, 'src', 'app');
const parked = path.join(web, '.offline-parked');
const serverOnly = ['api', 'view'];
// The site serves the APK as a download from public/. A static export copies
// public/ wholesale, so left in place the app would ship a copy of itself.
const publicDir = path.join(web, 'public');
const downloads = ['mechatronic-trainer.apk'];
const landing = path.join(appDir, 'page.tsx');
const board = path.join(appDir, 'board', 'page.tsx');

// A previous build that was killed midway may have left routes parked.
const restore = () => {
  for (const name of [...serverOnly, 'page.tsx']) {
    const from = path.join(parked, name);
    if (existsSync(from)) {
      rmSync(path.join(appDir, name), { recursive: true, force: true });
      renameSync(from, path.join(appDir, name));
    }
  }
  for (const name of downloads) {
    const from = path.join(parked, name);
    if (existsSync(from)) renameSync(from, path.join(publicDir, name));
  }
  rmSync(parked, { recursive: true, force: true });
};

restore();
mkdirSync(parked, { recursive: true });
for (const name of serverOnly) renameSync(path.join(appDir, name), path.join(parked, name));
renameSync(landing, path.join(parked, 'page.tsx'));
copyFileSync(board, landing);
for (const name of downloads) {
  const from = path.join(publicDir, name);
  if (existsSync(from)) renameSync(from, path.join(parked, name));
}

try {
  execSync('npx next build', {
    cwd: web,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_OFFLINE: '1',
      // Baked in, because the app has no server to ask. SITE is where share
      // links live; API is the account the app can sign in to. Unset either
      // one and the app simply does without that part: the board itself never
      // needs a network.
      NEXT_PUBLIC_SITE_URL: process.env.MECH_SITE_URL ?? SITE,
      NEXT_PUBLIC_API_URL: process.env.MECH_API_URL ?? SITE + '/api',
    },
  });
} finally {
  restore();
}
