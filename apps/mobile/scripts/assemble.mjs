// Builds the APK with Gradle and publishes it: a copy at
// apps/mobile/Mechatronic.apk, and one in apps/web/public, which is what the
// landing page hands out and what an installed app checks against.
//
// Alongside it goes apk-version.json — the newest version and where to get it.
// An app asks for that file on startup, and that is the whole update check:
// no store, no release API, just a small file next to the download.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGradleVersion } from './version.mjs';

const android = fileURLToPath(new URL('../android', import.meta.url));
const env = { ...process.env };

// Gradle reads this; it has to be written before the build, not after.
const { versionCode, versionName } = writeGradleVersion();
console.log(`Assembling version ${versionName} (code ${versionCode})`);

// Capacitor 7's Gradle needs JDK 21; newer JDKs on PATH make it fail to start.
if (process.platform === 'win32') {
  const adoptium = 'C:\\Program Files\\Eclipse Adoptium';
  const jdk21 = existsSync(adoptium) && readdirSync(adoptium).find((d) => d.startsWith('jdk-21'));
  if (jdk21) env.JAVA_HOME = path.join(adoptium, jdk21);

  const sdk = path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
  if (!env.ANDROID_HOME && existsSync(sdk)) env.ANDROID_HOME = sdk;
}

// With a signing key set up, build the release APK, which is the one that can
// update an installed app. Without one, the debug build is what there is.
const signed = existsSync(fileURLToPath(new URL('../keystore.properties', import.meta.url)));
const variant = signed ? 'Release' : 'Debug';
console.log(signed ? 'Signing with the release key.' : 'No release key: building debug signed.');

const gradlew = process.platform === 'win32' ? path.join(android, 'gradlew.bat') : './gradlew';
execSync(`"${gradlew}" assemble${variant}`, { cwd: android, stdio: 'inherit', env });

const built = signed ? 'release/app-release.apk' : 'debug/app-debug.apk';
const apk = fileURLToPath(new URL('../android/app/build/outputs/apk/' + built, import.meta.url));
const out = fileURLToPath(new URL('../Mechatronic.apk', import.meta.url));
const download = fileURLToPath(new URL('../../web/public/mechatronic-trainer.apk', import.meta.url));
const manifest = fileURLToPath(new URL('../../web/public/apk-version.json', import.meta.url));

copyFileSync(apk, out);
copyFileSync(apk, download);

writeFileSync(
  manifest,
  JSON.stringify(
    {
      versionCode,
      versionName,
      // Relative, so it works on whatever origin the site is served from.
      url: '/mechatronic-trainer.apk',
      bytes: statSync(download).size,
      releasedAt: new Date().toISOString().slice(0, 10),
      signed: signed ? 'release' : 'debug',
    },
    null,
    2,
  ) + '\n',
);

console.log('\nAPK ready: ' + out);
console.log('Download copy: ' + download);
console.log('Published version: ' + manifest);
