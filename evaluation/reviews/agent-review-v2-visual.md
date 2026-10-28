# Agent review — v2.0.0 visual revamp (plan 09 §4.2)

Reviewer: agent review (reviewer sub-agent, not an expert or learner).
Scope: gallery realism, Poly Haven placements, hero salience, typography, poster.
Build reviewed: commit `16bff87` (main), served headless at 127.0.0.1:4193 (SwiftShader → engine drops to Low + 0.5× resolution by its own software-GL detection — fidelity judged cautiously; headed GPU check remains the owner's). The **uncommitted working-tree patch** on top of this commit breaks the app entirely — see `agent-review-v2-interaction.md` V2-CRIT-1; all findings below are against the consistent HEAD build.
Screenshots: `evaluation/reviews/screenshots/v2-welcome.png`, `v2-archive-corner.png`, `v2-case-inspection.png`, `v2-torch-raking.png`, `v2-glide-arrival.png`, `v2-drawer-collapsed.png`, `v2-wrapup.png`.

## Verdict

The gallery is a real, grounded night museum, not a backdrop: parquet (ambientCG WoodFloor043, repeat 6×6), plaster walls, oxblood wainscoting band with dado rail, brass picture rail and skirting on every wall, three glass cases (transparent `MeshPhysicalMaterial`, renderOrder-managed) on dark plinths with felt decks and their own track spotlights, tall north windows with night-blue backdrop, moonlight spill and animated rain streaks, and a green archive storeroom beyond the east doorway. Fog `#161D29 @ 0.022` and the gradient night dome match the art bible exactly.

## Findings

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| V2-VIS-1 | **Major** | The three display cases are **empty in explore mode** — no artefact and no label card on any case deck, so the "six Smithsonian scans stay the heroes on plinths with label cards" promise (art bible §5, OD-V2) is only met during case inspection. `Gallery._buildCases()` (src/scenes/gallery.js:484-504) builds plinth+deck+glass only; `showInCase()` is used solely for the S2 reveal. | `v2-glide-arrival.png`, `v2-welcome.png`: glass cubes over empty plinths; code trace |
| V2-VIS-2 | **Major** | The cork evidence board is **blank and its pinned cards float in mid-air** ~1.5–1.9 m south of the board: `_buildEvidenceBoard()` uses card z-offsets 1.5–1.9 as *local* coordinates while the group is already placed at z = 1.7 (src/scenes/gallery.js:368-394). Measured world positions: cork z = 1.70; cards z = 3.20/3.20/3.60/3.55. The red string connects the floating cards. | Harness geometry probe; `v2-evidence-board.png` (blank cork fills the frame) |
| V2-VIS-3 | Minor | Art bible promises "true refraction" in the case glass; the implementation is plain alpha transparency (`opacity: 0.12`, no `transmission`/IOR), so no actual refraction. Honest fix is one word in the bible or `transmission` on High presets. | src/scenes/gallery.js:486 |
| V2-VIS-4 | Minor | The tool-pad raking slider label goes stale while the torch is mouse-aimed: mouse aim calls `rake.set()` without `tools.refresh()`, so the pad kept showing "Direction around 300°" while the state read 113°. | `v2-torch-raking.png` vs harness state read |
| V2-VIS-5 | Minor | The chandelier is barely readable in frame (high against the near-black ceiling at Low preset); its light pool on the parquet and the flicker are visible, so the system works — but the prop itself could sit ~0.2 m lower or carry a slightly higher emissive. | `v2-welcome.png`, poster |

## Checks that pass

- **All 7 Poly Haven CC0 models placed and grounded** (scene probe): `prop-Chandelier_01` (emissive 0.55 + 14-intensity flickering point light), `prop-vintage_grandfather_clock_01` (procedural brass pendulum on `addOscillator`), `prop-drawer_cabinet` with `prop-ceramic_vase_01` + `prop-Lantern_01` on its top, `prop-wooden_bookshelf_worn`, `prop-desk_lamp_arm_01` with its own warm point light at the table. All pass through `groundProp()` (shadow flags, env intensity) — nothing floats; the archive screenshot shows shelf, cabinet, lantern and green wall correctly lit by the two archive spots.
- **Archive corner is real**: corrected camera at [6.9, 1.5, −1.2] shows the worn bookshelf, drawer cabinet, lantern on top, gallery-green wall and picture-light pools (`v2-archive-corner.png`).
- **Heroes stay heroes during inspection**: the staged scan sits on the sweep under the studio key with the room dimmed (`setMode('inspect')` drops environment to 0.55 and room lights to ~0.42); the object is unmistakably the most salient element (`v2-case-inspection.png`, `v2-torch-raking.png`).
- **Cue salience**: the amber hotspot rings + diamond beacons dominate explore mode against the dim gallery (`v2-welcome.png`); under Low/software rendering the scene still reads.
- **Typography applied** (computed styles): headings "Cormorant Garamond, Georgia, serif"; panel body "Source Serif 4"; badge "✎ Fictional document created for this game" and hover tooltip "Special Elite". `document.fonts.check` true for all three once used (Special Elite lazy-loads on first use, `font-display: swap`).
- **Poster `poster-2.0.0.webp` (50 KB) / `.jpg` (100 KB)** is a genuine render of the v2 scene — key under the photographic sweep in raking light, grandfather clock, cases, amber rings, rain-streaked windows. Real render, small, on budget.

## Severity summary

0 critical · 2 major (V2-VIS-1 empty cases, V2-VIS-2 floating evidence cards) · 3 minor.
