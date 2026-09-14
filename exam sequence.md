# Exam sequence — wiring, pins and logic

The circuit saved as **exam** on the account `rizskplay@gmail.com`
(https://mechatronicdevice.vercel.app → Load ▸ exam).

> **Rewired for the one-large-relay bench.** The bench now has one large relay (BIG1)
> and a timer relay (TRLY1) where BIG2 used to be. Bit B is carried by three small
> relays, RLY1–RLY3, with their coils in parallel: RLY1 does BIG2's line 1, RLY2 its
> line 2, RLY3 its line 3. The copy saved on the server still uses BIG2 and needs
> re-wiring and re-saving to match this sheet.

Three lamp stages, latched: stage A on the large relay, stage B on three paralleled
small relays. The timer relay, toggles, PB5, PB6, RLY4, RLY5 and the cylinders stay in
the bin.

| | |
|---|---|
| Parts down | BREAKER, SUPPLY, PB1–PB4, LAMP1–LAMP3, BIG1, RLY1–RLY3, TMR1 (14 modules) |
| Leads | 28 |
| Timer set point | 5 s (bench default) |
| Verified | solver run, no wiring errors, no faults |

---

## 1. The idea in one line

Two relay coils are used as **two memory bits**, so three latched stages fit in two
bits (bit B is three small relays switching together):

| State | A = BIG1 | B = RLY1–3 | Lamp lit |
|---|:---:|:---:|---|
| idle | 0 | 0 | — |
| stage 1 | 1 | 0 | LAMP1 (after the timer) |
| stage 2 | 1 | 1 | LAMP2 |
| stage 3 | 0 | 1 | LAMP3 |

so the lamp equations are

```
LAMP1 = A · ¬B · T      (T = timer timed out)
LAMP2 = A ·  B
LAMP3 = ¬A ·  B
```

---

## 2. Operating sequence, step by step

| # | Press | Contact that does the work | Coils after | Lamps | Effect |
|---|---|---|:---:|---|---|
| 0 | — (power up, breaker closed) | — | A=0 B=0 | — | Board idle, timer not counting |
| 1 | **BTN1** | PB1 COM→NO feeds BIG1 VCC | A=1 B=0 | — → LAMP1 | BIG1 latches at once; timer starts; **LAMP1 lights 5 s later** |
| 2 | **BTN2** | PB2 COM→NO through BIG1 COM2→NO2 feeds RLY1–3 VCC | A=1 B=1 | LAMP2 | RLY1 latches the bit. RLY2 NC1 opens → timer drops → LAMP1 off. RLY2 NO1 closes → LAMP2 on |
| 3 | **BTN3** | PB3 COM→NC opens in BIG1's hold | A=0 B=1 | LAMP3 | BIG1 drops → LAMP2 off. BIG1 NC3 feeds RLY3 COM1 → NO1 → LAMP3 on |
| 4 | **BTN1** | PB1 NC opens (drops RLY1–3) **and** PB1 NO closes (picks BIG1 up) | A=1 B=0 | — → LAMP1 | **LAMP3 off instantly**, timer restarts, **LAMP1 back on after 5 s** — the ring |
| 5 | **BTN4** | PB4 COM→NC opens the whole hold rail | A=0 B=0 | — | Both coils drop, timer off, board back to idle |

Steps 1–4 loop for as long as you like; BTN4 is valid at any point.

---

## 3. Pin-by-pin wiring

Every lead is terminal-to-terminal. Colours are the ones the board draws.

### Rail R — the reset, and nothing else

BTN4 sits alone between the supply and everything that latches, so one press kills both
coils. It is wired to no lamp, no timer, and no other button's function.

| # | From | To | Colour | Purpose |
|---|---|---|---|---|
| 1 | SUPPLY **VCC1** | PB4 **COM1** | yellow | Supply into the reset button |
| 2 | PB4 **NC1** | PB1 **COM1** | yellow | Rail R → BTN1 |
| 3 | PB4 **NC1** | PB2 **COM1** | yellow | Rail R → BTN2 |
| 4 | PB4 **NC1** | BIG1 **COM1** | yellow | Rail R → stage 1 hold |

### Stage 1 — BIG1 (bit A)

| # | From | To | Colour | Purpose |
|---|---|---|---|---|
| 5 | PB1 **NO1** | BIG1 **VCC** | red | BTN1 picks the coil up |
| 6 | BIG1 **NO1** | PB3 **COM1** | blue | Self-hold, routed through BTN3 |
| 7 | PB3 **NC1** | BIG1 **VCC** | blue | Hold returns to the coil — BTN3 breaks it |
| 8 | BIG1 **GND** | SUPPLY **GND1** | black | Coil return |

### Stage 2 — RLY1, RLY2, RLY3 (bit B)

| # | From | To | Colour | Purpose |
|---|---|---|---|---|
| 9 | PB2 **NO1** | BIG1 **COM2** | red | BTN2 into BIG1's contact… |
| 10 | BIG1 **NO2** | RLY1 **VCC** | red | …so BTN2 only works while stage 1 is up |
| 11 | PB1 **NC1** | RLY1 **COM1** | blue | Hold feed for bit B — BTN1 breaks it |
| 12 | RLY1 **NO1** | RLY1 **VCC** | blue | Self-hold |
| 13 | RLY1 **GND** | SUPPLY **GND2** | black | Coil return |
| 13a | RLY1 **VCC** | RLY2 **VCC** | red | Coils in parallel… |
| 13b | RLY2 **VCC** | RLY3 **VCC** | red | …so all three switch as one bit |
| 13c | RLY2 **GND** | SUPPLY **GND7** | black | Coil return |
| 13d | RLY3 **GND** | SUPPLY **GND8** | black | Coil return |

### Lamp matrix and timer

| # | From | To | Colour | Purpose |
|---|---|---|---|---|
| 14 | SUPPLY **VCC2** | BIG1 **COM3** | red | Lamp feed into the state splitter |
| 15 | BIG1 **NO3** | RLY2 **COM1** | green | "A on" rail |
| 16 | BIG1 **NC3** | RLY3 **COM1** | green | "A off" rail |
| 17 | RLY2 **NC1** | TMR1 **VCC** | green | A · ¬B → timer coil counts |
| 18 | TMR1 **GND** | SUPPLY **GND3** | black | Timer coil return |
| 19 | TMR1 **COM1** | LAMP1 **VCC** | green | Timed-out output → LAMP1 |
| 20 | RLY2 **NO1** | LAMP2 **VCC** | green | A · B → LAMP2 |
| 21 | RLY3 **NO1** | LAMP3 **VCC** | green | ¬A · B → LAMP3 |
| 22 | LAMP1 **GND** | SUPPLY **GND4** | black | Lamp return |
| 23 | LAMP2 **GND** | SUPPLY **GND5** | black | Lamp return |
| 24 | LAMP3 **GND** | SUPPLY **GND6** | black | Lamp return |

### What each terminal is doing

| Module | Terminal | Wired to | Job |
|---|---|---|---|
| BREAKER | — | — | No terminals. Open = the whole supply is dead |
| SUPPLY | VCC1 | PB4 COM1 | Feed for the reset rail |
| | VCC2 | BIG1 COM3 | Feed for the lamp matrix |
| | GND1–GND8 | BIG1, RLY1–3, TMR1, LAMP1–3 | Returns |
| PB1 (BTN1) | COM1 | rail R | Live whenever reset is not held |
| | NO1 | BIG1 VCC | **Starts stage 1** |
| | NC1 | RLY1 COM1 | **Carries stage 2's hold — pressing BTN1 drops it** |
| PB2 (BTN2) | COM1 | rail R | |
| | NO1 | BIG1 COM2 | Start stage 2, gated by stage 1 |
| | NC1 | *free* | |
| PB3 (BTN3) | COM1 | BIG1 NO1 | Sits inside stage 1's hold |
| | NC1 | BIG1 VCC | **Pressing BTN3 breaks the hold → stage 1 drops** |
| | NO1 | *free* | |
| PB4 (BTN4) | COM1 | SUPPLY VCC1 | |
| | NC1 | rail R | **Pressing BTN4 kills the rail → both coils drop** |
| | NO1 | *free* | |
| BIG1 (bit A) | VCC / GND | PB1 NO1, PB3 NC1 / GND1 | Stage 1 coil |
| | COM1 / NO1 | rail R / PB3 COM1 | Self-hold line |
| | COM2 / NO2 | PB2 NO1 / RLY1 VCC | Gate: BTN2 only works in stage 1 |
| | COM3 / NO3 / NC3 | SUPPLY VCC2 / RLY2 COM1 / RLY3 COM1 | Splits the lamp feed into "A on" and "A off" |
| | line 4 | *free* | Spare |
| RLY1 (bit B, hold) | VCC / GND | BIG1 NO2, RLY1 NO1, RLY2 VCC / GND2 | Stage 2 coil |
| | COM1 / NO1 | PB1 NC1 / RLY1 VCC | Self-hold line |
| RLY2 (bit B) | VCC / GND | RLY1 VCC, RLY3 VCC / GND7 | Paralleled coil |
| | COM1 / NO1 / NC1 | "A on" / LAMP2 / TMR1 VCC | Picks LAMP2 when B is up, the timer when it is not |
| RLY3 (bit B) | VCC / GND | RLY2 VCC / GND8 | Paralleled coil |
| | COM1 / NO1 | "A off" / LAMP3 | Picks LAMP3 |
| TMR1 | VCC / GND | RLY2 NC1 / GND3 | Counts only while A · ¬B (stage 1) |
| | COM1 | LAMP1 VCC | Output — ties to its own VCC once the 5 s runs out |
| LAMP1 | VCC / GND | TMR1 COM1 / GND4 | Lit by the timer |
| LAMP2 | VCC / GND | RLY2 NO1 / GND5 | Lit by A · B |
| LAMP3 | VCC / GND | RLY3 NO1 / GND6 | Lit by ¬A · B |

---

## 4. Logic tables

### 4a. Internal bits → lamps

`A` = BIG1 energized, `B` = RLY1–3 energized, `T` = timer output made (5 s elapsed with
its coil live).

| A | B | T | LAMP1 | LAMP2 | LAMP3 | State |
|:-:|:-:|:-:|:-----:|:-----:|:-----:|---|
| 0 | 0 | 0 | 0 | 0 | 0 | idle |
| 0 | 0 | 1 | 0 | 0 | 0 | *unreachable — timer coil is dead* |
| 0 | 1 | 0 | 0 | 0 | **1** | stage 3 |
| 0 | 1 | 1 | 0 | 0 | **1** | *unreachable* |
| 1 | 0 | 0 | 0 | 0 | 0 | stage 1, still counting |
| 1 | 0 | 1 | **1** | 0 | 0 | stage 1, timed out |
| 1 | 1 | 0 | 0 | **1** | 0 | stage 2 |
| 1 | 1 | 1 | 0 | **1** | 0 | *unreachable — B drops the timer* |

### 4b. 4-bit button word → next state

Buttons as a 4-bit word **`BTN1 BTN2 BTN3 BTN4`**, one bit per button, `1` = pressed.
Only one-hot presses are listed; the board is edge-free, so anything else just applies
the same rules together.

| Present state | A B | `1000` BTN1 | `0100` BTN2 | `0010` BTN3 | `0001` BTN4 |
|---|:---:|---|---|---|---|
| idle | 0 0 | → stage 1 | — | — | — |
| stage 1 | 1 0 | no change — LAMP1 stays as it is | → stage 2 | → idle | → idle |
| stage 2 | 1 1 | → stage 1 | — | → **stage 3** | → idle |
| stage 3 | 0 1 | → **stage 1** | — | — | → idle |

`—` = nothing happens; the press is out of sequence and the wiring simply ignores it.

### 4c. The same thing as a 4-bit state word

State word **`A B T L`** where `L` is "a lamp is lit":

| Word | Meaning | Lamp |
|:---:|---|---|
| `0000` | idle | none |
| `1000` | BTN1 pressed, timer counting | none yet |
| `1011` | 5 s elapsed | LAMP1 |
| `1101` | BTN2 → stage 2 | LAMP2 |
| `0101` | BTN3 → stage 3 | LAMP3 |
| `1000` | BTN1 → back to stage 1, counting again | none yet |
| `0000` | BTN4 → reset | none |

---

## 5. Notes and edge cases

- **BTN1 is the ring.** One changeover does both halves of the step: NO picks stage 1
  up, NC drops stage 2's hold. That is why pressing it in stage 3 turns LAMP3 off the
  instant the contact breaks, before LAMP1 comes on 5 s later.
- **BTN2 is gated.** It runs through BIG1's second contact, so it can only ever make
  stage 2 out of stage 1 — never out of idle or stage 3.
- **BTN3 is a break, not a make.** It has no lamp of its own; it only opens stage 1's
  hold, and stage 3 appears because RLY1–3 are still latched.
- **BTN4 is a hard reset.** It is upstream of every latch, so it clears the board from
  any state, and the timer loses its count with it.
- **Opening the breaker** does the same thing as BTN4 — everything drops and the board
  comes back idle.
- **Timer set point.** Saved circuits store 5 s. The API's save schema drops the
  `delaySec` field, so dialling the timer up in the browser will not survive a save
  until that field is added to the schema.
