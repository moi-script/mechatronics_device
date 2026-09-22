'use client';

import { useEffect } from 'react';
import { ExternalLink, Github, Mail, X } from 'lucide-react';
import { OFFLINE } from '@/lib/api';
import { VERSION_NAME } from './UpdateNotice';
import { BrandMark } from './BrandMark';

/** Copy follows the author's portfolio at portfolio-five-xi-51.vercel.app. */
const AUTHOR = {
  name: 'John Moises',
  role: 'Full-Stack Developer',
  intro: 'Computer Engineering student building full-stack apps with AI features. Open to internships and freelance work.',
  email: 'nugalmoises62@gmail.com',
  github: 'https://github.com/moi-script',
  portfolio: 'https://portfolio-five-xi-51.vercel.app/',
};

const JOURNEY = [
  {
    kicker: 'Before college',
    title: 'Learning C++',
    body: 'Strict and low level. It taught memory, pointers, and logic before anything visual.',
  },
  {
    kicker: '1st year',
    title: 'My first web project',
    body: 'Game Trigger, built for OOP, won 1st place at CompEng Week. That settled it: web development.',
  },
  {
    kicker: '2nd year',
    title: 'My first full-stack app',
    body: 'The Engineering Portal for DSA. Built frontend first, rewrote it, and now designs the schema before anything else.',
  },
  {
    kicker: 'Now',
    title: 'Building Recepta',
    body: 'A MERN app with Azure OCR and RAG, on its way to being a first SaaS.',
  },
];

const PROJECTS = [
  {
    name: 'Recepta',
    summary: 'AI budget tracker: snap a receipt and Azure OCR pulls out the items and prices.',
    tags: ['MERN', 'Azure AI', 'RAG'],
    url: 'https://recepta-phi.vercel.app/',
  },
  {
    name: 'LOCA',
    summary: 'Map-first super-app for nearby businesses, errands, microtasks, and HOA admin.',
    tags: ['MapLibre GL', 'Tailwind v4'],
    url: 'https://github.com/moi-script/centralized_business_map',
  },
  {
    name: 'Profy.ai',
    summary: 'AI crypto trading terminal with live market data, an analysis agent, and paper trading.',
    tags: ['Next.js', 'Python', 'Redis'],
    url: 'https://github.com/moi-script/crypt_dashboard',
  },
  {
    name: 'Engineering Portal',
    summary: 'School portal for admins, teachers, and students with real-time WebSocket chat.',
    tags: ['React', 'Spring Boot', 'WebSocket'],
    url: 'https://engineering-portal-front.vercel.app/',
  },
  {
    name: 'Game Trigger',
    summary: 'Browser reaction game with a real-time loop and Web Audio sound. 1st place, CpE Week.',
    tags: ['JavaScript', 'Web Audio API'],
    url: 'https://trigger-game-project.vercel.app/',
  },
];

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="engraved mb-2 text-[10px] font-bold tracking-wider text-carbon-600">{children}</h3>;
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const linkClass =
    'inline-flex items-center gap-1.5 rounded-sm border border-steel-400 bg-steel-100 px-2.5 py-1.5 text-[11px] font-semibold text-carbon-800 hover:bg-steel-200';

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-carbon-900/45 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-steel-400 bg-steel-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-steel-300 bg-steel-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <BrandMark className="h-6 w-6" />
            <h2 id="about-title" className="engraved text-xs font-bold text-carbon-900">
              About Mechatronic
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-carbon-600 hover:text-carbon-900">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <section>
            <p className="text-xs leading-relaxed text-carbon-800">
              A replica of the mechatronics lab trainer board, built so the course can be practiced away from the
              lab. Wire the Festech bench modules, close the breaker, and watch the relay logic run.
            </p>
            {OFFLINE && (
              <p className="mt-2 text-[11px] leading-relaxed text-carbon-600">
                This is the Android app. The board runs entirely on the phone, with no network needed. Circuits are
                kept on the device until you sign in, and go to your account after that. Either way a circuit can be
                sent as a file, which is the way to hand one to someone who has no account.
              </p>
            )}
            {OFFLINE && VERSION_NAME && (
              <p className="mt-2 font-mono text-[10px] text-carbon-600">
                Version {VERSION_NAME}. It checks for a newer one when you open it.
              </p>
            )}
          </section>

          <section className="rounded-md border border-steel-300 bg-steel-100 p-3">
            <Heading>BUILT BY</Heading>
            <p className="text-sm font-bold text-carbon-900">{AUTHOR.name}</p>
            <p className="font-mono text-[11px] text-signal-amber">{AUTHOR.role}</p>
            <p className="mt-2 text-xs leading-relaxed text-carbon-800">{AUTHOR.intro}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <a href={`mailto:${AUTHOR.email}`} className={linkClass}>
                <Mail className="h-3.5 w-3.5" />
                Email
              </a>
              <a href={AUTHOR.github} target="_blank" rel="noreferrer" className={linkClass}>
                <Github className="h-3.5 w-3.5" />
                GitHub
              </a>
              <a href={AUTHOR.portfolio} target="_blank" rel="noreferrer" className={linkClass}>
                <ExternalLink className="h-3.5 w-3.5" />
                Portfolio
              </a>
            </div>
          </section>

          <section>
            <Heading>HOW I GOT HERE</Heading>
            <ol className="relative space-y-3 border-l-2 border-steel-400 pl-4">
              {JOURNEY.map((j) => (
                <li key={j.title} className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-steel-50 bg-signal-amber" />
                  <p className="font-mono text-[10px] text-carbon-600">{j.kicker}</p>
                  <p className="text-xs font-semibold text-carbon-900">{j.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-carbon-600">{j.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <Heading>OTHER PROJECTS</Heading>
            <ul className="space-y-1.5">
              {PROJECTS.map((p) => (
                <li key={p.name}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-steel-300 bg-steel-100 px-3 py-2 transition hover:border-carbon-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-carbon-900">{p.name}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-carbon-600" />
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-carbon-600">{p.summary}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-sm bg-steel-200 px-1.5 py-0.5 font-mono text-[9px] text-carbon-800"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
