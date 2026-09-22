// The app's version, derived from the repository rather than typed in.
//
// Android decides what is newer by versionCode alone, so it has to climb with
// every build or a phone cannot tell an old APK from a new one. The commit
// count does that by itself and needs nobody to remember anything.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Builds since the repository started. Monotonic, and the same for everyone. */
function commitCount() {
  try {
    return Number(execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim());
  } catch {
    // A source copy with no git history still has to build.
    return 1;
  }
}

export function appVersion() {
  // Overridable so a build can be given a deliberately older version, which is
  // the only way to see the update notice without waiting for another commit.
  const code = Number(process.env.MECH_VERSION_CODE) || commitCount();
  return { versionCode: code, versionName: `1.${code}` };
}

/**
 * Hand the version to Gradle as a properties file, so the Android build does
 * not have to know about git.
 */
export function writeGradleVersion() {
  const { versionCode, versionName } = appVersion();
  const out = fileURLToPath(new URL('../android/version.properties', import.meta.url));
  writeFileSync(out, `versionCode=${versionCode}\nversionName=${versionName}\n`);
  return { versionCode, versionName };
}
