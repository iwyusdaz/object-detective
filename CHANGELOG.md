# Changelog

## 3.0.1 (2026-11-10) — patch: usable without a GPU
- On computers without a GPU (software WebGL, as on CI runners), the page no longer freezes behind slow frames: the scene updates without drawing while the title screen or text mode fills the screen, and a frame slower than 500 ms is followed by an equal pause, so clicks such as "Use text mode" respond (0.58 s instead of 20–26 s, measured on object-detective with the CPU throttled 4× and 8×). No change on a GPU.
- Without a GPU, the gallery reflection and bounce-light bakes are skipped (they blocked the page for about 7 s), and choosing text mode no longer streams the 3D detail.
- Posters unchanged (same images, renamed `poster-3.0.1.*`).
## 3.0.0 (2026-11-09) — scene-first revamp (plan 10 §6.2)
- Scene-first v3 shell: one top bar with the module steps, a short Now card with one action, drawers and a discovery journal. Dressed Lantern Museum gallery and inspection table.
- Articulated clamp lamp aims at the inspected object; circular magnifier (render target + circular composite); True size view with scale references; light-probe bounce light in the gallery.
- Object roles: 12 task, 2 learn, 17 decorative.
- Owner visual approval (G2), 2026-11-09, with the known open issues in STATUS.md accepted. Not user testing.
- Navigation: Back and Back to start; no "All projects" link on project pages. Only course objects open cards; decorative objects open nothing.
- Posters re-taken from the v3 scene (`poster-3.0.0.webp/.jpg`, headed-GPU screenshots); the v2 posters are removed.
## 2.0.1 (2026-10-29) — patch

- Shared v2 core fixes: hover tooltips are suppressed while a tool or dialog owns the pointer; the collapsed HUD drawer is `inert` and `aria-hidden`, so Tab can't reach hidden controls; the reduced-motion character gaze snaps instead of drifting; the hotspot ring and disc are one mesh.
- The full-bleed collapsed-drawer rule (OD-V12) moved from `src/v2/hud-shell.css` to the repo-owned `src/styles/case-hud.css`, so future core syncs can't overwrite it.
- Posters renamed to `poster-2.0.1.*` (same image). No content or learning-flow changes. 63 unit and 26 browser tests pass.

## 2.0.0 (2026-10-29)

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
