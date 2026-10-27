# Agent review: game accessibility

Agent review (reviewer sub-agent). This is not an expert or assistive-technology audit. No screen reader was used, and full WCAG validation needs manual testing with assistive technologies. Method: code reading (`src/a11y/*`, `src/ui/*`, `src/core/keymap.js`) and a headless Playwright run on port 4192 (Tab order, key presses, live-region contents, reduced-motion context, text mode). Categories follow the Game Accessibility Guidelines (GAG) and Xbox Accessibility Guidelines (XAG): perception, motor, cognitive, plus WCAG 2.1 AA for the HTML layer.

## Checklist results

| Check | Result | Evidence |
|---|---|---|
| Text-mode parity (3 objectives spot-checked) | **Pass** with caveats, see below | `43-*`, `44-*`, `46-*`, `47-*` screenshots |
| Keyboard operation of every tool | **Concern**: all tools have keys or buttons; the magnifier lens has no movement keys (A6) | probe: R, [, ←, G, T all act; typing "Ramt" in the label textarea triggers nothing |
| Points-of-interest list | **Pass**: every hotspot is a button in `.poi-list` (`case-view.js:92-94`) | — |
| Pointer alternatives | **Pass**: arrow/zoom/preset buttons, raking sliders, lens buttons; board uses `<select>`s | `tool-pad.js`, `case-board.js` |
| Live announcements | **Concern** (A4, A5) | live-region dump in probe |
| Reduced motion | **Pass**: OS setting plus toggle; cinematics become stills | `shot-player.js:87-90` |
| No colour-only cues | **Pass**: ◆/✎ badges with text; ✓ prefix on found POIs; "Yes." / "Not quite." words | `case-view.js:94,170` |
| Pause | **Pass by design**: nothing is timed. No explicit pause, which is acceptable | probe: 0 pause buttons |
| Captions | **Concern** (A3) | `shot-player.js:84` |

### Text-mode parity spot-checks
1. **Objective 1 (observe/classify):** Text mode → Case 1 → Inspect → "End of the wooden base" → "Look at it" gives "Nothing new shows up with that. Hint: this spot needs the magnifier." Then "Look closely (magnifier)" records the finding with transcription and two classify rows (`44-*`, `45-*`). Equivalent to 3D. **Pass.**
2. **Objective 3 (corroborate):** Text mode → Evidence board lists the same claims with a `<select>` per evidence item (Not linked / Supports / Contradicts / Unclear), verdict radios and confidence radios. Same component as 3D (`CaseBoard`). **Pass.**
3. **Objective 4 (label):** Text mode → Label shows the same starters, textarea, 4-criterion rubric radios and checklist (`47-*`). **Pass.**
Parity is in fact **better** in text mode than in 3D today. The 3D magnifier route is broken (A1), while text mode reaches every finding.

## Findings

| # | Severity | Category | Finding | Fix |
|---|---|---|---|---|
| A1 | **critical** | Perception / motor | In 3D, magnifier findings can only be recorded with the magnifier on, and turning it on makes the object vanish (hi-res units bug; visual review V1). Keyboard and pointer users alike lose sight of the evidence the finding asks them to classify. A low-vision learner relying on magnification is blocked. | Fix the hi-res model scale (`src/scenes/inspection.js:237`, `scripts/prepare-models.mjs`) |
| A2 | major | Cognitive / perception | S1 plays over a live, focusable case panel (`40-s1-first-frame.png`). The caption sits in an `aria-live="polite"` node, and so does the panel status. For a screen-reader user both are announced at once, and Tab moves into the Brief while the cinematic runs. | Make the panel `inert` while a cinematic plays; move focus to the Skip button at start |
| A3 | major | Perception (captions) | Captions are one 40-word block per shot (`shot-player.js:84`), not timed. The "Captions on" setting (`settings.js:86`) is never applied, so the option does nothing. That is a false affordance. | Time captions; wire or remove the toggle |
| A4 | major | Perception (screen reader) | Camera actions are not announced. After ← (turn left) and after pressing R, no new live-region text appeared within 400 ms; only the raking-light slider keys (`[`) announce state. `design/accessibility-plan.md:13` claims "camera moves" are announced, but only POI jumps are (`app.js` `gotoHotspot`). | Announce "Turned to 315°, front-left view" (throttled) and "Raking light on/off" |
| A5 | minor | Perception | The announcer holds a polite and an assertive node inside a container with `aria-live="off"` (`src/a11y/announcer.js:15`). Nested regions with a parent marked off behave inconsistently across screen readers. | Remove `aria-live` from the container and keep the two child regions |
| A6 | minor | Motor | The magnifier comment says "I-J-K-L keys" (`src/systems/magnifier.js:6`), but no such actions exist in `ACTIONS` (`src/core/keymap.js:7-24`). The lens moves only by pointer or the four tool-pad buttons (Tab plus Enter each step). Pressing K did nothing in the probe. | Add `lensLeft/Right/Up/Down` to the remappable keymap, or fix the comment |
| A7 | minor | Perception | The canvas has `role="img"` with a static label. It does not change with the object shown, so a screen-reader user who lands on it hears the same text in every case. | Update `aria-label` on `_stage(objectId)` with the object title and current view |
| A8 | minor | Cognitive | Settings contains volume sliders and Mute for a game with no audio (`settings.js:87-90`). This is noise for learners with cognitive load concerns. | Remove or hide them |
| A9 | minor | Motor | Keyboard shortcuts are single letters (F, R, M, N, T, G) with no modifier (WCAG 2.1.4). They are suppressed in form fields (verified) and remappable (verified), so 2.1.4 is met through the remap option. There is no way to **turn them off**. | Add "Single-key shortcuts on/off" to Settings |
| A10 | minor | Perception | High contrast plus extra-large text works on the HTML layer (`48-*`), but the tool pad's small hint text (`.tool-hint`, about 13 px in the screenshots) stays smaller than body text at every setting. | Scale `.tool-hint` with the root font size (use rem) and keep it at 0.875rem or more |
| A11 | minor | Cognitive | Tab order on Welcome is fine (skip link → header → chapter tabs → pre-check). In Case 2 the object chooser, POI list, and tool pad are far apart in DOM order: the tool pad comes after the canvas, before the panel. Learners have to Tab through about 25 tool buttons to reach the POIs. | Put a "Skip to points of interest" link at the top of the panel, or put the tool pad after the panel in DOM order |

## Verdict
The HTML layer is well built: semantic, remappable, with colour-independent cues, honest documentation, and text mode that really works end to end. The 3D magnifier path is blocked (A1), and the caption and announcement claims are partly unmet (A3, A4). After A1–A4 are fixed, this would be a strong accessible design. A real screen-reader pass is still needed.
