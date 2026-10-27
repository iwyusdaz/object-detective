# Agent review: cognitive walkthrough

Agent review (reviewer sub-agent). **Persona:** Amara, 14, grade 9 (`design/personas.md:7`). She treats labels as fact and is new to sourcing. She plays the 3D mode on a school Chromebook-class laptop with a mouse and keyboard. **Path:** Welcome → Case 1 (tutorial) → Case 2 claim M4 (the relay number) and M5 (Joseph Henry) → debrief. At each step: (Q1) will she know what to do? (Q2) will she see progress? (Q3) will she get usable feedback? Steps were exercised headless on port 4192.

| # | Step | Q1 Know what to do? | Q2 See progress? | Q3 Usable feedback? | Notes / evidence |
|---|---|---|---|---|---|
| 1 | Welcome, pre-check (4 items) | Yes | Partly: no "1 of 4" counter | Yes: why-text per option (`items.json`) | `31-default-preset-welcome.png` |
| 2 | "Start the shift" → S1 plays | **No**: the Brief panel is live beside the cinematic, and it is unclear whether to watch or read | Yes: "Shot 1 of 1 — purpose: orient" | n/a | `40-s1-first-frame.png`. Caption is a 40-word block, hard for a 14-year-old to read while the camera moves |
| 3 | Case 1 Brief: read card, claims | Yes: fictional card clearly labelled, claims numbered | Yes: step nav 1–6 | n/a | `42-tutorial-brief.png` |
| 4 | Inspect → "End of the wooden base (painted number)" | Yes: "Hint (tutorial): try the magnifier here." | Yes: camera moves, POI highlighted | — | |
| 5 | Turns on Magnifier (M) | Yes | **No**: the key vanishes or the view goes black once the 4096 px model loads | **No**: no message explains it | `37-tutorial-key-after-magnifier.png`. **Breakdown**: she thinks she broke it |
| 6 | Presses "Record what I see" | Yes | Yes: "✓" on POI, log count rises | Yes: description plus transcription "181411" shown | The finding is recorded although she never saw the number (heuristics H2) |
| 7 | Classify 2 statements | Yes: definition shown above the radios | Yes | Yes: "Not quite. It is an inference. …" with why-text | Strong step |
| 8 | Measure (T) | Yes | **No**: after step 5 the value reads 16907.8 cm | **Misleading**: she may believe it | `37-*` |
| 9 | Archive: open record | Yes | Partly: opened docs are not marked opened in the summary list | Yes: sourcing modelled openly in the tutorial | |
| 10 | Evidence board: pin, verdict, confidence | Partly: "supports / contradicts / unclear" per item × claim makes a long form; T3 needs "unclear", which she may not expect | Yes: "n of 3 claims have a verdict" | Deferred to the debrief (by design) | `46-textmode-evidence-board.png` |
| 11 | Label | Yes: starters plus rubric | Yes | Self-check only; exemplar behind a disclosure | `47-*` |
| 12 | Case 2, choose relay, POI "Edge of the relay's marble base" | Yes | Yes | — | `20-*`: the number is already readable without the magnifier |
| 13 | No hint in Case 2: which tool? | **Partly**: the POI label says "(painted number)", and she knows the magnifier from Case 1. For "Underside of the trough (turn it over)" she may not think of raking light | Yes | Wrong tool → "Nothing new shows up here with that. Try another tool…" | Reasonable fading, but abrupt (heuristics H7) |
| 14 | M4: 335.588 vs record "catalog 335588; serial 589" | Yes: the record excerpt lists both on one line | — | Debrief explains the red herring | Good design |
| 15 | M5: Henry built the battery? | **At risk**: she will see "Henry trough battery", "from Mary A. Henry" and the memo, and choose "confirmed" | — | Debrief: "A shared name is a clue, not proof" | Sourcing question sq-memo gives feedback before the verdict, which helps |
| 16 | Submit → debrief | Yes | Yes: verdicts, linked evidence, calibration, "Very sure but wrong on …" | **Partly**: "Brier score" is jargon for grade 9 | `case-board.js:119` |

## Where the answer is "no"
1. **Step 2:** S1 overlaps a live task panel. Fix: make the panel inert during cinematics, or play S1 before the Brief renders.
2. **Steps 5 and 8:** the magnifier hi-res swap removes the object and corrupts measurement (units bug in `*-4k-*.glb`, `src/scenes/inspection.js:237`). This is the single largest obstacle on the path. **Critical.**
3. **Step 6:** recording works without seeing. Fix: reveal the close-up render as part of recording, or require the lens over the mark.
4. **Step 9 (minor):** no "opened" marker in the Archive list. Fix: add ✓ to opened `<summary>` titles.
5. **Step 13 (minor):** no Case 2 hint path. Fix: an opt-in hint per POI.
6. **Step 16 (minor):** Brier jargon. Fix: plain-language line.
7. **Step 1 (minor):** no pre-check counter. Fix: "Question 1 of 4".

## Verdict
The learning path is well scaffolded for Amara (tutorial hints, why-feedback, modelled sourcing, honest "can't tell yet"). One technical defect (steps 5 and 8) breaks the 3D path at its first real tool use. Text mode does not have this break.
