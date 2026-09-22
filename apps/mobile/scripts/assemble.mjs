// Builds a debug APK with Gradle and copies it to apps/mobile/Mechatronic.apk,
// and to apps/web/public, which is where the landing page's download link
// points — so the site always hands out the build that was made last.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const android = fileURLToPath(new URL('../android', import.meta.url));
const env = { ...process.env };

// Capacitor 7's Gradle needs JDK 21; newer JDKs on PATH make it fail to start.
if (process.platform === 'win32') {
  const adoptium = 'C:\\Program Files\\Eclipse Adoptium';
  const jdk21 = existsSync(adoptium) && readdirSync(adoptium).find((d) => d.startsWith('jdk-21'));
  if (jdk21) env.JAVA_HOME = path.join(adoptium, jdk21);

  const sdk = path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
  if (!env.ANDROID_HOME && existsSync(sdk)) env.ANDROID_HOME = sdk;
}

const gradlew = process.platform === 'win32' ? path.join(android, 'gradlew.bat') : './gradlew';
execSync(`"${gradlew}" assembleDebug`, { cwd: android, stdio: 'inherit', env });

const apk = fileURLToPath(new URL('../android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url));
const out = fileURLToPath(new URL('../Mechatronic.apk', import.meta.url));
const download = fileURLToPath(new URL('../../web/public/mechatronic-trainer.apk', import.meta.url));
copyFileSync(apk, out);
copyFileSync(apk, download);
console.log('\nAPK ready: ' + out);
console.log('Download copy: ' + download);
