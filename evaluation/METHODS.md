# Evaluation methods

**Status:** Automated functional, accessibility and unit testing has been done by the builder. Agent-based design reviews are added by the orchestrator (`reviews/`). **No real learners have played this.** No physical phone testing has been done. Headed GPU performance testing and Lighthouse were not run by the builder; per the brief, the orchestrator runs them later.

## What was run (2026-10-27, macOS arm64, Node 24, Chromium via Playwright 1.64.1, headless)

| Method | Tool / file | What it shows | What it cannot show |
|---|---|---|---|
| Unit tests (42) | vitest, `tests/unit/` | Case-engine logic (discovery rules, classification, pinning, verdicts, scoring, calibration, save/resume); **solvability** of both cases from content; expert playthrough scores full marks; tool math (cm/in, raking geometry, reference sizes); **fact audit**: every real-object fact string and quoted excerpt appears verbatim in the saved Smithsonian API record, and record + 3D media are CC0; **true-scale check** of scans vs records | Whether learners understand the feedback. The fact audit skips in CI when `data/raw/` (gitignored) is absent |
| Content audit | `scripts/check-content.mjs` | Alignment coverage, text-mode parity (photos/descriptions per finding and object), fiction labelling, cinematic budget (32 s of 90 s) | Quality of the writing |
| Functional / scripted playthroughs (14) | Playwright, `tests/functional.spec.js` | Mobile emulation (390×844, touch, Low preset auto-selected, stacked layout, a finding recorded by tapping). Both cases solvable **through the UI**: tutorial in 3D (tools via keys), Case 2 in 3D with full expert score, **Case 2 in text mode** (parity) with an injected overconfident error flagged in the debrief; transfer + wrap-up; save/resume across reload; "Clear my data" clears only this project's keys; S1 captioned and skippable with Esc; reduced motion gives a still camera; raking light, magnifier, measure (the Davenport motor measures within 5 % of the record's 38.1 cm), true size, compare with synchronized rotation; WebGL-unavailable fallback | Real usability, learning, motivation |
| Accessibility (4) | axe-core 4.14 via Playwright, `tests/a11y.spec.js` | Zero critical/serious WCAG 2.0/2.1 A/AA violations in every major state (welcome, all case steps, tool pad expanded, dialogs, text mode, transfer, wrap-up, high-contrast + extra-large text); keyboard-only start | Screen-reader experience (VoiceOver/NVDA not tested), cognitive accessibility, real assistive-tech users. axe catches only part of WCAG |
| Sub-path test (1) | Playwright + local static server on port 4380, `tests/sub-path.spec.js` | The release build works from `/play/object-detective/`: no failed requests, no console errors, a scan loads (self-hosted Draco), the 4096 px hi-res scan loads on demand, text mode and photos load, "All projects" → `/` | Behaviour on Vercel's CDN headers/CSP |
| Builder render review | `scripts/render-views.mjs` | Builder looked at every scan from 8 views before writing any description; visible numbers were transcribed and checked against the records | Independent verification (a reviewer should spot-check the transcriptions in `public/assets/photos/finding-*`) |

Raw outputs: `evaluation/results/`.

## Performance
Not measured. Headless Chromium uses software rendering (SwiftShader), so frame rates there mean nothing. Budget-relevant facts that *were* measured: the first-interaction download is the JS bundle (~1.1 MB, 377 KB gzip) + HDRI (1.6 MB) + textures (~0.5 MB) + the first scan (1.3–2.1 MB), well under the 15 MB desktop / 8 MB mobile budget. The optional 4096 px scans (7–10 MB each) load only when the magnifier is used. Triangles per scan: about 100–150 k (Smithsonian "150k"/"100k" packages), far under the 1.5 M budget. `dist/` is about 57 MB (largest file 9.6 MB).

## Honest limitations
- No learner data of any kind. Targets in `design/learning-objectives.md` are design targets, not results.
- Mobile: checked with one Playwright device emulation (390×844, touch). No physical phones, no iOS Safari.
- The tangent galvanometer scan does not match its record's size, so it is excluded from measurement (DECISIONS.md D-11).
- The illegible marks on the trough battery are described as illegible. A higher-resolution scan or the physical object might show more.
- Agent reviews (heuristic, cognitive walkthrough, multimedia principles, museum-educator and history-teacher perspectives) are pending in `reviews/`.
