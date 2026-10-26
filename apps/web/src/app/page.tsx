import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import { Download, MoveRight } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { HeroCircuit } from '@/components/landing/HeroCircuit';
import { ApkDownloadLink, DownloadCount } from '@/components/ApkDownload';
import published from '../../public/apk-version.json';

export const metadata: Metadata = {
  title: 'Mechatronic Trainer — practice the lab board anywhere',
  description:
    'A working replica of the mechatronics lab trainer board at the National College of Science and Technology, for ECE, BSCOE, EE and IE students. Run leads between real terminals, close the breaker, and watch the relay logic run — on the web, or as an offline Android app.',
};

/**
 * What the APK build last published. Read from the file it writes, so the
 * numbers on this page cannot drift away from the file being handed out — and
 * it is the same file an installed app checks to see whether it is behind.
 */
const APK = {
  href: published.url,
  size: (published.bytes / 1_000_000).toFixed(1) + ' MB',
  version: published.versionName,
  released: new Date(published.releasedAt + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }),
  android: 'Android 6.0 and up',
};

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
    title: 'A circuit is a file you can send',
    body: 'Save the board as a file and it carries the whole thing: every part, every lead, every length of tubing. Send it over chat, open it on another device, or keep it yourself. Nobody needs an account at either end, which is what makes it the honest way to share work with a classmate.',
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

/** The small amber label over each section, engraved like a panel legend. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="font-cond text-[13px] font-bold tracking-[0.12em] text-signal-amber uppercase">{children}</span>;
}

const H2 = 'mt-2.5 text-3xl font-extrabold tracking-[-0.01em] text-carbon-900 sm:text-4xl';
const WRAP = 'mx-auto max-w-[1180px] px-5 sm:px-6';

export default function Page() {
  return (
    <div className="min-h-dvh bg-[var(--page)]">
      <header className="border-b border-steel-300">
        <div className={WRAP + ' flex flex-wrap items-center gap-x-6 gap-y-3 py-3.5'}>
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="h-8 w-8" />
            <span className="text-base font-bold whitespace-nowrap text-carbon-900">Mechatronic Trainer</span>
          </Link>
          <nav aria-label="Main" className="hidden gap-5 text-sm md:flex">
            <a href="#bench" className="text-carbon-800 hover:text-carbon-900">
              The bench
            </a>
            <a href="#behaves" className="text-carbon-800 hover:text-carbon-900">
              How it behaves
            </a>
            <a href="#android" className="text-carbon-800 hover:text-carbon-900">
              Android app
            </a>
          </nav>
          <div className="flex-1" />
          <Link
            href="/board"
            className="inline-flex h-10 items-center rounded-[9px] bg-signal-amber px-4 text-sm font-bold whitespace-nowrap text-[#1a1204] hover:brightness-110"
          >
            Open the board
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className={WRAP + ' flex flex-wrap items-center gap-14 pt-14 pb-16 lg:pt-[72px]'}>
          <div className="min-w-0 flex-[1_1_440px]">
            <span className="inline-flex h-7 items-center gap-2 rounded-full border border-steel-400 px-3 font-cond text-xs font-semibold tracking-[0.1em] text-carbon-800">
              <span className="h-2 w-2 rounded-full bg-run-green shadow-[0_0_8px_var(--color-run-green)]" />
              NCST ENGINEERING LABORATORY
            </span>
            <h1 className="mt-5 text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.02em] text-carbon-900 sm:text-[56px]">
              The trainer board,
              <br />
              <span className="text-signal-amber">without booking the lab.</span>
            </h1>
            <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-carbon-800">
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
                className="inline-flex h-[50px] items-center gap-2.5 rounded-[11px] bg-signal-amber px-[22px] text-base font-bold text-[#1a1204] hover:brightness-110"
              >
                Open the board
                <MoveRight className="h-4 w-4" />
              </Link>
              {/* The button and its tally travel together, so the count stays beside the thing it counts. */}
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-2">
                <ApkDownloadLink
                  href={APK.href}
                  className="inline-flex h-[50px] items-center gap-2.5 rounded-[11px] border border-steel-400 px-5 text-base font-semibold text-carbon-900 hover:bg-steel-200"
                >
                  <Download className="h-4 w-4" />
                  Download for Android
                </ApkDownloadLink>
                <DownloadCount className="text-[13px] text-carbon-600" />
              </span>
            </div>
          </div>
          <HeroCircuit className="min-w-0 flex-[1_1_460px]" />
        </section>

        {/* NCST band */}
        <section className="border-y border-steel-300 bg-steel-50">
          <div className={WRAP + ' flex flex-wrap items-start gap-6 py-8'}>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[14px] border border-steel-400 font-cond text-sm font-bold text-signal-amber">
              NCST
            </div>
            <div className="min-w-0 flex-[1_1_420px]">
              <h2 className="text-xl font-bold text-carbon-900">NCST, the National College of Science and Technology</h2>
              <p className="mt-1.5 max-w-[70ch] text-[15px] leading-relaxed text-carbon-600">
                The panel here is the one in the engineering laboratory, part for part, so the wiring you practice at
                home is the wiring you are marked on in the lab. It follows the course for all four programs.
              </p>
              <dl className="mt-5 flex flex-wrap gap-2">
                {PROGRAMS.map((p) => (
                  <div key={p.code} className="rounded-[10px] border border-steel-300 bg-steel-100 px-3 py-2">
                    <dt className="font-mono text-[13px] font-bold text-carbon-900">{p.code}</dt>
                    <dd className="text-xs text-carbon-600">{p.name}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* What comes on the bench */}
        <section id="bench" className={WRAP + ' pt-[72px] pb-6'}>
          <Eyebrow>The inventory</Eyebrow>
          <h2 className={H2}>What comes on the bench</h2>
          <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-carbon-600">
            The inventory is fixed, like the real trainer. Parts wait in the bin and go back to their own slot on the
            panel — nothing is ever conjured up beyond this list.
          </p>
          <dl className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {BENCH.map((b) => (
              <div key={b.part} className="rounded-[14px] border border-steel-300 bg-steel-50 p-[18px]">
                <dd className="font-mono text-3xl font-bold text-signal-amber tabular-nums">{b.count}</dd>
                <dt className="mt-1 font-semibold text-carbon-900">{b.part}</dt>
                <dd className="mt-0.5 text-[13px] leading-snug text-carbon-600">{b.note}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it behaves */}
        <section id="behaves" className={WRAP + ' py-14'}>
          <Eyebrow>The simulation</Eyebrow>
          <h2 className={H2}>How it behaves</h2>
          <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-x-12 gap-y-9">
            {BEHAVIOUR.map((b, i) => (
              <article key={b.title} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-steel-200 font-mono font-bold text-signal-amber">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-base font-bold text-carbon-900">{b.title}</h3>
                  <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-carbon-600">{b.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Android */}
        <section id="android" className="border-t border-steel-300 bg-steel-50">
          <div className={WRAP + ' flex flex-wrap items-start gap-14 py-[72px]'}>
            <div className="min-w-0 flex-[1_1_480px]">
              <Eyebrow>Android · works offline</Eyebrow>
              <h2 className={H2}>Take it on the phone</h2>
              <p className="mt-2 font-mono text-xs text-carbon-600">
                Latest build {APK.version} · released {APK.released}
              </p>
              <p className="mt-[18px] max-w-[58ch] text-base leading-relaxed text-carbon-800">
                The Android build carries the whole trainer inside the app, so it works with the data off. Circuits are
                kept on the phone until you sign in; after that they go to your account, and any device you sign in on
                opens them. Either way a circuit can be sent as a file, which is how you hand one to a classmate who
                has no account.
              </p>
              <ol className="mt-7 flex max-w-[60ch] flex-col gap-4">
                {INSTALL.map((step, i) => (
                  <li key={step} className="flex items-start gap-3.5 text-[15px] leading-normal text-carbon-900">
                    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-signal-amber font-mono text-[13px] font-bold text-[#1a1204]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-7 max-w-[62ch] text-sm leading-relaxed text-carbon-600">
                Android asks before installing anything that did not come from the Play Store, which is why it warns
                you. Once installed, the app checks this page on startup and offers you the newer build when there is
                one. Coming from a build older than 1.44 means uninstalling that one first — it was signed with a
                temporary key, and Android will not update across a change of key.
              </p>
            </div>

            <aside
              aria-label="Android app"
              className="min-w-[280px] flex-[0_1_340px] rounded-2xl border border-steel-400 bg-steel-100 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
            >
              <BrandMark className="h-12 w-12" />
              <h3 className="mt-4 text-xl font-bold text-carbon-900">Mechatronic</h3>
              <p className="mt-1 text-sm text-carbon-600">Offline Android app</p>
              <ApkDownloadLink
                href={APK.href}
                className="mt-5 flex h-[50px] items-center justify-center gap-2.5 rounded-[11px] bg-signal-amber text-[15px] font-bold text-[#1a1204] hover:brightness-110"
              >
                <Download className="h-4 w-4" />
                Download the APK
              </ApkDownloadLink>
              <dl className="mt-[22px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 border-t border-steel-300 pt-[18px] font-mono text-[13px]">
                {[
                  ['Version', APK.version],
                  ['Size', APK.size],
                  ['Released', APK.released],
                  ['Requires', APK.android],
                ].map(([k, v]) => (
                  <Fragment key={k}>
                    <dt className="text-carbon-600">{k}</dt>
                    <dd className="text-right text-carbon-900">{v}</dd>
                  </Fragment>
                ))}
                <dt className="text-carbon-600">Network</dt>
                <dd className="text-right text-green-ink">None needed</dd>
                <dt className="text-carbon-600">Downloads</dt>
                <dd className="text-right text-carbon-900">
                  <DownloadCount labelled={false} />
                </dd>
              </dl>
            </aside>
          </div>
        </section>
      </main>

      <footer className="border-t border-steel-400">
        <div className={WRAP + ' flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-carbon-600'}>
          <p>
            Built by{' '}
            <a
              href="https://portfolio-five-xi-51.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-carbon-900"
            >
              John Moises
            </a>{' '}
            for the NCST engineering laboratory. Not affiliated with NCST or Festech.
          </p>
          <Link href="/board" className="font-semibold text-carbon-900">
            Open the board
          </Link>
        </div>
      </footer>
    </div>
  );
}
