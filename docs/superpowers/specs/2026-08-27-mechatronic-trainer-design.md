# Mechatronic Trainer — Design

**Date:** 2026-08-27
**Status:** Approved

## Purpose

A browser replica of a mechatronics lab trainer board that students cannot reach in
person. The board's inventory is fixed; the exercise is wiring it correctly and
watching it run. Scope is deliberately narrower than Tinkercad: no arbitrary parts,
no analog values.

## Architecture

Monorepo, npm workspaces:

```
packages/sim/   pure TypeScript, no dependencies: part definitions, net solver,
                error checks, exercise grading
apps/web/       Next.js + TypeScript + Tailwind — SVG board, wiring, live state
apps/api/       Express + Mongoose — auth, circuits, share links, grading
```

The solver is a pure function with no React and no database inside it. The browser
calls it on every interaction for instant feedback; the API imports the same package
to grade exercises server-side, so a client cannot fake a pass. One rule set, two
callers, no drift.

## Fixed inventory

| Part | Count | Pins |
|---|---|---|
| Breaker | 1 | none — master switch; open = supply dead |
| Power supply | 1 | 36: six complete rows of six, alternating VCC1-18 and GND1-18 |
| Push button | 6 | 3: NO/COM/NC — momentary, actuated only while held |
| Toggle switch | 3 | 3: NO/COM/NC — latching |
| Lamp | 3 | 2: VCC/GND |
| Relay | 5 | 5: VCC/GND + one NO/COM/NC line |
| Large relay | 2 | 14: VCC/GND + four NO/COM/NC lines |
| Timer | 1 | 5: VCC/GND + one NO/COM/NC line, ON-delay, settable delay |

127 terminals total. Modules are draggable; the inventory cannot change.

### Pin roles

`SOURCE_VCC`, `SOURCE_GND`, `LOAD_VCC`, `LOAD_GND`, `COM`, `NO`, `NC`.
COM conducts to NC at rest and to NO when actuated.

### Assumptions

1. The breaker has no wire terminals; it is the panel master switch.
2. Supply rows 3-6 carry one pin each; rows 1-2 carry six.
3. Every source row is VCC; the board carries no VSS rail. All six rows are complete at
   six pins each, alternating VCC and GND down the panel.

## Wires

```ts
type EndRef =
  | { kind: 'terminal'; moduleId: string; pinId: string }
  | { kind: 'stack';    wireId: string; end: 'A' | 'B' }
  | { kind: 'loose';    x: number; y: number }
```

Each wire end carries one female and one male. The female plugs onto a component post
or onto another end's male; one male hosts exactly one female, so stacking forms a
chain — the banana-plug tower of a real bench. Female-to-female, male-to-male, and
self-referential chains are rejected at connect time. Colors: blue, green, red, black,
yellow.

## Solver

```ts
step(circuit, inputs, prev, dtMs) -> { nets, devices, errors, faulted, state }
```

1. Advance timer accumulators by `dtMs` using the previous pass's coil states, and
   derive each device's actuation.
2. Union-Find over all pin nodes and wire-end nodes. Union each wire's two ends, each
   end to its target, and each COM to NO or NC per actuation.
3. Tag every net `HOT` (contains a live source pin) and/or `GND`.
4. A net tagged both is a short circuit: the breaker trips, the simulation halts, all
   devices go dark, and the net is reported.
5. A load is energized when its `LOAD_VCC` is on a HOT net and its `LOAD_GND` is on a
   GND net. The inverse is a reversed-polarity warning.
6. Recompute contacts from coil states and repeat until stable, capped at 50 passes so
   a self-breaking relay settles instead of hanging the tab.

Errors surfaced to the user: `SHORT_CIRCUIT` and `REVERSED_POLARITY`. Oscillation is
handled by the iteration cap but not reported.

## Board UI

SVG inside a pan/zoom viewport. Dragging a module body moves it on an 8px grid.
Clicking a terminal starts a wire in the toolbar's current colour with a rubber-band
preview; clicking a valid post or an exposed male completes or stacks it. Clicking a
wire selects it for recolour or delete. While running, HOT nets glow warm, lit lamps
bloom, energized coils show a badge, and timers show a countdown. The error panel
lists each fault with a control that flashes the offending net or pin.

Out of scope: undo/redo.

## API and data

```
users     { email, passwordHash, name }
circuits  { ownerId, name, modules[{id,type,x,y}], wires[], inputs, timerDelayMs,
            shareId, isPublic, updatedAt }
exercises { title, brief, startingCircuit, script[] }
attempts  { userId, exerciseId, passed, results[], at }
```

```
POST/GET/PUT/DELETE  /api/circuits[/:id]
GET                  /api/share/:shareId          read-only, unauthenticated
POST                 /api/auth/register|login|logout    GET /api/auth/me
GET                  /api/exercises[/:id]
POST                 /api/exercises/:id/grade     { circuit } -> { passed, results }
```

JWT in an httpOnly cookie. Grading replays an exercise script — set inputs, advance the
clock, assert device states — through the same `step()` the browser uses.

## Build phases

1. `packages/sim` — parts, solver, checks, timer, small test suite
2. Board UI — the wiring exercise, fully usable with no login and no database
3. Express + Mongo — save, load, list
4. Auth — accounts, private circuits
5. Share links and auto-graded exercises
