/**
 * Circuits as files, so a board can leave the device it was built on: hand one
 * to a classmate over chat, keep a copy in your own storage, open it on the
 * phone after building it on the laptop.
 *
 * The file is the circuit as JSON with a short header, because a circuit is
 * already plain data — the sim owns its shape, and anything that can read JSON
 * can read one of these.
 */
import type { Circuit } from '@mech/sim';
import { Capacitor } from '@capacitor/core';

export const FILE_FORMAT = 'mechatronic-trainer-circuit';
export const FILE_VERSION = 1;
export const FILE_EXT = '.mech.json';

export interface ProjectFile {
  format: typeof FILE_FORMAT;
  version: number;
  name: string;
  savedAt: string;
  circuit: Circuit;
}

/** A file name that survives every filesystem, built from the circuit's name. */
export function fileNameFor(name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'circuit';
  return slug + FILE_EXT;
}

export const serialize = (name: string, circuit: Circuit): string =>
  JSON.stringify(
    { format: FILE_FORMAT, version: FILE_VERSION, name, savedAt: new Date().toISOString(), circuit } as ProjectFile,
    null,
    2,
  );

/**
 * Read a file back. A circuit saved straight out of the database, or copied
 * out of a share link, is accepted too: it is the same data without the
 * header, and refusing it would be pedantry.
 */
export function parse(text: string): { name: string; circuit: Circuit } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not a circuit: it is not JSON at all.');
  }
  const doc = data as Partial<ProjectFile> & { modules?: unknown; wires?: unknown };
  const circuit = (doc.circuit ?? doc) as Partial<Circuit>;

  if (!Array.isArray(circuit.modules) || !Array.isArray(circuit.wires)) {
    throw new Error('That file has no circuit in it: a circuit needs modules and wires.');
  }
  if (doc.version !== undefined && typeof doc.version === 'number' && doc.version > FILE_VERSION) {
    throw new Error('That file was written by a newer version of the trainer. Update the app and try again.');
  }
  for (const m of circuit.modules) {
    if (!m || typeof m.id !== 'string' || typeof m.type !== 'string') throw new Error('That file has a broken part list.');
  }
  for (const w of circuit.wires) {
    if (!w || typeof w.id !== 'string' || !w.a || !w.b) throw new Error('That file has a broken lead list.');
  }

  return {
    name: typeof doc.name === 'string' && doc.name.trim() ? doc.name.trim() : 'Imported circuit',
    circuit: { modules: circuit.modules, wires: circuit.wires },
  };
}

const native = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Hand the file to the device. In the browser that is a download; in the app
 * it is the Android share sheet, which is where "send this to a classmate"
 * actually lives — chat apps, mail, Drive, or just saving it.
 */
export async function exportCircuit(name: string, circuit: Circuit): Promise<'shared' | 'downloaded'> {
  const text = serialize(name, circuit);
  const fileName = fileNameFor(name);

  if (native()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    // Cache, not Documents: the copy only has to live long enough to be shared,
    // and writing there needs no storage permission on any Android version.
    const written = await Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: name, text: name, url: written.uri, dialogTitle: 'Send this circuit' });
    return 'shared';
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked late: Safari reads the blob after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** Read a circuit out of a file the person picked. */
export async function importCircuit(file: File): Promise<{ name: string; circuit: Circuit }> {
  if (file.size > 2_000_000) throw new Error('That file is far too big to be a circuit.');
  return parse(await file.text());
}
