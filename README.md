# Mechatronic Trainer

A browser replica of the mechatronics lab trainer board, so the wiring practice can be
practised without the bench. The inventory is fixed and matches the real panel; the work is
running leads between terminals and watching the board behave.

## Stack

| Workspace | What it is |
|---|---|
| `packages/sim` | Pure TypeScript, no dependencies: part definitions, net solver, error checks |
| `apps/web` | Next.js 15 + TypeScript + Tailwind 4 — SVG board, wiring, live simulation |
| `apps/api` | Express + Mongoose — accounts, saved circuits, share links |

The solver has no React and no database in it, so it stays testable on its own and the UI
is a thin consumer of it.

## Running it

```bash
npm install
cp apps/api/.env.example apps/api/.env   # point MONGODB_URI at your Mongo
cp apps/web/.env.example apps/web/.env.local
npm run dev                              # web on :3000, api on :4000
```

The board itself works with the API down — only saving and sharing need it.

```bash
npm test        # solver test suite
npm run typecheck
```

## The board

| Part | Count | Pins |
|---|---|---|
| Breaker | 1 | none — master switch; open means the supply is dead |
| Power supply | 1 | 36: six complete rows of six pins, alternating VCC and GND (VCC1-18, GND1-18) |
| Push button | 6 | NO / COM / NC — conducts only while held |
| Toggle switch | 3 | NO / COM / NC — latching |
| Lamp | 3 | VCC / GND |
| Relay | 5 | VCC / GND + one NO/COM/NC line |
| Large relay | 2 | VCC / GND + four NO/COM/NC lines |

## Wiring

Click a terminal, then click a second terminal to run a lead. Each lead end carries a female
and a male: the female goes onto a terminal post or onto another lead's male, and one male
holds exactly one female — so leads stack into a tower the way banana plugs do on a real
bench. Click the brass stub on a plugged lead to stack onto it. Female-to-female,
male-to-male, and chains that loop back on themselves are refused.

Terminals are colour-keyed by function: COM and GND wear black collars, every other
terminal wears red. Leads come in blue, green, red, black and yellow. Drag a module to move it. `Esc` cancels a
lead in progress, `Del` removes the selected one.

## Practice timer

The timer is not a board component and is not wired to anything. It is a session alarm
for the activity, and it sits in the toolbar rather than on the panel.

It starts **off**, so you can practise untimed. Turning it **on** means choosing a
duration in minutes - a preset from 5 to 60, or any custom value - after which it counts
down as `MM:SS` and can be paused, restarted, or switched back off. When it reaches zero
it beeps three times, the chip turns red, and the browser tab reads "TIME'S UP" until you
dismiss it.

Because nothing on the board depends on a clock any more, the simulation is purely
event-driven: it re-solves on each interaction instead of ticking.

## Accounts

Wiring the board needs no account. Saving does: circuits belong to a person, so pressing
Save while signed out opens the account panel rather than failing. Registering or signing
in there returns to the board with the save intact.

Sessions are a JWT in an httpOnly cookie, so no token is reachable from page scripts.

## Security

- **Headers** — `helmet` on the API (CSP, HSTS, nosniff, frame-ancestors) and a matching
  set on the Next.js responses.
- **Sessions** — httpOnly, `SameSite=Lax`, `Secure` in production. SameSite is what stops a
  cross-site request from carrying the session, so CORS is not load-bearing for CSRF.
- **Passwords** — bcrypt at cost 12, minimum eight characters. Login compares against a
  dummy hash when the account does not exist, so response time does not reveal which
  addresses are registered.
- **Rate limits** — 300 requests/minute per IP overall; 10 attempts per 15 minutes on
  register and login, counting only failures.
- **Input** — every request body is parsed with `zod` before it reaches the database, and
  ids are checked as ObjectIds so a malformed one is a 404 rather than a 500. Mongoose runs
  with `sanitizeFilter`, so an object like `{"$gt":""}` cannot be smuggled into a query.
- **Ownership** — every circuit read, write and delete is scoped by `ownerId`; a share link
  is a 16-character id that grants read-only access to that one circuit.
- **Secrets** — the API refuses to start in production without a unique `JWT_SECRET` of at
  least 32 characters, and error responses carry no internal detail there.

## Deployment

`docker compose up --build` brings up MongoDB, the API and the web server together. Set the
secret first:

```bash
cp .env.example .env
# then set JWT_SECRET, WEB_ORIGIN, and WEB_PORT in .env
docker compose up --build -d
```

`WEB_PORT` sets the host port the site is published on, so it can move off 3000 when
something else already holds it. Docker Desktop (or another Docker daemon) must be running
before `docker compose` will do anything.

The browser only ever talks to the web origin: a Next.js route handler forwards `/api/*` to
the API service, so the API needs no public exposure and the session cookie stays
same-site. The target is read from `API_URL` per request rather than baked into the build,
so one image works in any environment.

### Vercel + Render

The web app goes on Vercel, the API on Render, and the database on MongoDB Atlas —
Render has no managed MongoDB, so Atlas (free M0 tier) provides it.

Nothing changes architecturally: the browser still only talks to the Vercel origin, and
the Next.js proxy route forwards `/api/*` to Render server-side. The session cookie is set
on the Vercel domain, so it stays same-site and no cross-site cookie config is needed.

```
browser ──► Vercel (Next.js)  ──► Render (Express API) ──► Atlas (MongoDB)
             the only public origin      no public traffic
```

1. **Atlas** — create a free cluster and a database user, allow access from anywhere
   (`0.0.0.0/0`, since Render's egress IPs are not fixed on the free plan), and copy the
   `mongodb+srv://` connection string.
2. **Render** — New → Blueprint, point it at this repo. `render.yaml` creates the API
   service from `Dockerfile.api`. It asks for `MONGODB_URI` (the Atlas string) and
   `WEB_ORIGIN` (your Vercel URL); `JWT_SECRET` is generated for you. Note the service URL
   it hands back.
3. **Vercel** — import the repo. `vercel.json` already sets the monorepo build. Add one
   environment variable, `API_URL`, set to the Render service URL. Redeploy.
4. Go back to Render and set `WEB_ORIGIN` to the Vercel URL now that you have it.

On Render's free plan the API sleeps after inactivity, so the first request after a quiet
spell takes roughly a minute to wake it.

Deploying without Docker: `npm run build -w @mech/web` emits a standalone server at
`apps/web/.next/standalone/apps/web/server.js`, and the API runs with `npm run start -w
@mech/api`. Both need their environment set — see the `.env.example` in each app.

Behind a reverse proxy set `TRUST_PROXY=true` so client IPs and secure cookies resolve
correctly. Only set `CROSS_SITE_COOKIES=true` if the browser calls the API on a different
site instead of through the proxy.

## Themes

Light and dark, toggled from the control at the right of the toolbar. It cycles
system, light, dark, and the choice is remembered. The default follows the OS, and a
pre-paint script sets the theme before first render so nothing flashes.

Dark inverts the steel token ramp rather than renaming it, so every utility keeps its
meaning: `steel-50` stays the quietest surface, `carbon-900` the strongest text. The SVG
panel cannot resolve CSS variables in presentation attributes, so it takes its palette as
values from `src/lib/palette.ts` instead.

## Simulation

Wires are ideal conductors. Connected terminals merge into nets, power floods out from the
supply pins when the breaker is closed, and each device is evaluated: a lamp lights and a
coil energizes when its VCC sits on a live net and its GND on a ground net. Relay contacts
then move and the board is re-solved until nothing changes, which is what makes a
self-holding latch work. Timers accumulate while their coil is energized and throw their
contacts once the delay is up.

Two faults are reported:

- **Short circuit** — a net reaches both a supply pin and a ground pin with no load between
  them. The breaker trips and the board goes dead until it is reset.
- **Reversed polarity** — a device's VCC is on a ground net or its GND is on a live net.

A circuit that never settles (a relay wired to break its own coil) stops at the solver's
50-pass cap rather than hanging.

## Design

`docs/superpowers/specs/2026-08-27-mechatronic-trainer-design.md`
