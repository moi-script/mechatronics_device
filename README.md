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

## Pages

`/` is the landing page: what the bench holds, how it behaves, and the Android download.
`/board` is the trainer itself. The offline export swaps the two so the APK opens straight
onto the board — see [Android app](#android-app-offline).

## Boards

There are two benches, and a circuit remembers which one it was built on.

**Trainer bench** is the full panel below: supply, buttons, lamps, relays, timers, and the
Festech units.

**Pneumatics board** lays the same stock out for air work — one cylinder to a row, its
valve at the head of the row and a limit switch bolted at each end of the stroke:

    V_A   LS_A0        CYL_A                LS_A1
    valve  a0    [======|rod========]        a1
           home                        end of stroke

Four rows: A and B are double-acting on 5/2 double-solenoid valves, C double-acting on a
spring-return valve, D single-acting on a 3/2. The panels that drive them are bolted along
the top rail in bench order — supply, push-button unit, both relay units, the PLC trainer —
with the air distributors under them and the spare valves and two hand-operated limit
switches parked at the end.

A new pneumatics project starts with all of it down, because that is how the bench is
found in the lab: everything bolted to the rails already, and the work is the tubing and
the wiring between it. The trainer bench still opens nearly bare, where choosing the parts
is part of the exercise.

A mounted limit switch is thrown by the rod arriving, not by being clicked — `a0` is made
while its rod is home, `a1` while it is out — because a limit switch that has to be pressed
by hand is not reporting anything the board did not already know. A loose one, dragged out
of the bin on the trainer bench, is still hand-pressed.

Pick the bench under *Add new project* in the library. Loading a preset switches to the
bench it was built on.

## The board

The trainer bench:

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
terminal wears red. Leads come in blue, green, red, black and yellow. `Esc` cancels a lead in progress, `Del`
removes the selected one.

Drag a module to move it. Dragging across empty board with the mouse draws a marquee and
selects everything it touches, and dragging any selected module moves the whole group;
shift-click adds or removes one. The module you grab is what snaps to the grid, and the
rest shift by that same amount, so a group keeps its relative spacing. `Esc` clears the
selection.

That leaves the left button busy, so panning moved to **hold space** or **middle-button
drag**. Touch is untouched: one finger still pans, which is why the marquee is mouse-only.

Every change to the wiring is undoable: `Ctrl+Z` steps back, `Ctrl+Shift+Z` or `Ctrl+Y`
steps forward, and the toolbar has buttons for both. On phones those two move down beside
the zoom controls, within thumb reach and sized for touch, since the toolbar has no room
for them there. A drag counts as one step rather than
one per pixel, and loading a saved circuit starts a fresh history. Clearing the board asks
first, and is itself undoable.

## Panel sounds

Pressing a push button clicks: a bright transient going down, a duller one coming back up,
the way a real momentary button behaves. Both are short bursts of bandpassed noise
synthesised at runtime, so the app carries no audio files. The speaker control in the
toolbar mutes every panel sound, including the timer alarm, and the choice is remembered.

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

## Circuit files

A circuit saves as a file — `<name>.mech.json` — holding the whole board: parts, leads and
tubing, with a short header naming the format and version.

    { "format": "mechatronic-trainer-circuit", "version": 1, "name": ..., "savedAt": ..., "circuit": { "modules": [...], "wires": [...] } }

**Save as a file** is in the toolbar's overflow menu, and every saved circuit has a send
button in the library. **Open a circuit file** sits beside *Add new project* in the library
and takes it back. In the browser that is a download and a file picker; in the Android app
it is the system share sheet and the device's own picker, so a circuit goes to a classmate
through whatever they already use. Neither end needs an account.

A circuit written straight out of the database, without the header, is accepted too: it is
the same data, and refusing it would be pedantry.

## Accounts

Wiring the board needs no account. Saving does: circuits belong to a person, so pressing
Save while signed out opens the account panel rather than failing. Registering or signing
in there returns to the board with the save intact.

Sessions are a JWT in an httpOnly cookie, so no token is reachable from page scripts.

The Android app is the exception. A Capacitor webview is a different origin from the site,
so the session cookie would be cross-site and Android often drops it: the app sends
`X-Mech-Client: app`, gets the same JWT in the response body, and carries it as a bearer
token. Only a client that asks that way is given one, so the website's session stays out of
reach of scripts. The API answers the app's origin without credentials, since a request
that authenticates itself should carry nothing ambient.

## Sharing

Share turns the circuit on the board into a read-only link. Because the link is served
from the saved copy, sharing an unsaved board folds the save into the same action rather
than refusing it: it asks for a name, then hands back the link. Sharing an already-saved
circuit pushes the current wiring first, so the link never shows a stale board.

The link is shown in a dialog with a copy button rather than announced in the side panel,
which is a drawer that is closed on narrower screens.

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

On the pneumatic side, a valve spool moves with its coil and the rod follows the air, but
the reed sensors only see the piston arrive one full stroke (700 ms) after it sets off. A
sequence stepped along by its own sensors therefore runs at the speed of the rods, not at
the speed of the solver, and the sensor lines agree with what is drawn on screen.

## Worked circuits

The library ships circuits that drop onto the bench whole, parts and leads, so a sequence
can be run and traced before it is built from bare terminals.

| Preset | Bench | What it does |
|---|---|---|
| Three-step lamp sequence | Trainer | A timer lights LAMP1, then each push button steps the lamp along and drops the one before it. |

Two more are built and tested in `packages/sim/src/presets.ts` but not listed in the
library, because they are saved in the accounts that use them and a second copy on the
shelf only invites loading the wrong one:

| Circuit | Bench | What it does |
|---|---|---|
| Pneumatic sequence A+ A- B+ B- | Trainer | One press of button 1 runs both cylinders through the cycle, stepped by the reed sensors on the barrels. |
| A+ A- B+ B- on limit switches | Pneumatics | The same sequence, stepped by the switches the rods run into. |

Both pneumatic ones run the lab sequence: **A+ A- B+ B-**, on two double-acting cylinders,
each on a 5/2 double-solenoid valve. Every step after the first is started by a limit
switch — the reed sensors clamped to each barrel — and relay R2 is the memory that tells
the rear sensor of a cylinder standing at rest from the same sensor reporting a rod that
has just come home, which is the only reason the cycle knows to move on to B rather than
starting B the moment the breaker closes. R3 ends the cycle: it drops R2 and sends B home
off B's own front sensor. The wiring, contact by contact, is commented in
`packages/sim/src/presets.ts`.

The pneumatics-board version wants one relay instead of two, because a limit switch has a
changeover contact where a reed sensor has only a closing one: `a1`'s NC contact is what
drops A+ as the rod arrives, and `b1`'s NC is what drops the memory relay and ends the
cycle.

## Design

`docs/superpowers/specs/2026-08-27-mechatronic-trainer-design.md`

## Android app (offline)

`apps/mobile` wraps the web app with Capacitor. The site is exported as static
files with `NEXT_PUBLIC_OFFLINE=1`, so the board itself needs no API and no
internet, ever.

Accounts are optional there. Circuits are kept on the phone until someone signs
in, and go to their cloud account after that, so the same build serves a student
with no account and one who wants their boards on every device they own. The
live site and API are baked in at build time (`MECH_SITE_URL` and `MECH_API_URL`
override them); leave them unset and the app is device-only.

```bash
npm run apk          # builds apps/mobile/Mechatronic.apk (debug)
npm run open -w @mech/mobile   # open in Android Studio
```

Needs the Android SDK and JDK 21. The server-only `api` and `view` routes are
set aside during the offline export and restored afterwards, and so is the landing
page — the board takes the web root for that build, so the APK's `index.html` is
the trainer rather than a page advertising it.

`npm run apk` also drops a copy at `apps/web/public/mechatronic-trainer.apk`, which is
what the landing page's download button serves. That copy is committed, so rebuild it
whenever the app changes or the site will keep handing out the old one.
