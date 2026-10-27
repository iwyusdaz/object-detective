# Text-mode design

Text mode is the same game with the 3D viewport replaced by images and text. It is not a summary.

| 3D mode | Text mode |
|---|---|
| Turn, tilt, zoom, presets, turn over | 8 renders per object (front, back, both ends, top, underside, 2 raking-light views) with alt text, plus an audio-description-style paragraph |
| Hotspot camera move + tool use | Points-of-interest list → "Look at it" / "Look closely (magnifier)" / "Low raking light" / "Measure it". The learner must pick the right action, the same rule as in 3D |
| What the tool reveals | Close-up render of the finding, a description, and a transcription of visible numbers |
| Measure tool | Measured value stated in cm and inches, plus the record measurements |
| True-size view | Record dimensions with comparisons (quarters, bank cards) |
| Classify / archive / evidence board / verdicts / label / debrief | **Identical** components (`CaseView` with `isText`) |
| Cinematics | Not played. Their captions and descriptions are in `content/cinematics.json` |

Parity is tested: the functional suite solves Case 2 fully in text mode, and the transfer task is text-only by design.

Limitation (also in the accessibility plan): transcribing a discovered mark lowers the visual discovery challenge. The reasoning challenge is unchanged.
