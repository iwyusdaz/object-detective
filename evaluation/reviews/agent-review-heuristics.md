# Agent review: heuristic evaluation

Agent review (reviewer sub-agent). Method: Nielsen's 10 heuristics plus game playability heuristics, applied to the 3D UI and to text mode. Evidence comes from a headless run on port 4192 (screenshots in `evaluation/reviews/screenshots/`) and from code reading.

## Ratings

| Heuristic | 3D UI | Text mode | Notes |
|---|---|---|---|
| 1 Visibility of system status | concern | pass | Step nav, "Observation log: n of 10", "n of 6 claims have a verdict" are good. In 3D, the hi-res load replaces the object silently (H1). Camera moves give no status (H6) |
| 2 Match with the real world | pass | pass | Records drawer, evidence board, label stand, "can't tell yet" all fit museum practice |
| 3 User control and freedom | concern | pass | Steps are freely navigable and the case can be restarted. S1 locks the camera while the panel stays live (H3) |
| 4 Consistency and standards | concern | pass | The "Captions on" and volume controls do nothing (H4). The magnifier comment promises I-J-K-L keys that do not exist (`magnifier.js:6`) |
| 5 Error prevention | concern | pass | Verdict and label submits are guarded (`case-board.js:61,101`). The 3D record button can accept a finding the learner could not see (H2) |
| 6 Recognition over recall | pass | pass | Tool keys shown in labels ("Turn over (F)"); claims restated on the board |
| 7 Flexibility and efficiency | pass | pass | Keys plus buttons, remappable, POI jump list |
| 8 Aesthetic and minimalist design | concern | pass | The tool pad covers about a quarter of the viewport (visual V5); Settings has dead audio controls |
| 9 Help users recover from errors | pass | pass | Why-feedback on every classification and sourcing answer; wrong-tool feedback in text mode (`44-*`) |
| 10 Help and documentation | pass | pass | Menu → Controls and keys; teacher guide |
| P1 Clear goals | pass | pass | "6 claims to check" status line; the Brief lists the claims |
| P2 Feedback | concern | pass | Classification feedback is excellent. Verdict feedback waits until the debrief, which is intentional for calibration |
| P3 Challenge/skill balance | concern | concern | H5, H7 |
| P4 No unnecessary friction | concern | pass | H1, H8 |

## Findings

| # | Severity | Heuristic | Finding | Fix |
|---|---|---|---|---|
| H1 | **critical** | 1, P4 | Turning on the magnifier swaps in a hi-res model in the wrong units. The object vanishes or the view goes black, and the measurement reads 16907.8 cm (`34-*`, `37-*`). No message explains it, and it persists. | Fix the units (see visual V1) |
| H2 | major | 5 | The 3D "Record what I see" button (`case-view.js:147-150`) records a magnifier or raking finding as soon as that tool is **toggled on**. It does not check that the lens is over the mark. Combined with H1, a learner records "335.588" and its transcription without ever having seen it. | Require `magnifier.probe()` to hit within the hotspot radius, or show the finding close-up render (already generated for text mode) as the reveal |
| H3 | major | 3 | S1 auto-plays when Case 1 starts, while the Brief panel stays interactive and the camera is locked (`app.js:162-165`, `40-*`) | Make the panel `inert` during cinematics |
| H4 | major | 4 | Dead controls: Captions on, Mute, Master/Voice/Ambient volume (`settings.js:86-90`) | Wire captions; remove audio controls |
| H5 | major | P3 | Case 2's relay number is fully legible **without** the magnifier at the hotspot's own zoom (`20-relay-number-hotspot-before-magnifier.png`), yet the finding demands the magnifier. Tool choice then feels arbitrary, not diagnostic. | Lower the hotspot `zoom` for `hs-relay-number` (4.0 → about 1.5) so the magnifier is needed, or accept "view" as well |
| H6 | minor | 1 | Turning or tilting is not announced or shown numerically (no "View: front-left, 30° above"). Learners lose track after turning over (F) | Show a small view readout beside the View controls |
| H7 | minor | P3 | Case 2 drops all tool hints at once (tutorial: hints per POI; Case 2: none). Ten findings across four objects with no fading step is a big jump for grade 8 learners. | Offer an opt-in "Hint" button per POI in Case 2 (logged, not scored) |
| H8 | minor | P4 | Each Case 2 POI needs: choose object → choose POI → open tool section → toggle tool → Record → toggle off → classify twice. That is about 8 actions × 10 findings. | Auto-open the relevant tool-pad section when a POI is chosen (tutorial already names the tool) |
| H9 | minor | 8 | Status line "Case 2: the case label: 6 claims to check." stays the same as claims get verdicts | Update to "4 of 6 claims decided" |
| H10 | minor | 2 | The debrief prints "Brier score 0.12; 0 is perfect" (`case-board.js:119`). The term means nothing to the target audience. | Add plain wording: "How well your confidence matched your accuracy (lower is better)" |

## Verdict
Text mode passes nearly every heuristic. The 3D UI is well thought out, but it is currently undermined by one critical defect (H1) and by weak checks on whether learners actually used the tools (H2, H5).
