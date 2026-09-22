import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, Github, MoveRight } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { HeroCircuit } from '@/components/landing/HeroCircuit';

export const metadata: Metadata = {
  title: 'Mechatronic Trainer — practice the lab board anywhere',
  description:
    'A working replica of the mechatronics lab trainer board at the National College of Science and Technology, for ECE, BSCOE, EE and IE students. Run leads between real terminals, close the breaker, and watch the relay logic run — on the web, or as an offline Android app.',
};

/** The file served from apps/web/public, kept in step by the APK build script. */
const APK = { href: '/mechatronic-trainer.apk', size: '4.8 MB', version: '1.0', android: 'Android 6.0 and up' };
const REPO = 'https://github.com/moi-script/mechatronics_device';

/** The programs that take the mechatronics laboratory at NCST. */
const PROGRAMS = [
  { code: 'ECE', name: 'Electronics Engineering' },
  { code: 'BSCOE', name: 'Computer Engineering' },
  { code: 'EE', name: 'Electrical Engineering' },
  { code: 'IE', name: 'Industrial Engineering' },
];

/** The bench inventory, matching packages/sim exactly. */
const BENCH = [
  { part: 'Breaker', count: 1, note: 'Master switch. Open means the supply is dead.' },
  { part: '24V supply', count: 1, note: '36 pins — six rows alternating VCC and GND.' },
  { part: 'Push buttons', count: 6, note: 'NO / COM / NC, conducting only while held.' },
  { part: 'Toggle switches', count: 3, note: 'The same three terminals, latching.' },
  { part: 'Lamps', count: 3, note: 'VCC and GND. Lights on a live net.' },
  { part: 'Relays', count: 5, note: 'A coil and one changeover line each.' },
  { part: 'Large relay', count: 1, note: 'One coil driving four changeover lines.' },
  { part: 'Timer relays', count: 4, note: 'On-delay: counts while the coil is live, then throws.' },
  { part: 'Solenoid valves', count: 4, note: '5/2 single, 5/2 double, 3/2 NC, and the air distributor.' },
  { part: 'Cylinders', count: 4, note: 'Double and single acting, with reed sensors on the barrel.' },
  { part: 'Festech units', count: 5, note: 'Supply, push-button and relay units, limit switch, PLC CP1E.' },
];

const BEHAVIOUR = [
  {
    title: 'Leads stack the way banana plugs stack',
    body: 'Every lead end carries a female and a male. The female drops onto a terminal post or onto another lead, and one male holds exactly one female — so a busy terminal grows a tower, exactly like the bench. Female onto female is refused, and so is a chain that loops back on itself.',
  },
  {
    title: 'The board re-solves until it settles',
    body: 'Connected terminals merge into nets, power floods out from the supply once the breaker is closed, then every coil and lamp is evaluated and the contacts that moved send it round again. That last part is what makes a self-holding latch hold.',
  },
  {
    title: 'Two faults, reported the way the bench reports them',
    body: 'Short a net across supply and ground with no load between them and the breaker trips, leaving the board dead until you reset it. Put a device the wrong way round and it reads as reversed polarity rather than quietly working.',
  },
  {
    title: 'A practice timer, kept off the panel',
    body: 'The session alarm sits in the toolbar, not on the board, because nothing you wire depends on a clock. Set five minutes or sixty, or leave it off and practice untimed.',
  },
];

const INSTALL = [
  'Download the APK on the phone itself, or copy it across.',
  'Open the file. Android asks once whether this browser or file manager may install apps — allow it.',
  'Tap Install. The trainer then runs with no account and no network.',
];

export default function Page() {
  return (
    <div className="min-h-dvh bg-steel-200">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
        <span className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="font-cond text-[15px] font-bold whitespace-nowrap text-carbon-900 sm:text-base">Mechatronic Trainer</span>
        </span>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#bench" className="hidden text-carbon-600 hover:text-carbon-900 sm:inline">
            The bench
          </a>
          <a href="#android" className="hidden text-carbon-600 hover:text-carbon-900 sm:inline">
            Android
          </a>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            aria-label="Source on GitHub"
            className="text-carbon-600 hover:text-carbon-900"
          >
            <Github className="h-[18px] w-[18px]" />
          </a>
          <Link
            href="/board"
            className="hidden rounded-sm border border-steel-400 bg-steel-100 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-carbon-900 hover:bg-steel-50 sm:block"
          >
            Open the board
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pt-8 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pt-16">
          <div>
            <h1 className="font-cond text-[2.75rem] leading-[1.02] font-bold tracking-tight text-carbon-900 sm:text-6xl">
              The trainer board,
              <br />
              without booking the lab.
            </h1>
            <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-carbon-800">
              This is the mechatronics bench you already know: the same fixed inventory, the same terminals, the same
              leads. Run a lead from the supply, through a button, to a lamp. Close the breaker and find out whether you
              wired it right.
            </p>
            <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-carbon-600">
              Built for the engineering students of the National College of Science and Technology. Nothing to install
              to try it, and no account until you want to save a circuit.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/board"
                className="inline-flex items-center gap-2 rounded-sm bg-signal-amber px-5 py-3 text-[15px] font-bold text-carbon-900 shadow-sm hover:brightness-105"
              >
                Open the board
                <MoveRight className="h-4 w-4" />
              </Link>
              <a
                href={APK.href}
                download
                className="inline-flex items-center gap-2 rounded-sm border border-steel-400 bg-steel-100 px-5 py-3 text-[15px] font-semibold text-carbon-900 hover:bg-steel-50"
              >
                <Download className="h-4 w-4" />
                Download for Android
                <span className="font-mono text-xs font-normal text-carbon-600">{APK.size}</span>
              </a>
            </div>
          </div>
          <HeroCircuit className="w-full" />
        </section>

        <section className="border-t border-steel-400 bg-steel-50">
          <div className="mx-auto max-w-5xl px-5 py-9">
            <h2 className="font-cond text-xl font-bold text-carbon-900">
              NCST, the National College of Science and Technology
            </h2>
            <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-carbon-600">
              The panel here is the one in the engineering laboratory, part for part, so the wiring you practice at home
              is the wiring you are marked on in the lab. It follows the course for all four programs.
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-steel-300 pt-5 sm:grid-cols-4">
              {PROGRAMS.map((p) => (
                <div key={p.code}>
                  <dt className="font-mono text-sm font-semibold text-carbon-900">{p.code}</dt>
                  <dd className="mt-0.5 text-xs leading-snug text-carbon-600">{p.name}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="bench" className="border-y border-steel-400 bg-steel-100">
          <div className="mx-auto max-w-5xl px-5 py-16">
            <h2 className="font-cond text-3xl font-bold text-carbon-900">What comes on the bench</h2>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-carbon-600">
              The inventory is fixed, like the real trainer. Parts wait in the bin and go back to their own slot on the
              panel — nothing is ever conjured up beyond this list.
            </p>
            <dl className="mt-8 divide-y divide-steel-300 border-t border-steel-300">
              {BENCH.map((b) => (
                <div key={b.part} className="grid grid-cols-[2.5rem_1fr] gap-x-4 py-3 sm:grid-cols-[2.5rem_11rem_1fr]">
                  <dt className="font-mono text-sm tabular-nums text-signal-amber">{b.count}×</dt>
                  <dd className="text-sm font-semibold text-carbon-900">{b.part}</dd>
                  <dd className="col-span-2 text-sm leading-relaxed text-carbon-600 sm:col-span-1">{b.note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="font-cond text-3xl font-bold text-carbon-900">How it behaves</h2>
          <div className="mt-8 grid gap-x-12 gap-y-9 sm:grid-cols-2">
            {BEHAVIOUR.map((b) => (
              <article key={b.title}>
                <h3 className="text-[15px] font-bold text-carbon-900">{b.title}</h3>
                <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-carbon-600">{b.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="android" className="border-t border-steel-400 bg-steel-100">
          <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <h2 className="font-cond text-3xl font-bold text-carbon-900">Take it on the phone</h2>
              <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-carbon-800">
                The Android build carries the whole trainer inside the app, so it works with the data off. Circuits you
                save there stay on the device, and sharing is hidden because there is no server behind it.
              </p>
              <ol className="mt-7 space-y-4 pl-8">
                {INSTALL.map((step, i) => (
                  <li key={step} className="relative text-sm leading-relaxed text-carbon-800">
                    <span className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full bg-signal-amber font-mono text-[11px] font-bold text-carbon-900">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-6 max-w-[58ch] text-sm leading-relaxed text-carbon-600">
                It is a debug build signed with a development key, which is why Android asks before installing it. To
                build your own instead,{' '}
                <a href={REPO} target="_blank" rel="noreferrer" className="font-semibold text-carbon-900 underline">
                  the source is on GitHub
                </a>{' '}
                and <code className="font-mono text-[13px]">npm run apk</code> makes this same file.
              </p>
            </div>

            <div className="h-fit rounded-lg border border-steel-400 bg-steel-50 p-5 shadow-sm">
              <BrandMark className="h-10 w-10" />
              <p className="mt-3 font-cond text-lg font-bold text-carbon-900">Mechatronic</p>
              <p className="text-sm text-carbon-600">Offline Android app</p>
              <a
                href={APK.href}
                download
                className="mt-5 flex items-center justify-center gap-2 rounded-sm bg-signal-amber px-4 py-3 text-[15px] font-bold text-carbon-900 hover:brightness-105"
              >
                <Download className="h-4 w-4" />
                Download the APK
              </a>
              <dl className="mt-5 space-y-2 border-t border-steel-300 pt-4 font-mono text-xs text-carbon-600">
                {[
                  ['Version', APK.version],
                  ['Size', APK.size],
                  ['Requires', APK.android],
                  ['Network', 'None'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt>{k}</dt>
                    <dd className="text-carbon-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-steel-400">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-carbon-600">
          <p>
            Built by{' '}
            <a
              href="https://portfolio-five-xi-51.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-carbon-900"
            >
              John Moises
            </a>
            {' '}for the NCST engineering laboratory. Not affiliated with NCST or Festech.
          </p>
          <Link href="/board" className="font-semibold text-carbon-900">
            Open the board
          </Link>
        </div>
      </footer>
    </div>
  );
}
