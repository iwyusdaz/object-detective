# Agent review: realism matrix and cinematic budget

Agent review (reviewer sub-agent). Sources: `design/realism-matrix.md`, `design/shot-list.md`, `content/cinematics.json`, `src/cinematics/shot-player.js`, `src/app.js`, `src/core/quality.js`, `src/core/post.js`, and a headless run on port 4192 (screenshots in `evaluation/reviews/screenshots/`).

## Cinematic budget check

| Rule | Result | Evidence |
|---|---|---|
| Total ≤ 90 s | **Pass**: 18 + 14 = 32 s | `content/cinematics.json:10,27` |
| Each shot ≤ 25 s | **Pass** | same |
| Purpose tags | **Pass**: `orient`, `reveal`, shown on screen ("Shot 1 of 1 — purpose: orient") | `40-s1-first-frame.png` |
| Skippable from the first frame | **Pass**: Skip button visible in frame 1, Esc handler is global; focus returns to `#panel` after skip | `shot-player.js:56-60`, probe output |
| Captions | **Concern**: present, but see C2 and C3 | `shot-player.js:84` |
| Reduced-motion version | **Pass**: still frame at the path end, auto-continues after `duration × 0.7` s | `shot-player.js:87-90` |
| Never during assessment | **Pass** for S2 (only offered in the debrief, after submission, `case-board.js:145`). **Concern** for S1, see C1 | `app.js:162-165` |

## Realism matrix audit

| Element | Claimed cue | Verdict |
|---|---|---|
| Scans, true scale, 2048 px | Marks, wear, construction | **Serves learning**. 335.588, 181411 and 309254 read at hotspot zoom (`20-*.png`). Undermined by the hi-res swap, see R1 |
| 4096 px magnifier texture | Reading small marks | **Currently harmful**: the hi-res model is in the wrong units and removes the object (R1) |
| Raking light | Relief, faint marks | **Serves learning**: the battery underside characters appear only under the 12° light (`12-*-battery-underside-raking.png`) |
| Grey sweep backdrop | Isolation (signalling) | Serves as designed |
| True-size references | Felt scale | Serves; breaks after a magnifier swap (R1) |
| Gallery (ambientCG, HDRI) | Context only, dimmed in inspect | Decorative but contained. Dimming works (`setMode('inspect')`). See R3 |
| No bloom / DOF / particles | — | The `post` arrays in `src/core/quality.js:26,36,46` list `'bloom-light'`, which contradicts the matrix row "Dust motes, lens flare, bloom, DOF: None". `post.js` never builds bloom, so the runtime is honest but the config misleads. See R2 |

## Findings

| # | Severity | Finding | Fix |
|---|---|---|---|
| R1 | **critical** | The highest-realism element in the matrix, the 4096 px magnifier scan, breaks the learning cue it exists for. The hi-res GLBs are authored in inches or mm, not metres (relay extent 8.32, key 169, against 0.21 / 0.17 for the base GLBs), so the object vanishes or turns the view black once the magnifier is on, and measurements read 16907.8 cm (`11-*`, `34-*`, `37-*`). | Rescale the hi-res models to metres in `scripts/prepare-models.mjs`, or normalise the scale in `Inspection.loadHiRes` (`src/scenes/inspection.js:237`); add a bounds test for the hi-res files |
| R2 | minor | `PRESETS.*.post` includes `'bloom-light'` (`src/core/quality.js:26,36,46`) and also `vegetationDensity` and `drawDistance`, which mean nothing in this project. A reader of the config sees bloom, contradicting `design/realism-matrix.md:13`. | Remove `'bloom-light'` and the unused template keys, or comment that they are ignored |
| C1 | major | S1 auto-plays in chapter 1 **over the live Brief panel**. The case file, with "Next: Inspect" and the step nav, stays interactive beside the cinematic (`40-s1-first-frame.png`). Pressing Next during S1 starts the inspect step while the camera is still locked (`inspection.cameraLocked`), so tools appear not to respond until the shot ends. The shot list says "no cinematic during … a focused task". | Make the panel `inert` while `player.playing`, or play S1 from the Welcome "Start the shift" button before chapter 1 renders |
| C2 | major | Each shot has two captions, but they are joined and shown together for the whole shot (`shot-player.js:84: captions.join(' ')`). There is no timing. The caption is a 2-line, about 40-word block over an 18 s move, which works against temporal contiguity with what is on screen. | Add per-caption start times to `cinematics.json` and swap captions on schedule |
| C3 | major | The Settings "Captions on" toggle (`src/ui/settings.js:86`) is stored but never read by the shot player. Captions cannot be turned off, and the setting claims a control that does nothing. | Read `settings.state.captions` in `ShotPlayer` (hide `.cinematic-caption` when off), or remove the toggle |
| C4 | minor | Settings exposes "Mute all audio", "Master / Voice / Ambient volume" (`settings.js:87-90`), but the game has no audio (`design/accessibility-plan.md:17`). These are dead controls. | Remove them, or label "(no audio in this game)" |
| C5 | minor | The reduced-motion still lasts `duration × 0.7` (12.6 s for S1) and then **auto-advances**. Two captions on a still for 12.6 s is fine, but auto-advance is not learner-controlled. | In reduced-motion mode, show a "Continue" button instead of a timer |
| C6 | minor | S1 frame 1 is mostly floor and plinth. The inspection table and draft card, which the "orient" purpose points at, are small (`40-s1-first-frame.png`). | Adjust `path[0]` and `targetFrom` so the table is in the first third of the frame |
| R3 | minor | The gallery's empty display cases are decoration only. They are cheap and dimmed during tasks, so no harm. However, the Welcome hero view is lost after opening Settings (see visual review V3), which removes the "context and motivation" the matrix gives as their purpose. | Fix V3 |
| C7 | minor | S2 is a real consequence shot (the learner's own label in the case) and is optional. It is one of the better-justified cinematics. No change, but there is no automated test that S2 shows the learner's text when the label is empty. | Add a fallback text ("No label written") and test it |

## Verdict
The budget and purpose rules are met on paper (32 s, tagged, skippable, reduced-motion stills, S2 after assessment). Caption timing, the dead captions toggle, and S1 overlapping a live task panel need fixes. The realism matrix's reasoning is sound, but its headline element, the magnifier's hi-res scan, is broken by a units bug, and that must be fixed before release.
