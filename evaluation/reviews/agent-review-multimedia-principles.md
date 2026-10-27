# Agent review: Mayer's multimedia principles

Agent review (reviewer sub-agent). Evidence comes from `content/*`, `design/*`, `src/*` and a headless run on port 4192 (screenshots in `evaluation/reviews/screenshots/`). The game has no audio narration, so modality and redundancy are judged for on-screen text and cinematics.

| Principle | Rating | Evidence | Violations |
|---|---|---|---|
| Coherence | pass (minor issues) | No bloom, DOF, particles or characters. The gallery dims in inspect mode (`gallery.js:275-281`). The grey sweep isolates the object (`10-*`) | MM1, MM2 |
| Signalling | pass with concern | POI list, yellow outline on the active POI card, ◆ real / ✎ fictional badges, "(painted number)" / "(measure)" cues in POI labels | MM3 |
| Redundancy | pass | No narration, so the narration plus captions plus text issue does not arise. The hidden audio-description paragraph is screen-reader-only (`shot-player.js:52`) | — |
| Spatial contiguity | concern | The finding description and classify rows sit in the right panel. The object is in the left viewport, with the tool pad between them | MM4 |
| Temporal contiguity | concern | Captions are not synced to the camera path | MM5 |
| Segmenting | pass | Six learner-paced steps per case. One POI at a time. The case can be split across sessions (save/resume) | MM6 |
| Pre-training | pass | Pre-check introduces observation/inference, sourcing, corroboration and hedging. The tutorial case trains each tool with hints | MM7 |
| Modality | n/a / pass | No audio. Text-only explanations are right for a no-audio classroom game | — |
| Learner control | pass with concern | Everything is learner-paced; cinematics are skippable from frame 1 | MM8 |

## Violations

| # | Severity | Principle | Finding | Fix |
|---|---|---|---|---|
| MM1 | minor | Coherence | Settings shows audio volume sliders for a game with no audio, and the welcome hero gallery has empty cases (`31-*`). Both are small extraneous load | Remove the audio controls; keep the cases dim |
| MM2 | minor | Coherence | The Ultra preset's long cast shadow of the Davenport wheels on the backdrop competes with the object silhouette (`51-ultra-davenport-inspect.png`) | Soften or raise the key light in inspect mode |
| MM3 | major | Signalling | No in-scene marker shows *where* the evidence is after a POI jump. The camera moves, but the mark itself (e.g. 335.588 on the base edge) is not highlighted, and the magnifier lens starts at the viewport centre, not on the mark. This matters most in Case 2, where there are no hints. | Place the lens centre on the hotspot's projected `point` when a magnify POI is selected, and draw a brief outline ring at the mark. Remove the ring under reduced motion, or keep it static |
| MM4 | major | Spatial contiguity | "Record what I see" and the classification statements are about 700 px from the object. The description ("Small dark numerals with a dot read 335.588") is far from the numerals, and the tool pad sits in between (`21-*`). | After recording, show the finding's close-up render (already produced for text mode, `photos._findings`) inside the POI card, next to the statements |
| MM5 | major | Temporal contiguity | S1 and S2 each have two captions written for different moments ("galleries are dark" / "on the inspection table…"). Both are shown together for the whole shot (`shot-player.js:84`), so the table caption appears 15 s before the table does. | Add per-caption `at` times in `content/cinematics.json` |
| MM6 | minor | Segmenting | The Case 2 evidence board is one long form: 6 claims × (up to 16 evidence `<select>`s + verdict + confidence) (`46-*`). It is learner-paced but visually unsegmented. | Collapse each claim into a `<details>`, or show one claim at a time with "next claim" |
| MM7 | minor | Pre-training | Pre-training covers the concepts but not the vocabulary of museum records ("catalog number", "credit line", "accession number"), which Case 2 relies on (M4, M5). | Add a 3-line glossary to the Archive step or the Case 1 record card |
| MM8 | minor | Learner control | Under reduced motion the cinematic still auto-advances after `duration × 0.7` s (`shot-player.js:90`) | Use a Continue button for the reduced-motion still |
| MM9 | **critical** (cross-ref) | Signalling / coherence | The magnifier, the core signalling tool for small marks, removes the object when its hi-res texture loads (visual V1). Its signalling value is currently zero in 3D | Fix the hi-res model units |

## Verdict
The design applies coherence, segmenting, pre-training and learner control deliberately and well. The weak spots are spatial and temporal contiguity: the text is far from the evidence, and captions are not timed. In-scene signalling of the exact mark is also weak. Apart from MM9, all of these are moderate content and UI changes.
