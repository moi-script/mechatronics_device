# Mechatronic Trainer

A browser replica of the mechatronics lab trainer board, so the wiring exercises can be
practised without the bench. The inventory is fixed and matches the real panel; the work is
running leads between terminals and watching the board behave.

## Stack

| Workspace | What it is |
|---|---|
| `packages/sim` | Pure TypeScript, no dependencies: part definitions, net solver, error checks, grading |
| `apps/web` | Next.js 15 + TypeScript + Tailwind 4 — SVG board, wiring, live simulation |
| `apps/api` | Express + Mongoose — auth, saved circuits, share links, server-side grading |

The solver has no React and no database in it. The browser calls it on every interaction;
the API imports the same package to grade exercises, so a pass cannot be faked client-side.

## Running it

```bash
npm install
cp apps/api/.env.example apps/api/.env   # point MONGODB_URI at your Mongo
npm run seed -w @mech/api                # loads the four lab exercises
npm run dev                              # web on :3000, api on :4000
```

The board itself works with the API down — only saving, sharing and exercises need it.

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
| Timer | 1 | VCC / GND + one NO/COM/NC line, ON-delay, delay set in the toolbar |

## Wiring

Click a terminal, then click a second terminal to run a lead. Each lead end carries a female
and a male: the female goes onto a terminal post or onto another lead's male, and one male
holds exactly one female — so leads stack into a tower the way banana plugs do on a real
bench. Click the brass stub on a plugged lead to stack onto it. Female-to-female,
male-to-male, and chains that loop back on themselves are refused.

Terminals are colour-keyed by function: COM and GND wear black collars, every other
terminal wears red. Leads come in blue, green, red, black and yellow. Drag a module to move it. `Esc` cancels a
lead in progress, `Del` removes the selected one.

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

## Exercises

Four seeded exercises, graded server-side by replaying a script — set inputs, advance the
clock, assert device states — through the same solver the browser runs.

## Design

`docs/superpowers/specs/2026-08-27-mechatronic-trainer-design.md`
