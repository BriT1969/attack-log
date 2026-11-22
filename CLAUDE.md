# Context for working on this repo

Lee's migraine attack logger. Built Oct 2026, replacing a Google Sheets
workbook that had become too laborious to fill in mid-attack. He is an
engineer — 45 years, controls and automation — so reasoning, trade-offs and
honest limitations land better than reassurance.

## The point of the design

The old tracker failed for a structural reason worth not re-creating: its
primitive was "a moment I looked at myself", but every question worth asking
is attack-level — how long, which side, did the warning signs fire, did the
drug work. You cannot answer those from moments without reconstructing them.

Two consequences, both load-bearing:

**Capture timestamps in the moment, characteristics afterwards.** One tap
says an attack started. The six symptom questions are asked at close-out and
are worded *"at any point during it"*, not "right now". The old sheet asked
at onset, which systematically under-reported — an attack scored at 2am
before nausea or photophobia developed reads as tension-type. That bias was
real and measurable: 20 "Tension-type likely" against 6 "Migraine likely",
when the by-type count said 24 migraine days.

**Dark-only and blue-free.** Not a style choice. It gets used at 2am with
photophobia, and blue-white is the wavelength that provokes it hardest. The
chart palette is the one exception, and uses validated non-blue slots.

## Data model

An append-only event log. One row per thing that happened, never edited.
Event types: `attack start`, `attack end`, `attack ended, not yet scored`,
`signal`, `dose`, `dose outcome`, `reading`.

`dose outcome` records whether a dose helped. It reuses existing columns on
purpose, so it needs no change to `Code.gs` and no redeploy: Drug, Drug class,
Attack ID, **Started** = the timestamp of the dose it refers to, and **Note** =
`yes` / `partly` / `no`. The app matches it to the dose by drug and time
(within 2s, as Sheets can round milliseconds); the latest row wins. Never
re-run `setup()` on a live Sheet to add columns — `sheet()` clears the Log.

Re-scoring an attack appends a *second* `attack end` row for the same
`Attack ID`. That is deliberate — a correction is a fact too — and the
Attacks tab de-duplicates with a COUNTIFS that keeps the latest per ID.

The app keeps a local mirror in `localStorage` plus an outbox of unsent
events, so a tap at 2am is instant and survives the signal dropping. On
start-up it reads the whole Log back and rebuilds state from it, which is
what keeps phone and PC in step.

## THE COLUMN CONTRACT — read before changing anything

The Log sheet's 28 columns are a contract between three places. Change one
and the others break *silently*:

1. `LOG_HEADERS` and `toRow()` in `apps-script/Code.gs`
2. the `C` index map in `index.html` (`rebuild()` reads by position)
3. the `Attacks` and `Summary` formulas written by `buildSummary()` /
   `buildAttacks()`, which reference columns by letter

Order: Timestamp, Date, Time, Event, Attack ID, Started, Ended, Type, Side,
Aura, Throbbing, One-sided, Nausea, Light/Sound, Stopped activity, Worse on
movement, Watery eye, Blocked nose, Autonomic side, Signs, Drug, Drug class,
Systolic, Diastolic, Pulse, Dizzy on standing, Note, Source.

Append new columns at the end. Never insert or reorder.

## Scoring

Mirrors the validated screens, and the app and the Sheet must agree:

- **ID Migraine** (0–3) = nausea + light/sound + stopped activity. 2+ is
  roughly 93% likely migraine.
- **POUND** (0–5) = throbbing + duration 4–72h + one-sided + nausea +
  stopped activity.
- **Verdict**: aura with head pain returns "Migraine likely" on its own —
  neither screen contains an aura question, so aura attacks previously came
  out Unclear. Then ID ≥ 2 or POUND ≥ 4 → Migraine likely. ID = 0 and
  POUND ≤ 1 and not worse-on-movement → Tension-type likely. Otherwise
  Unclear, which is a real answer and should not be forced either way.

Medication classes for the rolling 30-day windows: triptan (Sumatriptan,
Naratriptan), combo (Paracetamol+Caffeine+Aspirin, Lemsip), simple
(Paracetamol, Ibuprofen, Naproxen). Thresholds 10/10/15 days. The classes
are **not independent** — the combined any-acute-med count is the one that
matters most, and it is the number to surface.

## Known issues

- **"Drooping or puffy lid" is dead.** It is in the `AUTO` array and can be
  ticked, but `saveScore()` only emits `eye` and `nose`, and the Log has no
  column for it. Either add a column (at the end) or drop the option.
- Four of the imported October attacks have end times that were inferred,
  not measured; where Lee had recorded Attack hours himself, his number was
  used. The 17 Oct evening attack's end time was a guess and flagged in its
  note.
- The Attacks de-duplication uses COUNTIFS with array criteria. It works,
  but the simpler fallback query is written in a note at cell U3 of that
  sheet if it ever misbehaves.

## Rules

- **No secrets in this repo, ever.** The `/exec` URL and token live in each
  device's `localStorage`. No health data either — that is in the Sheet.
- **Nothing computed on the Log sheet.** An ARRAYFORMULA there makes Sheets
  treat those rows as occupied and `appendRow` writes past the bottom of the
  data. Derived values belong on Attacks and Summary.
- `index.html` is one self-contained file: no build step, no bundler, no
  dependencies, markup and styles and script together. Keep it that way —
  it has to be openable from a phone's filesystem.
- Avoid `alert()` / `confirm()` in the Apps Script. `getUi().alert()` run
  from the editor blocks on a dialog in the *spreadsheet* tab and burns the
  six-minute execution limit.
- After changing `Code.gs`, redeploy. Saving is not deploying.

## Tone

Direct, plain, no corporate waffle. Give options rather than one prescribed
answer. Do not over-explain basics. When something is uncertain or was
inferred rather than measured, say so — he would rather know the limitation
than get a confident wrong number.
