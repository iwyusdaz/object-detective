# Changelog

## 2.0.0 (unreleased; not yet tagged)

Visual and interaction revamp ("The Lantern Museum after hours", plan 09 §4.2). Learning content, tools, cases, text mode and the v1 test contract are unchanged.

- Living gallery: real architecture (parquet, oxblood wainscoting with dado and brass rails, plaster walls), three glass display cases with true-refraction glass, picture lights, tall windows with moonlight and animated rain streaks, a doorway to a green archive storeroom, and a cork evidence board.
- Poly Haven CC0 furnishing: lit `Chandelier_01`, `vintage_grandfather_clock_01` with an animated pendulum, `drawer_cabinet` and `wooden_bookshelf_worn` in the archive corner, lit `desk_lamp_arm_01` on the inspection desk, `ceramic_vase_01` and `Lantern_01` as shelf dressing.
- Ambient life (calm mode during focused tasks; `prefers-reduced-motion` freezes it): dust motes in the spotlight cones, the clock pendulum, a night-guard torch beam sweeping past the archive doorway every ~25 s, rain scroll, chandelier candle flicker.
- In-world interaction: glowing floor rings at the inspection table, each display case, the archive cabinet and the evidence board; clicking glides the camera with cinematic framing; hover highlight with Special Elite tooltips; WASD/arrow walk and mouse-drag look while exploring. The raking light can be aimed like a handheld torch with the mouse (panel button and sliders kept for keyboard/text parity).
- Full-bleed case theming: `applyCaseGrade('object-detective')` (AgX tone mapping, night-blue fog and gradient sky dome) and the floating HUD drawer with a Plain-font accessibility toggle.
- Case typography: self-hosted Cormorant Garamond (display), Source Serif 4 (body), Special Elite (in-world accent) with `design/art-bible.md`.
- Release: version 2.0.0, posters re-rendered from the v2 scene (`poster-2.0.0.webp/.jpg`) with blank-frame detection and retry.

## 1.0.0 (unreleased; not yet tagged)

First complete vertical slice.

- Two cases: a tutorial built on the Morse-Vail telegraph key, and Case 2, "Sparks" (Davenport motor, Henry trough battery, Chester relay, Page induction coil). All objects are real CC0 Smithsonian 3D scans linked to their records.
- Inspection tools:
  - orbit and zoom, with buttons and keys
  - preset views and turn over
  - raking light (sliders and keys)
  - magnifier, with an on-demand 4096 px texture
  - measuring in cm and inches (longest side preset, or two points)
  - true-size view
  - side-by-side compare with synchronized rotation
- Historical-thinking loop:
  - classify each observation as observation or inference
  - sourcing records drawer
  - evidence board (supports, contradicts or unclear)
  - verdicts, including "can't tell yet", with confidence
  - label writer with sentence starters, rubric self-check and exemplar
  - curator's debrief with calibration
- Pre-check, transfer task (tangent galvanometer) and wrap-up.
- Full text mode with parity, using renders of the scans as photos.
- Cinematics S1 and S2 (32 s total), captioned, skippable, with reduced-motion stills.
- Local xAPI-shaped learning record with download and "Clear my data". Save and resume.
- Release contract: `showcase.json`, `attribution.json`, posters, favicon, CI and release workflows, and the sub-path test.
